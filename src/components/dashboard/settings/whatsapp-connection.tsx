"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Copy, QrCode, RefreshCcw, Wifi, WifiOff } from "lucide-react"
import { useState } from "react"
// ... imports
import { createEvolutionInstance, getEvolutionConnectionStatus, deleteEvolutionInstance, configureEvolutionWebhook } from "@/app/actions/whatsapp"
import { useEffect } from "react"

// ... inside component



// ... imports

interface WhatsAppConnectionProps {
    organization: {
        id: string
        name: string
        whatsapp_instance_id: string | null
    }
}

export function WhatsAppConnection({ organization }: WhatsAppConnectionProps) {
    const { t } = useLanguage()

    const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')
    const [loading, setLoading] = useState(false)
    const [qrCode, setQrCode] = useState<string | null>(null)

    const instanceId = organization.whatsapp_instance_id || "user_" + organization.id.split('-')[0]
    const webhookUrl = `https://barber-saas-api.vercel.app/api/webhook/${organization.id}`

    // Fetch initial status
    useEffect(() => {
        checkStatus()
    }, [instanceId])

    async function checkStatus() {
        if (!instanceId) return
        setLoading(true)
        try {
            const result = await getEvolutionConnectionStatus(instanceId)
            if (result && result.status) {
                setStatus(result.status as 'connected' | 'disconnected')
            }
        } catch (error) {
            console.error("Failed to check status", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleConfigureWebhook() {
        setLoading(true)
        try {
            const result = await configureEvolutionWebhook(organization.id)
            if (result.error) {
                alert(result.error)
            } else {
                alert(t("whatsapp.webhook_configured_success") || "Webhook configured successfully!")
            }
        } catch (error) {
            console.error("Webhook config error:", error)
            alert(t("common.error"))
        } finally {
            setLoading(false)
        }
    }

    async function handleDisconnect() {
        if (!confirm(t("whatsapp.confirm_disconnect"))) return

        setLoading(true)
        try {
            const result = await deleteEvolutionInstance(organization.id)
            if (result.error) {
                alert(result.error)
            } else {
                setStatus('disconnected')
                setQrCode(null)
            }
        } catch (error) {
            console.error("Disconnect error:", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleConnect() {
        setLoading(true)
        setQrCode(null)
        try {
            const result = await createEvolutionInstance(organization.id)

            if (result.error) {
                alert(result.error)
                return
            }

            if (result.qrCode && result.qrCode.base64) {
                setQrCode(result.qrCode.base64)
            } else if (typeof result.qrCode === 'string') {
                setQrCode(result.qrCode)
            }

            // Start polling for status change? For now, just refresh
            checkStatus()

        } catch (e) {
            console.error(e)
            alert(t("common.error"))
        } finally {
            setLoading(false)
        }
    }

    function handleRefresh() {
        checkStatus()
    }

    return (
        <Card className="border-border">
            <CardHeader>
                <CardTitle className="text-xl">{t("whatsapp.title")}</CardTitle>
                <CardDescription>
                    {t("whatsapp.description")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-slate-950 rounded-lg p-6 border border-slate-800 text-slate-100 flex flex-col md:flex-row gap-8 items-center md:items-start">

                    {/* Status Section - Centered or Top */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-4">
                        <div className={`rounded-full p-4 ${status === 'connected' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {status === 'connected' ? (
                                <Wifi className="h-8 w-8 text-green-500" />
                            ) : (
                                <WifiOff className="h-8 w-8 text-red-500" />
                            )}
                        </div>
                        <span className={`text-lg font-medium ${status === 'connected' ? 'text-green-500' : 'text-red-500'}`}>
                            {t(status === 'connected' ? "whatsapp.status.connected" : "whatsapp.status.disconnected")}
                        </span>
                    </div>

                    {/* Details Section */}
                    <div className="flex-[2] w-full space-y-4">
                        <div className="bg-slate-900 rounded p-4 space-y-3 font-mono text-sm border border-slate-800">
                            <div className="flex flex-col gap-1">
                                <span className="text-slate-400 text-xs uppercase font-semibold tracking-wider">{t("whatsapp.instance")}</span>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{instanceId}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => navigator.clipboard.writeText(instanceId)}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            <div className="h-px bg-slate-800" />

                            <div className="flex flex-col gap-1">
                                <span className="text-slate-400 text-xs uppercase font-semibold tracking-wider">{t("whatsapp.webhook")}</span>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs opacity-70">{webhookUrl}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                                    onClick={handleConfigureWebhook}
                                    disabled={loading}
                                >
                                    {t("whatsapp.btn.configure")}
                                </Button>
                            </div>

                            <p className="text-[10px] text-slate-500 leading-tight">
                                Use this button if webhook keys do not trigger automatically.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                {qrCode && (
                    <div className="flex justify-center p-6 bg-white rounded-lg mb-6">
                        <img src={qrCode} alt="WhatsApp QR Code" className="max-w-[250px]" />
                    </div>
                )}

                <div className="mt-6 flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="text-muted-foreground">
                        <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {t("whatsapp.btn.refresh")}
                    </Button>

                    <Button
                        onClick={status === 'connected' ? handleDisconnect : handleConnect}
                        disabled={loading}
                        className={status === 'connected' ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}
                    >
                        {status === 'connected' ? (
                            t("whatsapp.btn.disconnect")
                        ) : (
                            <>
                                <QrCode className="mr-2 h-4 w-4" />
                                {t("whatsapp.btn.connect")}
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
