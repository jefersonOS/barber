"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getSystemSettings, updateSystemSetting } from "@/app/actions/admin-settings"
import { AIPromptEditor } from "@/components/dashboard/settings/ai-prompt-editor"
// Wait, I saw the list_dir earlier and 'tabs.tsx' was NOT in components/ui.
// I will simulate Tabs with state to be safe and avoid errors, as planned.

export default function AdminDashboardPage() {
    const { t } = useLanguage()
    const [orgs, setOrgs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("overview")
    const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

    // Settings State
    const [openaiKey, setOpenaiKey] = useState("")
    const [settingsLoading, setSettingsLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        async function fetchOrgs() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
                if (profile?.organization_id) {
                    setCurrentOrgId(profile.organization_id)
                }
            }

            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false })

            if (data) setOrgs(data)
            setLoading(false)
        }
        fetchOrgs()
    }, [])

    useEffect(() => {
        if (activeTab === 'settings') {
            loadSettings()
        }
    }, [activeTab])

    async function loadSettings() {
        setSettingsLoading(true)
        const result = await getSystemSettings(['openai_api_key'])
        if (result.settings) {
            setOpenaiKey(result.settings.openai_api_key || "")
        }
        setSettingsLoading(false)
    }

    async function handleSaveSettings() {
        setSettingsLoading(true)
        try {
            await updateSystemSetting('openai_api_key', openaiKey)
            alert("Settings saved successfully")
        } catch (error) {
            alert("Failed to save settings")
        } finally {
            setSettingsLoading(false)
        }
    }

    if (loading) return <div>{t("common.loading")}</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">SaaS Management</h1>
                <Badge variant="outline" className="px-4 py-1 text-sm bg-primary/10 text-primary border-primary/20">
                    Super Admin
                </Badge>
            </div>

            {/* Custom Tabs Navigation */}
            <div className="flex space-x-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 w-fit">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "overview"
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-slate-50"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                        }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "settings"
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-slate-50"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                        }`}
                >
                    System Settings
                </button>
            </div>

            {activeTab === "overview" && (
                <div className="space-y-6">
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
            )}

            {activeTab === "settings" && (
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Integration</CardTitle>
                            <CardDescription>Configure global AI settings for the platform.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="openai-key">OpenAI API Key</Label>
                                <Input
                                    id="openai-key"
                                    type="password"
                                    placeholder="sk-..."
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This key will be used for system-wide AI features.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveSettings} disabled={settingsLoading}>
                                {settingsLoading ? "Saving..." : "Save Settings"}
                            </Button>
                        </CardFooter>
                    </Card>

                    {currentOrgId && (
                        <Card>
                            <CardHeader>
                                <CardTitle>AI System Prompt</CardTitle>
                                <CardDescription>Customize the AI assistant behavior for your organization.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AIPromptEditor organizationId={currentOrgId} />
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
}
