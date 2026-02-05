import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAssistantTurn } from '@/lib/assistant/runAssistantTurn'
import { EvolutionClient } from '@/lib/evolution/client'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        // Evolution API payload structure variants need to be handled.
        // Assuming 'messages.upsert' or similar.

        // Minimal verification

        const event = body.event
        const data = body.data

        if (event === 'messages.upsert') {
            const messageData = data
            const key = messageData.key || {}

            // 1. Security & Relevance Filters
            if (key.fromMe) return NextResponse.json({ status: 'ignored_from_me' })
            if (key.remoteJid && key.remoteJid.includes('@g.us')) return NextResponse.json({ status: 'ignored_group' })
            if (key.remoteJid && key.remoteJid.includes('status')) return NextResponse.json({ status: 'ignored_status' })

            const remoteJid = key.remoteJid
            const content = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text
            const instanceId = body.instance || body.sender // Check both just in case
            const clientName = messageData.pushName || undefined

            if (!content) return NextResponse.json({ status: 'no-content' })
            if (!remoteJid) return NextResponse.json({ status: 'no-sender' })

            const supabase = await createClient()

            const { data: org } = await supabase
                .from('organizations')
                .select('id, whatsapp_instance_id')
                .eq('whatsapp_instance_id', instanceId)
                .single()

            if (org) {
                const { data: convo } = await supabase
                    .from('conversations')
                    .upsert({
                        phone: remoteJid,
                        organization_id: org.id
                    }, { onConflict: 'phone' })
                    .select('id')
                    .single()

                if (!convo) {
                    return NextResponse.json({ status: 'conversation_error' }, { status: 500 })
                }

                const { data: lastAiLog } = await supabase
                    .from('conversation_logs')
                    .select('message_content, timestamp')
                    .eq('organization_id', org.id)
                    .eq('client_phone', remoteJid)
                    .eq('sender', 'ai')
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (lastAiLog && lastAiLog.message_content?.trim() === content.trim()) {
                    const lastTsRaw = lastAiLog.timestamp
                    if (lastTsRaw) {
                        const lastTs = new Date(lastTsRaw).getTime()
                        const nowTs = Date.now()
                        if (nowTs - lastTs < 60_000) {
                            return NextResponse.json({ status: 'ignored_echo' })
                        }
                    }
                }

                const { error: insertError } = await supabase.from('inbound_messages').insert({
                    conversation_id: convo.id,
                    provider: 'whatsapp',
                    provider_message_id: key.id,
                    body: content,
                })

                if (insertError) {
                    if (insertError.code === '23505') {
                        return NextResponse.json({ status: 'duplicated' })
                    }
                    return NextResponse.json({ status: 'db_error' }, { status: 500 })
                }

                // Log User Message
                await supabase.from('conversation_logs').insert({
                    organization_id: org.id,
                    client_phone: remoteJid,
                    message_content: content,
                    sender: 'user'
                })

                const result = await runAssistantTurn({
                    conversationId: convo.id,
                    incomingText: content,
                    organizationId: org.id,
                    clientPhone: remoteJid,
                    clientName
                })

                if (result.reply && result.reply.trim()) {
                    // Log AI Message
                    await supabase.from('conversation_logs').insert({
                        organization_id: org.id,
                        client_phone: remoteJid,
                        message_content: result.reply,
                        sender: 'ai'
                    })

                    // Send via Evolution API
                    const evolution = new EvolutionClient()
                    const targetInstance = instanceId || org.whatsapp_instance_id
                    if (targetInstance) {
                        await evolution.sendText(targetInstance, remoteJid, result.reply)
                    }
                }

            } else {
                console.warn(`No organization found for instance: ${instanceId}`)
            }

            return NextResponse.json({ status: 'processed' })
        }

        return NextResponse.json({ status: 'ok' })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
