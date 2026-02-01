"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client" // Note: Changed to client to use local hook, but usually we fetch server side first
import { SettingsForm } from "@/components/dashboard/settings/settings-form"
import { useLanguage } from "@/contexts/language-context"
import { useEffect, useState } from "react"

export default function SettingsPage() {
    const { t } = useLanguage()
    const [organization, setOrganization] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchOrganization() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
            if (!profile?.organization_id) return

            const { data } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', profile.organization_id)
                .single()

            setOrganization(data)
            setLoading(false)
        }
        fetchOrganization()
    }, [])

    if (loading) return <div>{t("common.loading")}</div>

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
            <Card>
                <CardHeader>
                    <CardTitle>{t("settings.orgSettings")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {organization && <SettingsForm organization={organization} />}
                </CardContent>
            </Card>
        </div>
    )
}
