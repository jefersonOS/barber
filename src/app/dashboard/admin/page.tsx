"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export default function AdminDashboardPage() {
    const { t } = useLanguage()
    const [orgs, setOrgs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchOrgs() {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error("Error fetching organizations", error)
            } else {
                setOrgs(data || [])
            }
            setLoading(false)
        }
        fetchOrgs()
    }, [])

    if (loading) return <div>{t("common.loading")}</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">SaaS Management</h1>
                <Badge variant="outline" className="px-4 py-1 text-sm bg-primary/10 text-primary border-primary/20">
                    Super Admin
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenues (YTD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ 45.231,89</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orgs.filter(o => o.subscription_status === 'active').length}</div>
                        <p className="text-xs text-muted-foreground">Paying Customers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Trials</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orgs.filter(o => o.subscription_status === 'trial').length}</div>
                        <p className="text-xs text-muted-foreground">Potential conversions</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Organizations</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>WhatsApp</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orgs.map((org) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>
                                        {org.whatsapp_instance_id ? (
                                            <Badge variant="default" className="bg-green-600">Connected</Badge>
                                        ) : (
                                            <Badge variant="secondary">Not Connected</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={org.subscription_status === 'active' ? 'default' : 'outline'}>
                                            {org.subscription_status || 'Trial'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="capitalize">{org.subscription_plan || 'Pro'}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm">Manage</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
