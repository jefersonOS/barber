import { createClient } from "@/lib/supabase/server";
import { chatTurn } from "./openaiChatTurn";
import { applyStateUpdates, computeMissing, BookingState } from "./state";
import { createHoldBooking, createStripeCheckout } from "./actions";

export async function runAssistantTurn({
    conversationId,
    incomingText,
    organizationId
}: {
    conversationId: string;
    incomingText: string;
    organizationId: string;
}) {
    const supabase = await createClient();

    // 1. Fetch Current State
    const { data: stateRow } = await supabase
        .from("booking_state")
        .select("state, last_question_key")
        .eq("conversation_id", conversationId)
        .maybeSingle();

    const state: BookingState = (stateRow?.state as BookingState) ?? {};

    // 2. Fetch History (Last 15)
    const { data: msgs } = await supabase
        .from("inbound_messages")
        .select("body, created_at, provider") // provider helps distinguish user vs system if we stored self-messages too? 
        // Actually inbound_messages are only user messages in our schema. 
        // We might need to store OUTBOUND messages to give full history.
        // For State V2, "state" is more important than history, but history helps context.
        // Let's assume we also might query `conversation_logs` if we want full history, 
        // but sticking to V2 plan: only inbound_messages needed for "User said X".
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10);

    const history = (msgs ?? []).reverse().map((m) => m.body);

    // 3. Prepare Context (Business Hours, Pros, Services)
    // Fetching strictly what's needed for the prompt
    const { data: pros } = await supabase.from('profiles').select('id, full_name').eq('organization_id', organizationId).eq('role', 'professional');
    const { data: servs } = await supabase.from('services').select('id, name, price').eq('organization_id', organizationId);

    const context = `
Profissionais:
${pros?.map(p => `- ${p.full_name}`).join('\n') || '- N/A'}

Serviços:
${servs?.map(s => `- ${s.name} (R$${s.price})`).join('\n') || '- N/A'}
	`;

    // --- HEURISTICS (NLU) START ---
    // Make a copy of state to apply heuristics before AI sees it
    const preAIState = { ...state };
    const lowerText = incomingText.toLowerCase();

    // Sanitize incoming state artifacts if any (though state comes from DB)
    // But helpful if DB has garbage
    if (preAIState.service_id === "undefined" || preAIState.service_id === "null") preAIState.service_id = undefined;
    if (preAIState.service_name === "undefined" || preAIState.service_name === "null") preAIState.service_name = undefined;

    // Heuristic: Service
    if (!preAIState.service_id && servs) {
        const keywords = [
            { terms: ['corte', 'cortar', 'corta', 'cabelo', 'cabeleira'], match: 'corte' },
            { terms: ['barba', 'fazer a barba', 'bigode'], match: 'barba' },
            { terms: ['sobrancelha'], match: 'sobrancelha' },
            { terms: ['pezinho', 'acabamento'], match: 'acabamento' }
        ];

        console.log("[Heuristic] Org ID:", organizationId);
        console.log("[Heuristic] Input:", lowerText);

        let found = servs.find(s => lowerText.includes(s.name.toLowerCase()));
        if (!found) {
            for (const k of keywords) {
                if (k.terms.some(t => lowerText.includes(t))) {
                    found = servs.find(s => s.name.toLowerCase().includes(k.match));
                    if (found) break;
                }
            }
        }

        if (found) {
            console.log(`[Heuristic] Matched service: ${found.name}`);
            preAIState.service_name = found.name;
            preAIState.service_id = found.id;
        }
    }

    // Heuristic: Professional
    if (!preAIState.professional_id && pros) {
        const foundPro = pros.find(p => {
            const firstName = p.full_name.split(' ')[0].toLowerCase();
            return lowerText.includes(firstName) && firstName.length > 2;
        });

        if (foundPro) {
            console.log(`[Heuristic] Matched pro: ${foundPro.full_name}`);
            preAIState.professional_name = foundPro.full_name;
            preAIState.professional_id = foundPro.id;
        }
    }
    // --- HEURISTICS END ---

    // 4. Run AI Turn (With Pre-Processed State)
    const ai = await chatTurn({ state: preAIState, history, incomingText, context });

    // 5. Apply Updates
    // Merge AI updates on top of Pre-Processed State
    const mergedState = applyStateUpdates(preAIState, ai.state_updates);

    let finalReply = ai.reply; // Initial reply from AI


    // 7. Execute Actions
    const missing = computeMissing(mergedState);

    if (ai.next_action === "CREATE_HOLD") {
        // Verify we have enough info
        if (missing.length > 0) {
            console.warn("AI tried to hold without required fields:", missing);
            ai.next_action = "ASK_MISSING";
            // Make the list natural in Portuguese
            const missingText = missing.map(m => m === 'date' ? 'o dia' : m === 'time' ? 'o horário' : m === 'service' ? 'o serviço' : 'o profissional').join(' e ');
            finalReply = `Opa, entendi! Para finalizar o agendamento, preciso só confirmar ${missingText}.`;
        } else {
            try {
                const hold = await createHoldBooking({ supabase, conversationId, state: mergedState, organizationId });
                mergedState.hold_booking_id = hold.bookingId;

                // Save the ID
                await supabase.from("booking_state").upsert({
                    conversation_id: conversationId,
                    state: mergedState as any
                });

                // Should we auto-trigger payment?
                // If tone is "Create hold then ask payment", we might want to do both.
                // Re-evaluating next step: 
                // If hold created successfully, we probably want to ask for payment immediately or confirm "Reserva segura, agora pague".
                // Let's assume flow continues to payment.

                // If we want to chain actions:
                /* 
                const checkout = await createStripeCheckout({ supabase, bookingId: hold.bookingId, state: mergedState });
                finalReply += `\n\nReserva iniciada! Para confirmar, faça o pagamento do sinal aqui: ${checkout.url}`;
                */
                finalReply += "\n\nPré-reserva realizada! Vou gerar o link de pagamento...";
                // Force next implementation logic if we want auto-link
            } catch (e: any) {
                console.error("Failed to create hold", e);
                // Catch specific errors from actions.ts
                if (e.message.includes("Service not found")) {
                    finalReply = "Não encontrei esse serviço no sistema. Qual seria o nome exato?";
                    ai.next_action = "ASK_MISSING"; // Force ask again
                } else if (e.message.includes("Professional not found")) {
                    finalReply = "Não encontrei esse profissional. Tem preferência por outro?";
                    ai.next_action = "ASK_MISSING";
                } else {
                    finalReply = "Tive um erro técnico ao reservar. Pode tentar novamente?";
                }
            }
        }
    }

    if (ai.next_action === "CREATE_PAYMENT") {
        if (mergedState.hold_booking_id) {
            try {
                const checkout = await createStripeCheckout({ supabase, bookingId: mergedState.hold_booking_id, state: mergedState });
                mergedState.payment_id = checkout.sessionId; // Store session

                await supabase.from("booking_state").upsert({
                    conversation_id: conversationId,
                    state: mergedState as any
                });

                finalReply += `\n\n🔗 Link para pagamento: ${checkout.url}\n(Assim que pagar, eu confirmo aqui!)`;
            } catch (e) {
                console.error("Payment link error", e);
                finalReply = "Erro ao gerar link de pagamento.";
            }
        } else {
            // Logic gap: Tried to pay without hold?
            finalReply += "\n(Ops, preciso criar a reserva antes de gerar pagamento. Vamos confirmar os dados?)";
        }
    }

    return {
        reply: finalReply,
        action: ai.next_action
    };
}
