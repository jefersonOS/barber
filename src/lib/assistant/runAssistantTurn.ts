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
    const { data: pros } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', organizationId)
        .eq('role', 'professional')
        .order('full_name', { ascending: true }); // Ordered for stable numbering

    const { data: servs } = await supabase
        .from('services')
        .select('id, name, price')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true }); // Ordered for stable numbering

    const context = `
Profissionais:
${pros?.map(p => `- ${p.full_name}`).join('\n') || '- N/A'}

Serviços:
${servs?.map(s => `- ${s.name} (R$${s.price})`).join('\n') || '- N/A'}
	`;

    // --- HEURISTICS (NLU) START ---
    // --- NUMERIC SELECTION LOGIC ---
    // Handle "1", "2" etc based on what we asked last
    const lastQuestion = stateRow?.last_question_key ?? null;
    const pickNumber = (incomingText.match(/\b\d+\b/)?.[0] ?? null);
    const n = pickNumber ? Number(pickNumber) : NaN;

    const preAIState = { ...state };

    if (!Number.isNaN(n) && n >= 0) {
        // Choice: SERVICE
        if (lastQuestion === "service" && servs?.length) {
            const picked = servs[n - 1]; // 1-based index
            if (picked) {
                console.log(`[Numeric] Selected Service #${n}: ${picked.name}`);
                preAIState.service_id = picked.id;
                preAIState.service_name = picked.name;
                preAIState.service_key = "corte"; // assume generic intent if strict key needed, or leave null
            }
        }

        // Choice: PROFESSIONAL
        if (lastQuestion === "professional" && pros?.length) {
            if (n === 0) {
                console.log(`[Numeric] Selected Professional: Any`);
                preAIState.professional_id = "any";
                preAIState.professional_name = "Primeiro disponível";
            } else {
                const picked = pros[n - 1]; // 1-based index
                if (picked) {
                    console.log(`[Numeric] Selected Professional #${n}: ${picked.full_name}`);
                    preAIState.professional_id = picked.id;
                    preAIState.professional_name = picked.full_name;
                }
            }
        }
    }
    // --- NUMERIC SELECTION END ---

    const lowerText = incomingText.toLowerCase();

    // --- HEURISTICS (NLU - Robust Semantic Extraction) ---
    // 1. Service Extraction - Fuzzy Logic
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    function tokens(s: string) { return normalize(s).split(/\s+/).filter(Boolean); }
    function scoreMatch(query: string, candidate: string) {
        const q = new Set(tokens(query));
        const c = new Set(tokens(candidate));
        let score = 0;
        for (const t of q) if (c.has(t)) score += 2;
        if (normalize(candidate).includes(normalize(query))) score += 3;
        if (normalize(query).includes(normalize(candidate))) score += 1;
        return score;
    }
    function resolveService(servs: { id: string; name: string }[], query: string) {
        let best: { id: string; name: string } | null = null;
        let bestScore = 0;
        for (const s of servs) {
            const sc = scoreMatch(query, s.name);
            if (sc > bestScore) { bestScore = sc; best = s; }
        }
        if (best && bestScore >= 2) return best;
        return null;
    }

    const t = normalize(incomingText);

    let detectedKey: BookingState['service_key'] = null;

    if (t.includes("corte") || t.includes("cortar") || t.includes("cabelo") || t.includes("cabeleira")) detectedKey = "corte";
    else if (t.includes("barba") || t.includes("bigode") || t.includes("fazer a barba")) detectedKey = "barba";
    else if (t.includes("sobrancelha")) detectedKey = "sobrancelha";
    else if (t.includes("pezinho") || t.includes("acabamento")) detectedKey = "corte";

    if (detectedKey) {
        console.log(`[Heuristic] Detected Intent Key: ${detectedKey}`);
        preAIState.service_key = detectedKey;

        // Try to resolve key -> ID using Fuzzy Matcher
        if (!preAIState.service_id && servs) {
            const query = `${incomingText} ${detectedKey}`; // Combine input + intent for better match
            const found = resolveService(servs, query);

            if (found) {
                console.log(`[Heuristic] Resolved Key '${detectedKey}' to Service: ${found.name} (${found.id})`);
                preAIState.service_id = found.id;
                preAIState.service_name = found.name;
            } else {
                console.warn(`[Heuristic] Could not resolve key '${detectedKey}' to any service (Fuzzy Score too low). Will fallback or Ask.`);
                // 3) Strict Fallback: "corte" always maps to something with "corte" if standard resolver failed
                if (detectedKey === 'corte') {
                    const fallback = servs.find(s => normalize(s.name).includes("corte"));
                    if (fallback) {
                        console.log(`[Heuristic] Fallback service for 'corte': ${fallback.name}`);
                        preAIState.service_id = fallback.id;
                        preAIState.service_name = fallback.name;
                    }
                }
            }
        }
    }

    // Fallback: If no key detected but user typed a service name EXACTLY (e.g. "Degradê")
    if (!preAIState.service_id && !detectedKey && servs) {
        const found = servs.find(s => t.includes(normalize(s.name)));
        if (found) {
            preAIState.service_id = found.id;
            preAIState.service_name = found.name;
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

    // --- DETERMINISTIC MENUS (Bypass AI for missing Core Fields) ---

    // Case 1: Missing Service -> List Services
    if (missing.includes("service")) {
        const list = (servs ?? [])
            .map((s, i) => `${i + 1}) ${s.name} (R$${s.price})`)
            .join("\n");

        const finalReply =
            `Fechou. Qual serviço você quer?\n\n` +
            `${list}\n\n` +
            `Responda com o número (ex: 1).`;

        // Save state + set Context for next turn
        await supabase.from("booking_state").upsert({
            conversation_id: conversationId,
            state: mergedState as any,
            last_question_key: "service",
        });

        console.log("[Menu] Asking for Service");
        return { reply: finalReply, action: "ASK_MISSING" };
    }

    // Case 2: Missing Professional -> List Professionals
    if (missing.includes("professional")) {
        // Optimization: If only 1 pro exists, auto-select
        if ((pros ?? []).length === 1 && pros![0]) {
            console.log("[Menu] Auto-selecting single professional");
            mergedState.professional_id = pros![0].id;
            mergedState.professional_name = pros![0].full_name;
            // Don't return, let flow continue to check Date/Time
            // But we need to update 'missing' array for the next check?
            // Actually, simplest is to just save and let next turn handle or continue if possible.
            // For strict correctness, we'll recursively re-compute limits or just fall through content.
            // Let's just update misses manually to allow fall-through to CREATE_HOLD check below?
            // No, safest is: save state, return message "Confirmado com X", or just let fall through.
            // Given flow, let's just fall through to CREATE_HOLD logic but we need to remove 'professional' from missing list.
            const idx = missing.indexOf('professional');
            if (idx > -1) missing.splice(idx, 1);
        } else {
            const list = (pros ?? [])
                .map((p, i) => `${i + 1}) ${p.full_name}`)
                .join("\n");

            const finalReply =
                `Show. Agora escolhe o profissional:\n\n` +
                `0) Primeiro disponível\n` +
                `${list}\n\n` +
                `Responda com o número (ex: 2).`;

            await supabase.from("booking_state").upsert({
                conversation_id: conversationId,
                state: mergedState as any,
                last_question_key: "professional",
            });

            console.log("[Menu] Asking for Professional");
            return { reply: finalReply, action: "ASK_MISSING" };
        }
    }

    if (ai.next_action === "CREATE_HOLD") {
        // Verify we have enough info
        if (missing.length > 0) {
            console.warn("AI tried to hold without required fields:", missing);
            ai.next_action = "ASK_MISSING";

            // Natural language mapping for missing fields (only Date/Time left effectively)
            const labels: Record<string, string> = {
                service: "o serviço",
                professional: "o profissional",
                date: "o dia",
                time: "o horário"
            };
            const missingText = missing.map(m => labels[m] ?? m).join(' e ');
            finalReply = `Opa, entendi! Para finalizar o agendamento, preciso só confirmar ${missingText}.`;
        } else {
            try {
                const hold = await createHoldBooking({ supabase, conversationId, state: mergedState, organizationId });
                mergedState.hold_booking_id = hold.bookingId;

                // Save the ID -> DELETED (Will save at end)

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
                    const list = (servs ?? [])
                        .map((s, i) => `${i + 1}) ${s.name} (R$${s.price})`)
                        .join("\n");

                    finalReply =
                        `Não consegui identificar o serviço com certeza 😅\n` +
                        `Me diz qual é, escolhendo na lista:\n\n` +
                        `${list}\n\n` +
                        `Responda com o número (ex: 1).`;

                    ai.next_action = "ASK_MISSING";

                    // salva que a última pergunta foi service (pra interpretar "1", "2", etc)
                    await supabase.from("booking_state").upsert({
                        conversation_id: conversationId,
                        state: mergedState as any,
                        last_question_key: "service",
                    });

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

                // Store session -> DELETED (Will save at end)

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

    // --- FINAL SAVE (Single Source of Truth) ---
    console.log("[StateToSave]", JSON.stringify(mergedState));

    await supabase.from("booking_state").upsert({
        conversation_id: conversationId,
        state: mergedState as any,
        last_question_key: ai.next_action === "ASK_MISSING" ? missing.join(",") : null,
    });

    // ✅ PERSIST STATE MOVED TO END

    return {
        reply: finalReply,
        action: ai.next_action
    };
}
