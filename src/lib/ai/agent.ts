import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"
import { ChatCompletionMessageParam } from "openai/resources/index" // removed .mjs
import { addMinutes, parseISO, startOfDay, endOfDay } from "date-fns" // removed format, isWithinInterval

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function processAIResponse(organizationId: string, userPhone: string, message: string) {
    const supabase = await createClient()

    // 1. Fetch Organization Context
    const { data: org } = await supabase.from('organizations').select('*').eq('id', organizationId).single()
    if (!org) throw new Error("Organization not found")

    // 2. Fetch Conversation History (Last 15 messages for better context)
    const { data: history } = await supabase
        .from('conversation_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('client_phone', userPhone)
        .order('timestamp', { ascending: false })
        .limit(15)

    // 4. Fetch Business Hours for Context
    const { data: businessHours } = await supabase.from('business_hours').select('*').eq('organization_id', organizationId)

    // Format hours for prompt
    const hoursText = businessHours?.map(bg => {
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
        return `${days[bg.day_of_week]}: ${bg.is_closed ? 'Fechado' : `${bg.start_time}-${bg.end_time}`}`
    }).join('\n    ') || "Padrão: 09:00 às 18:00 (Seg-Sex)"

    // 5. Construct Messages with New System Prompt
    const systemPrompt = `
Você é o "Atendente IA" da barbearia ${org.name}. 
Seu trabalho é atender clientes com rapidez e clareza, tirar dúvidas e FECHAR agendamentos completos.
Você tem memória das conversas anteriores (preferências, serviços favoritos, profissional preferido, unidade, horários). Use isso para sugerir e acelerar, mas sempre confirme quando estiver incerto.

OBJETIVO PRINCIPAL
1) Entender o que o cliente quer (serviço(s), unidade, profissional, data e horário).
2) Reservar o horário provisoriamente.
3) Cobrar um SINAL (porcentagem do valor do serviço) para confirmar (Simule essa etapa se o link de pagamento não estiver integrado).
4) Validar o pagamento consultando o status no sistema.
5) Confirmar o agendamento e enviar os detalhes finais.

PERSONALIDADE E TOM
- Seja objetivo, simpático, direto e profissional.
- Evite enrolação.
- Faça perguntas curtas e guiadas.
- Sempre proponha 2–3 opções quando possível.
- Em caso de conflito/indisponibilidade, ofereça alternativas imediatamente.

REGRAS CRÍTICAS
- Nunca invente preços, horários disponíveis, profissionais, unidades, políticas ou confirmação de pagamento.
- Sempre use as ferramentas/funções para: buscar serviços, preços, agenda, criar reserva, gerar link de pagamento, checar status do pagamento, confirmar/cancelar reserva.
- Pagamento: só diga "pago/confirmado" se o sistema retornar status "PAID/CONFIRMED".
- Se o cliente pedir algo fora de política (ex: sem sinal quando é obrigatório), explique de forma simples e ofereça opção válida.
- Privacidade: não peça dados sensíveis desnecessários. Para agendar: nome + telefone/WhatsApp (ou e-mail) é o suficiente.
- Se o cliente ficar confuso, recapitule em 1 linha e volte pro próximo passo.

MEMÓRIA (USE SEMPRE)
Você recebe um bloco de memória com:
- nome_cliente (se conhecido)
- preferências (unidade, profissional, serviços, dias/horários preferidos)
Use isso para sugerir, mas não exponha "eu lembro de você". Apenas aja naturalmente.

FERRAMENTAS/FUNÇÕES
Você DEVE usar as ferramentas disponíveis para realizar ações. Se não souber uma informação, use a ferramenta adequada para buscar.

Data/Hora Atual: ${new Date().toLocaleString('pt-BR')}
Configurações da Barbearia: ${JSON.stringify(org.settings || {})}

Horários de Funcionamento:
    ${hoursText}
    `

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...(history?.reverse().map(h => ({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: h.message_content
        })) as ChatCompletionMessageParam[] || []),
        { role: "user", content: message }
    ]

    // 4. OpenAI Tools Definition
    const tools = [
        {
            type: "function" as const,
            function: {
                name: "get_services",
                description: "List all available services, prices and durations.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "get_units",
                description: "List available units (locations) and their addresses.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "get_professionals",
                description: "List professionals available at a specific unit.",
                parameters: {
                    type: "object",
                    properties: {
                        unit_id: { type: "string", description: "Unit ID (optional, defaults to main)" }
                    }
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "get_availability",
                description: "Check available appointment slots for a specific date and professional.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Date in YYYY-MM-DD format" },
                        professional_id: { type: "string", description: "Professional ID (optional)" },
                        service_ids: { type: "array", items: { type: "string" }, description: "List of service IDs" }
                    },
                    required: ["date"]
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "create_hold_booking",
                description: "Create a provisional booking (hold) for the client.",
                parameters: {
                    type: "object",
                    properties: {
                        service_ids: { type: "array", items: { type: "string" } },
                        date: { type: "string", description: "YYYY-MM-DD" },
                        time: { type: "string", description: "HH:mm" },
                        client_name: { type: "string" },
                        professional_id: { type: "string", description: "Selected professional ID" }
                    },
                    required: ["service_ids", "date", "time", "client_name"]
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "create_payment_link",
                description: "Generate a payment link for the booking deposit.",
                parameters: {
                    type: "object",
                    properties: {
                        booking_id: { type: "string", description: "ID of the booking/hold" },
                        amount: { type: "number", description: "Amount to charge" }
                    },
                    required: ["booking_id", "amount"]
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "check_payment_status",
                description: "Check if a payment has been completed.",
                parameters: {
                    type: "object",
                    properties: {
                        payment_id: { type: "string" } // or booking_id
                    },
                    required: ["payment_id"]
                }
            }
        },
        {
            type: "function" as const,
            function: {
                name: "confirm_booking",
                description: "Finalize and confirm the booking after payment.",
                parameters: {
                    type: "object",
                    properties: {
                        booking_id: { type: "string" }
                    },
                    required: ["booking_id"]
                }
            }
        }
    ]

    // 5. OpenAI Call Loop (to handle tool outputs)
    let finalResponse = ""
    let turnCount = 0
    const MAX_TURNS = 6 // Increased for complex flows

    while (turnCount < MAX_TURNS) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        })

        const choice = response.choices[0]
        const message = choice.message

        if (message.tool_calls) {
            messages.push(message)

            for (const toolCall of message.tool_calls) {
                if (toolCall.type !== 'function') continue
                const fnName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)
                let toolResult = ""

                try {
                    if (fnName === "get_services") {
                        const { data: services } = await supabase.from('services').select('id, name, price, duration_min').eq('organization_id', organizationId)
                        toolResult = JSON.stringify(services)
                    }
                    else if (fnName === "get_units") {
                        // Mocking unit logic: Organization is the unit
                        toolResult = JSON.stringify([{ id: organizationId, name: org.name, address: org.address || "Endereço Principal" }])
                    }
                    else if (fnName === "get_professionals") {
                        // Profiles with role restricted? For now list all connected profiles
                        const { data: pros } = await supabase.from('profiles').select('id, full_name, role').eq('organization_id', organizationId)
                        toolResult = JSON.stringify(pros || [])
                    }
                    else if (fnName === "get_availability") {
                        // Simplified availability logic
                        const dayStart = startOfDay(parseISO(args.date))
                        const dayEnd = endOfDay(parseISO(args.date))

                        const { data: appointments } = await supabase
                            .from('appointments')
                            .select('start_time, end_time')
                            .eq('organization_id', organizationId)
                            .gte('start_time', dayStart.toISOString())
                            .lte('start_time', dayEnd.toISOString())
                            .neq('status', 'cancelled')

                        const slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]
                        const availableSlots = slots.filter(slot => {
                            const slotTime = `${args.date}T${slot}:00` // timezone naive
                            return !appointments?.some(a => a.start_time.includes(slotTime))
                        })

                        toolResult = JSON.stringify({ available_slots: availableSlots })
                    }
                    else if (fnName === "create_hold_booking") {
                        // Create Client if needed
                        let clientId = null
                        const { data: existingClient } = await supabase.from('clients').select('id').eq('organization_id', organizationId).eq('phone', userPhone).single()
                        if (existingClient) clientId = existingClient.id
                        else {
                            const { data: newClient } = await supabase.from('clients').insert({
                                organization_id: organizationId,
                                name: args.client_name || "Cliente WhatsApp",
                                phone: userPhone
                            }).select().single()
                            clientId = newClient?.id
                        }

                        // Determine end time
                        const serviceIds = args.service_ids || []
                        let totalDuration = 30 // default
                        if (serviceIds.length > 0) {
                            const { data: services } = await supabase.from('services').select('duration_min').in('id', serviceIds)
                            totalDuration = services?.reduce((acc, s) => acc + s.duration_min, 0) || 30
                        }

                        const startTime = `${args.date}T${args.time}:00`
                        const startDate = new Date(startTime)
                        const endDate = addMinutes(startDate, totalDuration)

                        const { data: booking, error } = await supabase.from('appointments').insert({
                            organization_id: organizationId,
                            service_id: serviceIds[0], // taking first for link, or need multiple service support in DB
                            client_phone: userPhone,
                            client_name: args.client_name,
                            start_time: startDate.toISOString(),
                            end_time: endDate.toISOString(),
                            status: 'pending', // Using pending as hold
                            professional_id: args.professional_id
                        }).select().single()

                        if (error) throw new Error(error.message)
                        toolResult = JSON.stringify({ success: true, booking_id: booking.id, message: "Pré-reserva criada. Aguardando pagamento." })
                    }
                    else if (fnName === "create_payment_link") {
                        // Mock Link
                        toolResult = JSON.stringify({
                            payment_link: `https://fake-payment.com/pay/${args.booking_id}`,
                            qr_code: "mock_qr_base64_string",
                            status: "pending"
                        })
                    }
                    else if (fnName === "check_payment_status") {
                        // Mock always paid for flow testing
                        toolResult = JSON.stringify({ status: "PAID" })
                    }
                    else if (fnName === "confirm_booking") {
                        const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', args.booking_id)
                        if (error) throw error
                        toolResult = JSON.stringify({ success: true, status: "confirmed" })
                    }
                    else {
                        toolResult = JSON.stringify({ error: "Tool not implemented" })
                    }
                } catch (e: any) {
                    console.error(`Error in tool ${fnName}:`, e)
                    toolResult = JSON.stringify({ error: e.message || "Unknown error" })
                }

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }
        } else {
            finalResponse = message.content || ""
            break
        }
        turnCount++
    }

    return finalResponse || "Desculpe, tive um erro ao processar. Pode repetir?"
}
