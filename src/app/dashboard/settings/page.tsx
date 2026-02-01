"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

export default function SettingsPage() {
    const { t } = useLanguage()

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">{t("navbar.settings")}</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Organization Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Settings configuration will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    )
}
