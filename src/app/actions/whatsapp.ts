"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY

export async function createEvolutionInstance(organizationId: string) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return { error: "Evolution API configuration missing." }
    }

    const instanceName = `user_${organizationId.replace(/-/g, '')}`
    const supabase = await createClient()

    // 1. Create Instance
    try {
        const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                instanceName: instanceName,
                token: crypto.randomUUID(), // specific token for this instance
                qrcode: true,
            })
        })

        if (!createRes.ok) {
            const errorText = await createRes.text()
            console.error("Evolution Create Error:", errorText)
            return { error: `Failed to create instance: ${createRes.statusText}` }
        }

        const createData = await createRes.json()

        // 2. Configure Webhook
        // Note: The URL is constructed based on the current app deployment
        // In production, this should be a fixed env var or derived from headers
        const host = (await headers()).get('host')
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
        const webhookUrl = `${protocol}://${host}/api/webhook/whatsapp`

        const webhookRes = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                webhookUrl: webhookUrl,
                webhookByEvents: false, // If false, sends all? Or need to specify?
                webhookBase64: true, // Requested by user
                events: [
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE",
                    "MESSAGE_ACK",
                    "WHATSAPP_CONNECTION_OPEN",
                    "WHATSAPP_CONNECTION_CLOSE",
                    "WHATSAPP_QR_CODE"
                ],
                enabled: true
            })
        })

        if (!webhookRes.ok) {
            // Log but don't fail completely if webhook fails, maybe?
            console.error("Evolution Webhook Error:", await webhookRes.text())
        }

        // 3. Save to DB
        const { error: dbError } = await supabase
            .from('organizations')
            .update({ whatsapp_instance_id: instanceName })
            .eq('id', organizationId)

        if (dbError) {
            console.error("DB Error:", dbError)
            return { error: "Failed to save instance ID to database." }
        }

        return {
            success: true,
            instanceName,
            qrCode: createData.qrcode // Evolution v1 returns base64 qr in .qrcode or .base64 depending on version
        }

    } catch (error) {
        console.error("Evolution Integration Error:", error)
        return { error: "Internal Server Error during Evolution setup." }
    }
}
