import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
            const instanceId = body.instance || body.sender; // Check both just in case

            if (!content) return NextResponse.json({ status: 'no-content' })
            if (!remoteJid) return NextResponse.json({ status: 'no-sender' })

            const supabase = await createClient()

            const { data: org } = await supabase
                .from('organizations')
                .select('id, whatsapp_instance_id')
                .eq('whatsapp_instance_id', instanceId)
                .single()

            if (org) {
                const { data: lastAiLog } = await supabase
                    .from('conversation_logs')
                    .select('message_content, timestamp')
                    .eq('organization_id', org.id)
                    .eq('client_phone', remoteJid)
                    .eq('sender', 'ai')
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (lastAiLog?.message_content?.trim() === content.trim()) {
                    const lastTs = new Date(lastAiLog.timestamp).getTime()
                    const nowTs = Date.now()
                    if (nowTs - lastTs < 60_000) {
                        return NextResponse.json({ status: 'ignored_echo' })
                    }
                }

                // Log User Message
                await supabase.from('conversation_logs').insert({
                    organization_id: org.id,
                    client_phone: remoteJid,
                    message_content: content,
                    sender: 'user'
                })

                // Process AI Response
                const { processAIResponse } = await import('@/lib/ai/agent')
                const aiResponseText = await processAIResponse(org.id, remoteJid, content)

                if (aiResponseText) {
                    // Log AI Message
                    await supabase.from('conversation_logs').insert({
                        organization_id: org.id,
                        client_phone: remoteJid,
                        message_content: aiResponseText,
                        sender: 'ai'
                    })

                    // Send via Evolution API
                    const { EvolutionClient } = await import('@/lib/evolution/client')
                    const evolution = new EvolutionClient()
                    const targetInstance = instanceId || org.whatsapp_instance_id
                    if (targetInstance) {
                        await evolution.sendText(targetInstance, remoteJid, aiResponseText)
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
