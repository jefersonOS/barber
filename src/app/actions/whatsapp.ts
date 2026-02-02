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
                "SEND_MESSAGE_UPDATE",
                "CONNECTION_UPDATE",
                "QRCODE_UPDATED"
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
                    "SEND_MESSAGE_UPDATE",
                    "CONNECTION_UPDATE",
                    "QRCODE_UPDATED"
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

        // ...existing code...
    } catch (error) {
        console.error("Evolution Integration Error:", error)
        return { error: "Internal Server Error during Evolution setup." }
    }
}

export async function getEvolutionConnectionStatus(instanceId: string) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return { error: "Evolution API configuration missing." }
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/, '').replace(/\/$/, '')

    try {
        const response = await fetch(`${baseUrl}/instance/connectionState/${instanceId}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY
            },
            cache: 'no-store'
        })

        if (!response.ok) {
            // Se der 404, provavelmente a instância não existe ou está desconectada/fechada
            if (response.status === 404) {
                return { status: 'disconnected', state: 'notFound' }
            }
            console.error("Error fetching connection state:", await response.text())
            // Retorna disconnected por segurança
            return { status: 'disconnected', state: 'error' }
        }

        const data = await response.json()
        // Evolution retorna algo como { instance: {...}, state: 'open' | 'close' | 'connecting' }
        // Ou diretamente { state: 'open' } dependendo da versão v2.

        // Verifica o formato. Normalmente data.instance.state ou data.state
        const state = data?.instance?.state || data?.state || 'close'

        if (state === 'open') {
            return { status: 'connected', state: 'open' }
        } else {
            return { status: 'disconnected', state: state }
        }

        // ...existing code...
    } catch (error) {
        console.error("Evolution Status Check Error:", error)
        return { status: 'disconnected', error: "Failed to check status" }
    }
}

export async function deleteEvolutionInstance(organizationId: string) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return { error: "Evolution API configuration missing." }
    }

    const supabase = await createClient()

    // 1. Get Instance ID
    const { data: org } = await supabase.from('organizations').select('whatsapp_instance_id').eq('id', organizationId).single()

    if (!org?.whatsapp_instance_id) {
        return { error: "No instance found for this organization." }
    }

    const instanceName = org.whatsapp_instance_id
    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/, '').replace(/\/$/, '')

    try {
        // 2. Logout (optional but good practice)
        await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': EVOLUTION_API_KEY }
        })

        // 3. Delete Instance
        const deleteRes = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': EVOLUTION_API_KEY }
        })

        if (!deleteRes.ok) {
            // Even if it fails, we might want to clear DB if it was 404 (already gone).
            // But let's log it.
            console.warn("Delete instance failed or already deleted:", await deleteRes.text())
        }

        // 4. Update DB
        const { error: dbError } = await supabase
            .from('organizations')
            .update({ whatsapp_instance_id: null })
            .eq('id', organizationId)

        if (dbError) {
            return { error: "Failed to clear instance from database." }
        }

        return { success: true }

        // ...existing code...
    } catch (error) {
        console.error("Evolution Delete Error:", error)
        return { error: "Failed to disconnect." }
    }
}

export async function configureEvolutionWebhook(organizationId: string) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return { error: "Evolution API configuration missing." }
    }

    const supabase = await createClient()

    // 1. Get Instance ID
    const { data: org } = await supabase.from('organizations').select('whatsapp_instance_id').eq('id', organizationId).single()

    if (!org?.whatsapp_instance_id) {
        return { error: "No instance found for this organization." }
    }

    const instanceName = org.whatsapp_instance_id
    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/, '').replace(/\/$/, '')

    // 2. Configure Webhook
    const host = (await headers()).get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const webhookUrl = `${protocol}://${host}/api/webhook/whatsapp`

    console.log(`Configuring webhook manually for: ${instanceName} at ${webhookUrl}`)

    const webhookPayload = {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED"
        ],
        webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: true,
            events: [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "SEND_MESSAGE_UPDATE",
                "CONNECTION_UPDATE",
                "QRCODE_UPDATED"
            ]
        }
    }

    try {
        const webhookRes = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify(webhookPayload)
        })

        if (!webhookRes.ok) {
            const errorText = await webhookRes.text()
            console.error("Evolution Webhook Manual Config Error:", errorText)
            return { error: `Failed to configure webhook: ${errorText}` }
        }

        return { success: true }
    } catch (error) {
        console.error("Evolution Webhook Manual Config Exception:", error)
        return { error: "Internal Error configuring webhook." }
    }
}
