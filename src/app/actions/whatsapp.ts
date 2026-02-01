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

    // Sanitize URL: Remove trailing slash and '/manager' if present
    // Users often copy the UI URL which ends in /manager
    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/, '').replace(/\/$/, '')

    // 1. Create Instance
    try {
        console.log(`Attempting to create instance at: ${baseUrl}/instance/create`)

        let qrCode = null;
        let createSuccess = false;

        const createRes = await fetch(`${baseUrl}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                instanceName: instanceName,
                token: crypto.randomUUID(),
                qrcode: true,
                integration: "WHATSAPP-BAILEYS" // Explicit integration type
            })
        })

        if (!createRes.ok) {
            // Check for Duplicate Instance error (403 usually for duplicates in some versions, or 400)
            // Error text usually contains "already exists" or similar
            const errorText = await createRes.text()
            if (createRes.status === 403 || errorText.includes("already exists") || errorText.includes("Duplicate")) {
                console.log("Instance already exists. Proceeding to connect...")
                createSuccess = true;
            } else {
                console.error("Evolution Create Error:", createRes.status, createRes.statusText, errorText)
                return { error: `Failed to create instance (${createRes.status}): ${errorText || createRes.statusText}` }
            }
        } else {
            const createData = await createRes.json()
            qrCode = createData.qrcode
            createSuccess = true;
        }

        // 1.5 Fetch QR Code if not present (or if instance existed)
        // We only fetch if we don't have it yet, to ensure we get a fresh one or the current one.
        if (!qrCode) {
            console.log("Fetching QR Code via /instance/connect...")
            const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: {
                    'apikey': EVOLUTION_API_KEY
                }
            })

            if (connectRes.ok) {
                const connectData = await connectRes.json()
                qrCode = connectData.base64 || connectData.qrcode
            } else {
                console.warn("Failed to fetch QR Code via connect endpoint.", await connectRes.text())
            }
        }

        // 2. Configure Webhook (Double Shot)
        const host = (await headers()).get('host')
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
        const webhookUrl = `${protocol}://${host}/api/webhook/whatsapp`

        console.log(`Configuring webhook at: ${baseUrl}/webhook/set/${instanceName}`)

        const webhookPayload = {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: true,
            events: [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGE_ACK",
                "WHATSAPP_CONNECTION_OPEN",
                "WHATSAPP_CONNECTION_CLOSE",
                "WHATSAPP_QR_CODE"
            ],
            // Nested webhook for compatibility ("Double Shot")
            webhook: {
                enabled: true,
                url: webhookUrl,
                webhookByEvents: false,
                webhookBase64: true,
                events: [
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE",
                    "MESSAGE_ACK",
                    "WHATSAPP_CONNECTION_OPEN",
                    "WHATSAPP_CONNECTION_CLOSE",
                    "WHATSAPP_QR_CODE"
                ]
            }
        }

        const webhookRes = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify(webhookPayload)
        })

        if (!webhookRes.ok) {
            console.error("Evolution Webhook Error:", await webhookRes.text())
            // Proceed anyway as instance might be working
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
            qrCode: typeof qrCode === 'string' ? { base64: qrCode } : qrCode // Normalize return
        }

    } catch (error) {
        console.error("Evolution Integration Error:", error)
        return { error: "Internal Server Error during Evolution setup." }
    }
}
