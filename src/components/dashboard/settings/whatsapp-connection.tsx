"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Copy, QrCode, RefreshCcw, Wifi, WifiOff } from "lucide-react"
import { useState } from "react"

interface WhatsAppConnectionProps {
    organization: {
        id: string
        name: string
        whatsapp_instance_id: string | null
    }
}

export function WhatsAppConnection({ organization }: WhatsAppConnectionProps) {
    const { t } = useLanguage()
    /* 
       Mock status for now. In a real scenario, we would retrieve this from 
       the backend which queries Evolution API. 
    */
    const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')
    const [loading, setLoading] = useState(false)

    const instanceId = organization.whatsapp_instance_id || "user_" + organization.id.split('-')[0]
    const webhookUrl = `https://barber-saas-api.vercel.app/api/webhook/${organization.id}`

    function handleConnect() {
        setLoading(true)
        // Simulate API call to fetch QR Code
        setTimeout(() => {
            setLoading(false)
            alert("This would open the QR Code modal.")
        }, 1000)
    }

    function handleRefresh() {
        setLoading(true)
        setTimeout(() => {
            setLoading(false)
            // Mock random status toggle
            setStatus(prev => prev === 'connected' ? 'disconnected' : 'connected')
        }, 800)
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
                                <Button variant="outline" size="sm" className="w-full text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200">
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
                <div className="mt-6 flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="text-muted-foreground">
                        <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {t("whatsapp.btn.refresh")}
                    </Button>

                    <Button
                        onClick={handleConnect}
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
