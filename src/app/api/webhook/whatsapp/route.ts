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
            const remoteJid = messageData.key.remoteJid
            if (!remoteJid || remoteJid.includes('status')) { // Ignore status updates
                return NextResponse.json({ status: 'ignored' })
            }

            const content = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text
            const instanceId = body.instance; // Or however Evolution sends it

            if (!content) return NextResponse.json({ status: 'no-content' })

            const supabase = await createClient()

            const { data: org } = await supabase
                .from('organizations')
                .select('id, whatsapp_instance_id')
                .eq('whatsapp_instance_id', instanceId)
                .single()

            if (org) {
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
