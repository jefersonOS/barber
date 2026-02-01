"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/language-context"

export default function ServicesPage() {
    const [services, setServices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { t } = useLanguage()
    const supabase = createClient()

    useEffect(() => {
        async function fetchServices() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
            if (!profile?.organization_id) return

            const { data } = await supabase
                .from('services')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .order('created_at', { ascending: false })

            setServices(data || [])
            setLoading(false)
        }
        fetchServices()
    }, [])

    if (loading) return <div>{t("common.loading")}</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t("services.title")}</h1>
                <Link href="/dashboard/services/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> {t("services.add")}
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                    <Card key={service.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                {service.name}
                                <span className="text-sm font-normal text-muted-foreground">${service.price}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            <p className="mt-2 text-sm font-medium">{service.duration_min} {t("services.mins")}</p>
                        </CardContent>
                    </Card>
                ))}
                {services.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                        {t("services.empty")}
                    </div>
                )}
            </div>
        </div>
    )
}
