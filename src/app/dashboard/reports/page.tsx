"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

interface ReportsPageProps {
    data: {
        monthlyRevenue: any[]
        revenueByProfessional: any[]
    }
}

// In a real app this would be server component fetching data, 
// using client component for charts like below.
// For now, mocking structure.

import { useLanguage } from "@/contexts/language-context"

// ... imports

export default function ReportsPage() {
    const { t } = useLanguage()
    const data = [
        // ... data
    ]

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>{t("reports.revenueOverview")}</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={data}>
                                <XAxis
                                    dataKey="name"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip />
                                <Bar
                                    dataKey="total"
                                    fill="currentColor"
                                    radius={[4, 4, 0, 0]}
                                    className="fill-primary"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
