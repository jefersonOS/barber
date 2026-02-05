import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAssistantTurn } from "@/lib/assistant/runAssistantTurn";
import { EvolutionClient } from "@/lib/evolution/client";
import { transcribeAudio } from "@/lib/assistant/transcription";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // 1. Basic Validation
        const event = payload.event;
        if (event !== "messages.upsert") {
            return NextResponse.json({ ok: true, ignored: true });
        }

        const data = payload.data;
        const key = data.key || {};

        // Ignore status updates, groups, or messages from me
        if (key.fromMe || key.remoteJid?.includes("@g.us") || key.remoteJid?.includes("status")) {
            return NextResponse.json({ ok: true, ignored: true });
        }

        const phone = key.remoteJid; // e.g., 551199999999@s.whatsapp.net
        let body = data.message?.conversation || data.message?.extendedTextMessage?.text;

        // --- AUDIO HANDLING ---
        if (!body && data.message?.audioMessage) {
            console.log("[Webhook] Processing Audio Message...");
            const audio = data.message.audioMessage;
            let buffer: Buffer | null = null;

            // 1. Try Base64 from payload (if enabled in Evolution utils)
            // Evolution v2 might put it in data.base64 or message.audioMessage.base64 depending on version/config
            const potentialBase64 = data.base64 || audio.base64;

            if (potentialBase64) {
                buffer = Buffer.from(potentialBase64, 'base64');
            } else if (audio.url) {
                // 2. Fetch from URL
                try {
                    // Start fetching - depending on instance privacy, might need headers
                    // Ensure we have API Key just in case Evolution requires it for media download (usually yes)
                    const headers: HeadersInit = {};
                    if (process.env.EVOLUTION_API_KEY) {
                        headers['apikey'] = process.env.EVOLUTION_API_KEY;
                    }

                    const res = await fetch(audio.url, { headers });
                    if (res.ok) {
                        const ab = await res.arrayBuffer();
                        buffer = Buffer.from(ab);
                    } else {
                        console.error(`[Audio] Failed to fetch media from URL: ${res.status}`);
                    }
                } catch (e) {
                    console.error("[Audio] Fetch error:", e);
                }
            }

            if (buffer) {
                const text = await transcribeAudio(buffer);
                if (text) {
                    console.log(`[Audio] Transcribed: "${text}"`);
                    body = text; // Just the text, clean.
                } else {
                    body = "(Áudio inaudível)";
                }
            } else {
                body = "(Erro ao baixar áudio)";
            }
        }
        // --- AUDIO HANDLING END ---
        const providerMessageId = key.id;
        const instanceId = payload.instance || payload.sender;

        if (!phone || !body || !providerMessageId) {
            return NextResponse.json({ ok: true, ignored_empty: true });
        }

        // Clean phone for DB? usually we keep remoteJid as unique identifier

        const supabase = await createClient();

        // 2. Resolve Organization
        // We need to know which Org this instance belongs to.
        const { data: org } = await supabase
            .from("organizations")
            .select("id")
            .eq("whatsapp_instance_id", instanceId)
            .single();

        if (!org) {
            console.warn(`No organization found for instance ${instanceId}`);
            return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
        }

        // 3. Upsert Conversation
        // We link phone -> org
        const { data: convo } = await supabase
            .from("conversations")
            .upsert({
                phone,
                organization_id: org.id
            }, { onConflict: "phone" })
            .select("id, phone")
            .single();

        if (!convo) {
            return NextResponse.json({ ok: false, error: "Failed to create conversation" }, { status: 500 });
        }

        // 4. Anti-echo guard (avoid loop if outbound messages return as inbound)
        const { data: lastAiLog } = await supabase
            .from("conversation_logs")
            .select("message_content, timestamp")
            .eq("organization_id", org.id)
            .eq("client_phone", phone)
            .eq("sender", "ai")
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastAiLog?.message_content?.trim() === body.trim()) {
            const lastTs = new Date(lastAiLog.timestamp).getTime();
            const nowTs = Date.now();
            const withinWindow = nowTs - lastTs < 60_000; // 60s

            if (withinWindow) {
                console.log("[Webhook] Ignoring echo of last AI message.");
                return NextResponse.json({ ok: true, ignored_echo: true });
            }
        }

        // 5. Idempotency Check (Insert Message)
        const { error: insertError } = await supabase.from("inbound_messages").insert({
            conversation_id: convo.id,
            provider: "evolution",
            provider_message_id: providerMessageId,
            body,
        });

        if (insertError) {
            if (insertError.code === "23505") { // Unique violation
                console.log(`Duplicate message ${providerMessageId} ignored.`);
                return NextResponse.json({ ok: true, duplicated: true });
            }
            console.error("Error inserting message:", insertError);
            return NextResponse.json({ ok: false, error: "DB Error" }, { status: 500 });
        }

        // Log inbound message
        await supabase.from("conversation_logs").insert({
            organization_id: org.id,
            client_phone: phone,
            message_content: body,
            sender: "user"
        });

        // 6. Run Assistant Turn
        const clientName = data.pushName || undefined;
        const result = await runAssistantTurn({
            conversationId: convo.id,
            incomingText: body,
            organizationId: org.id,
            clientPhone: phone,
            clientName
        });

        // 7. Send Reply
        console.log(`[Webhook] Assistant returned reply: "${result.reply?.substring(0, 50)}..."`);
        if (result.reply && result.reply.trim()) {
            const evo = new EvolutionClient();
            await evo.sendText(instanceId, phone, result.reply);

            await supabase.from("conversation_logs").insert({
                organization_id: org.id,
                client_phone: phone,
                message_content: result.reply,
                sender: "ai"
            });
        }

        return NextResponse.json({ ok: true });

    } catch (e) {
        console.error("Webhook Error:", e);
        return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
    }
}
