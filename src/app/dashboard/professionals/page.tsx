"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/language-context"

export default function ProfessionalsPage() {
    const [professionals, setProfessionals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { t } = useLanguage()
    const supabase = createClient()

    useEffect(() => {
        async function fetchProfessionals() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
            if (!profile?.organization_id) return

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', profile.organization_id)

            setProfessionals(data || [])
            setLoading(false)
        }
        fetchProfessionals()
    }, [])

    if (loading) return <div>{t("common.loading")}</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t("professionals.title")}</h1>
                <Link href="/dashboard/professionals/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Profissional
                    </Button>
                </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {professionals.map((pro) => (
                    <Card key={pro.id}>
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Avatar>
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pro.full_name}`} />
                                <AvatarFallback>{pro.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-base">{pro.full_name}</CardTitle>
                                <p className="text-xs text-muted-foreground capitalize">{pro.role}</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{pro.phone}</p>
                        </CardContent>
                    </Card>
                ))}
                {professionals.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                        {t("professionals.empty")}
                    </div>
                )}
            </div>
        </div>
    )
}
