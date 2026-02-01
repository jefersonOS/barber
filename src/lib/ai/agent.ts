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

    // 2. Fetch Conversation History (Last 10 messages)
    const { data: history } = await supabase
        .from('conversation_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('client_phone', userPhone)
        .order('timestamp', { ascending: false })
        .limit(10)

    // 3. Construct Messages
    const systemPrompt = `
    You are the virtual receptionist for "${org.name}".
    Your goal is to help clients schedule appointments and answer questions about services.
    
    Current Date/Time: ${new Date().toLocaleString('pt-BR')}
    
    Guidelines:
    - Be polite, professional, and concise (WhatsApp style).
    - Speak Portuguese (PT-BR).
    - If the user wants to book, ALWAYS check availability first.
    - When booking, ask for the "Service" first if not specified.
    - Confirm the date and time before finalizing.
    - If no times are available, suggest the closest ones.
    - Do not make up information. Use the provided tools.
    
    Organization Settings: ${JSON.stringify(org.settings || {})}
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
            type: "function",
            function: {
                name: "list_services",
                description: "List all available services and their prices and durations.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "check_availability",
                description: "Check available appointment slots for a specific date.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Date in YYYY-MM-DD format" }
                    },
                    required: ["date"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "book_appointment",
                description: "Book a new appointment.",
                parameters: {
                    type: "object",
                    properties: {
                        serviceName: { type: "string", description: "Exact name of the service" },
                        date: { type: "string", description: "YYYY-MM-DD" },
                        time: { type: "string", description: "HH:mm" },
                        clientName: { type: "string", description: "Name of the client (if provided)" }
                    },
                    required: ["serviceName", "date", "time"]
                }
            }
        }
    ] as const

    // 5. OpenAI Call Loop (to handle tool outputs)
    let finalResponse = ""
    let turnCount = 0
    const MAX_TURNS = 5

    while (turnCount < MAX_TURNS) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // or gpt-3.5-turbo if cost is a concern
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        })

        const choice = response.choices[0]
        const message = choice.message

        if (message.tool_calls) {
            messages.push(message) // Add the assistant's tool call request to history

            for (const toolCall of message.tool_calls) {
                const fnName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)
                let toolResult = ""

                if (fnName === "list_services") {
                    const { data: services } = await supabase.from('services').select('name, price, duration_min').eq('organization_id', organizationId)
                    toolResult = JSON.stringify(services)
                }
                else if (fnName === "check_availability") {
                    // Logic to find free slots
                    // 1. Get all appts for that day
                    const dayStart = startOfDay(parseISO(args.date))
                    const dayEnd = endOfDay(parseISO(args.date))

                    const { data: appointments } = await supabase
                        .from('appointments')
                        .select('start_time, end_time')
                        .eq('organization_id', organizationId)
                        .gte('start_time', dayStart.toISOString())
                        .lte('start_time', dayEnd.toISOString())
                        .neq('status', 'cancelled')

                    // Simple slot logic: 09:00 to 18:00, 1 hour slots (Simplified for Agent MVP)
                    // improvement: fetch real business hours from settings
                    const slots = [
                        "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
                    ]

                    const availableSlots = slots.filter(slot => {
                        // Check if any appointment overlaps this slot time on that date
                        // This is a simplified check. Real check needs service duration.
                        // For now, assuming standard 1 hour slots for simplicity or checking start time collision
                        const slotTime = `${args.date}T${slot}:00`
                        return !appointments?.some(a => {
                            // Convert DB timestamp to local/comparison time
                            const aTime = new Date(a.start_time).toISOString().split('T')[1].substring(0, 5) // Extract HH:mm approx (needs timezone care)
                            // Better: compare formatted strings if strict
                            return a.start_time.includes(slotTime) // Very rough check, TODO: improve
                        })
                    })

                    toolResult = JSON.stringify({ available_slots: availableSlots })
                }
                else if (fnName === "book_appointment") {
                    // 1. Find Service
                    const { data: service } = await supabase.from('services').select('id, duration_min').ilike('name', args.serviceName).eq('organization_id', organizationId).single()

                    if (!service) {
                        toolResult = JSON.stringify({ error: "Service not found. Ask user to pick from list." })
                    } else {
                        // 2. Calculate End Time
                        const startIso = `${args.date}T${args.time}:00` // Needs Timezone handling!
                        // Should use date-fns to construct proper ISO with offset? 
                        // For MVP, assuming UTC storage or consistent offset.
                        const startDate = new Date(startIso)
                        const endDate = addMinutes(startDate, service.duration_min)

                        // 3. Create Client if not exists
                        let clientId = null
                        // Check if we have a client with this phone
                        const { data: existingClient } = await supabase.from('clients').select('id').eq('organization_id', organizationId).eq('phone', userPhone).single()

                        if (existingClient) {
                            clientId = existingClient.id
                        } else {
                            const { data: newClient } = await supabase.from('clients').insert({
                                organization_id: organizationId,
                                name: args.clientName || "Cliente WhatsApp",
                                phone: userPhone
                            }).select().single()
                            clientId = newClient?.id
                        }

                        // 4. Insert Appointment
                        const { error } = await supabase.from('appointments').insert({
                            organization_id: organizationId,
                            service_id: service.id,
                            client_phone: userPhone,
                            client_name: args.clientName || "Cliente WhatsApp",
                            start_time: startDate.toISOString(),
                            end_time: endDate.toISOString(),
                            status: 'confirmed'
                        })

                        if (error) {
                            toolResult = JSON.stringify({ error: "Failed to book. Slot might be taken." })
                        } else {
                            toolResult = JSON.stringify({ success: true, message: "Appointment booked successfully." })
                        }
                    }
                }

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }
        } else {
            // No tool calls, just text response
            finalResponse = message.content || ""
            break
        }
        turnCount++
    }

    return finalResponse || "Desculpe, tive um erro ao processar. Pode repetir?"
}
