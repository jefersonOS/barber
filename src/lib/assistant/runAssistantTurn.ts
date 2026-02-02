import { createClient } from "@/lib/supabase/server";
import { chatTurn } from "./openaiChatTurn";
import { applyStateUpdates, computeMissing, normalizeStateUpdates, BookingState, computeMissingForHold } from "./state";
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
        // Choice: SERVICE
        if (lastQuestion === "service" && servs?.length) {
            // Check if we offered a specific sub-list (e.g. filtered by "corte")
            const offeredIds = stateRow?.state?.last_offer?.service_options;
            let picked: { id: string; name: string } | undefined;

            if (offeredIds && offeredIds.length > 0) {
                // Map number to the Specific ID from the list
                const id = offeredIds[n - 1]; // 1-based
                if (id) picked = servs.find(s => s.id === id);
            } else {
                // Fallback to full list if no specific options saved
                picked = servs[n - 1];
            }

            if (picked) {
                console.log(`[Numeric] Selected Service #${n}: ${picked.name}`);
                preAIState.service_id = picked.id;
                preAIState.service_name = picked.name;
                // If we selected a specific service, we can infer the key/intent or just left it as is.
                // preAIState.service_key = "corte"; // Don't force key if we have ID.
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

        // --- STALE STATE RESET --- 
        // If we detect a new intent (e.g. "corte"), we assume a NEW booking flow.
        // We wipe old Date, Time, Professional to prevent jumping to end.
        // Exception: If incoming text explicitly mentions "amanhã" or a pro, 
        // heuristics/AI should pick that up in THIS turn, so wiping here is safe 
        // (as long as we do it BEFORE regex/AI extraction).

        preAIState.service_key = detectedKey;
        // WIPE State
        preAIState.service_id = undefined;
        preAIState.service_name = undefined;
        preAIState.professional_id = undefined;
        preAIState.professional_name = undefined;
        preAIState.date = undefined;
        preAIState.time = undefined;
        preAIState.last_offer = undefined;

        console.log("[State] Wiped stale state due to new Intent Key.");


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
    const safeUpdates = normalizeStateUpdates(ai.state_updates);
    const mergedState = applyStateUpdates(preAIState, safeUpdates);

    let finalReply = ai.reply; // Initial reply from AI


    // 7. Execute Actions

    // PHASE 1: Conversation Flow (Is content "Conversational Enough"?)
    // Accepts service_key/name/id. Only halts if completely undefined.
    const missingConversation = computeMissing(mergedState);

    // If conversation is missing core elements, prioritize ASKING (Human-like)
    // Don't force technical menus unless we are blocked on HOLD creation later.
    if (missingConversation.length > 0) {

        // A) Missing Professional -> List Professionals
        if (missingConversation.includes("professional")) {
            // Optimization: If only 1 pro exists, auto-select
            if ((pros ?? []).length === 1 && pros![0]) {
                console.log("[Menu] Auto-selecting single professional");
                mergedState.professional_id = pros![0].id;
                mergedState.professional_name = pros![0].full_name;
                // Proceed to next check (Date/Time)
            } else {
                const list = (pros ?? [])
                    .map((p, i) => `${i + 1}) ${p.full_name}`)
                    .join("\n");

                finalReply =
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

        // B) Missing Date/Time -> Guided Ask
        if (missingConversation.includes("date") || missingConversation.includes("time")) {
            // Fallback to AI reply if it asked naturally, or force specific text
            // But usually AI asks well. We just ensure we don't skip to HOLD.
            if (ai.next_action !== "ASK_MISSING") {
                ai.next_action = "ASK_MISSING";
                finalReply = "Qual dia e horário você prefere? (ex: terça 16:00)";
            }
            // Save state & Return
            console.log("[Flow] Asking for Date/Time");
            // Persist at end, just let fall through logic
        }

        // C) Missing Service DE VERDADE (No Key, No Name, No ID) -> Then List
        if (missingConversation.includes("service")) {
            const list = (servs ?? [])
                .map((s, i) => `${i + 1}) ${s.name} (R$${s.price})`)
                .join("\n");

            finalReply =
                `Fechou. Qual serviço você quer?\n\n` +
                `${list}\n\n` +
                `Responda com o número (ex: 1).`;

            await supabase.from("booking_state").upsert({
                conversation_id: conversationId,
                state: mergedState as any,
                last_question_key: "service",
            });

            console.log("[Menu] Asking for Service (Total Missing)");
            return { reply: finalReply, action: "ASK_MISSING" };
        }
    }


    // PHASE 2: Action Safety (HOLD Check)
    // Only tries to create HOLD (or validate strictness) if Conversation flow is satisfied.

    // We only care about strict service_id if we are ABOUT TO HOLD or if AI thinks we are ready.
    const missingHold = computeMissingForHold(mergedState);
    const readyToHold = missingHold.length === 0;

    // Logic: If conversation sees we have "service_key" (e.g. "corte"), it passes Phase 1.
    // But Phase 2 might say: "Hey, I have 'service_key' but no 'service_id'. I can't HOLD yet."
    // In that specific case, we Trigger the Menu to resolve the ID.

    // PHASE 1: Conversation Flow (Deterministic Router)
    // 1) NO INTENT -> List Services
    // 2) INTENT YES, PRO NO -> List Pros
    // 3) INTENT + PRO YES, DATE NO -> Ask Date
    // 4) ALL YES, BUT ID NO -> Resolve ID (Filtered Menu)

    const hasServiceIntent = (s: BookingState) => Boolean(s.service_key || s.service_name || s.service_id);
    const hasProfessional = (s: BookingState) => Boolean(s.professional_id || s.professional_name);
    const hasDateTime = (s: BookingState) => Boolean(s.date && s.time);

    // 1) Missing Service Intent (Total)
    if (!hasServiceIntent(mergedState)) {
        const list = (servs ?? [])
            .map((s, i) => `${i + 1}) ${s.name} (R$${s.price})`)
            .join("\n");

        const finalReply =
            `Qual serviço você quer?\n\n` +
            `${list}\n\n` +
            `Responda com o número (ex: 1).`;

        // Save options for numeric selection
        mergedState.last_offer = { ...mergedState.last_offer, service_options: (servs ?? []).map(s => s.id) };

        await supabase.from("booking_state").upsert({
            conversation_id: conversationId,
            state: mergedState as any,
            last_question_key: "service",
        });

        console.log("[Router] 1. Asking for Service Intent");
        return { reply: finalReply, action: "ASK_MISSING" };
    }

    // 2) Missing Professional (But has Intent)
    if (!hasProfessional(mergedState)) {
        // Optimization: If only 1 pro exists, auto-select
        if ((pros ?? []).length === 1 && pros![0]) {
            console.log("[Router] Auto-selecting single professional");
            mergedState.professional_id = pros![0].id;
            mergedState.professional_name = pros![0].full_name;
            // Fallthrough to next check (Date/Time)
        } else {
            const list = (pros ?? [])
                .map((p, i) => `${i + 1}) ${p.full_name}`)
                .join("\n");

            const finalReply =
                `Show ✅ pra *${mergedState.service_key ?? mergedState.service_name ?? "o serviço"}*.\n` +
                `Agora escolhe o profissional:\n\n` +
                `0) Primeiro disponível\n` +
                `${list}\n\n` +
                `Responda com o número (ex: 2).`;

            await supabase.from("booking_state").upsert({
                conversation_id: conversationId,
                state: mergedState as any,
                last_question_key: "professional",
            });

            console.log("[Router] 2. Asking for Professional");
            return { reply: finalReply, action: "ASK_MISSING" };
        }
    }

    // 3) Missing Date/Time
    if (!hasDateTime(mergedState)) {
        // Fallback to AI reply if it asked naturally
        if (ai.next_action !== "ASK_MISSING") {
            ai.next_action = "ASK_MISSING";
            finalReply = `Fechado ✅\nAgora me diz *dia e horário* (ex: "terça 16:00").`;
        } else {
            finalReply = ai.reply; // Use AI's natural question if it asked
        }

        console.log("[Router] 3. Asking for Date/Time");
        // Persist at end
    } else {
        // 4) READY FOR HOLD? Check Service ID
        // If we have Intent but failed to resolve ID, NOW we ask specifically.
        if (!mergedState.service_id) {
            console.log("[Router] 4. Resolving Exact Service ID");

            // Filter options based on Key
            const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const key = mergedState.service_key;

            const candidates = (servs ?? []).filter(s => {
                const n = norm(s.name);
                return key === "corte"
                    ? (n.includes("corte") || n.includes("cabelo") || n.includes("degrade") || n.includes("navalha") || n.includes("social"))
                    : key === "barba"
                        ? n.includes("barba")
                        : key === "sobrancelha"
                            ? n.includes("sobrancelha")
                            : true;
            });

            console.log(`[Router] Filtered candidates for key '${key}': ${candidates.map(c => c.name).join(", ")}`);

            // [OPTIMIZATION] Auto-select if only 1 option matches the intent
            if (candidates.length === 1) {
                const best = candidates[0];
                console.log(`[Router] Auto-selecting single matching service: ${best.name}`);
                mergedState.service_id = best.id;
                mergedState.service_name = best.name;

                // Continue flow -> Will hit CREATE_HOLD check below
            } else {
                const options = candidates.length ? candidates : (servs ?? []);
                const list = options
                    .map((s, i) => `${i + 1}) ${s.name} (R$${s.price})`)
                    .join("\n");

                finalReply =
                    `Pra confirmar no sistema, escolhe a opção exata de *${key ?? "serviço"}*:\n\n` +
                    `${list}\n\n` +
                    `Responda com o número (ex: 1).`;

                // Save options for numeric selection
                mergedState.last_offer = { ...mergedState.last_offer, service_options: options.map(s => s.id) };

                await supabase.from("booking_state").upsert({
                    conversation_id: conversationId,
                    state: mergedState as any,
                    last_question_key: "service",
                });

                return { reply: finalReply, action: "ASK_MISSING" };
            }
        }
    }

    if (ai.next_action === "CREATE_HOLD" || (readyToHold && ai.next_action !== "CREATE_PAYMENT")) {
        // Verify we have enough info
        if (missingHold.length > 0) {
            console.warn("AI tried to hold without required fields:", missingHold);
            ai.next_action = "ASK_MISSING";

            // Natural language mapping for missing fields (only Date/Time left effectively)
            const labels: Record<string, string> = {
                service: "o serviço",
                professional: "o profissional",
                date: "o dia",
                time: "o horário"
            };
            const missingText = missingHold.map(m => labels[m] ?? m).join(' e ');
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
        last_question_key: ai.next_action === "ASK_MISSING" ? missingConversation.join(",") : null,
    });

    // ✅ PERSIST STATE MOVED TO END

    return {
        reply: finalReply,
        action: ai.next_action
    };
}
