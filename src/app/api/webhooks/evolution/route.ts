import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAssistantTurn } from "@/lib/assistant/runAssistantTurn";
import { EvolutionClient } from "@/lib/evolution/client";

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
        const body = data.message?.conversation || data.message?.extendedTextMessage?.text;
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

        // 4. Idempotency Check (Insert Message)
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

        // 5. Run Assistant Turn
        const result = await runAssistantTurn({
            conversationId: convo.id,
            incomingText: body,
            organizationId: org.id
        });

        // 6. Send Reply
        if (result.reply && result.reply.trim()) {
            const evo = new EvolutionClient();
            await evo.sendText(instanceId, phone, result.reply);
        }

        return NextResponse.json({ ok: true });

    } catch (e) {
        console.error("Webhook Error:", e);
        return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
    }
}
