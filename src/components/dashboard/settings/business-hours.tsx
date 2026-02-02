"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save } from "lucide-react"
import { getBusinessHours, saveBusinessHours, type BusinessHour } from "@/app/actions/settings"
import { useLanguage } from "@/contexts/language-context"

const DAYS = [
    "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
]

// Generate time slots (00:00 to 23:30)
const TIME_SLOTS = Array.from({ length: 48 }).map((_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, '0')
    const min = (i % 2 === 0 ? '00' : '30')
    return `${hour}:${min}`
})

export function BusinessHoursScheduler({ organizationId }: { organizationId: string }) {
    const { t } = useLanguage()
    const [hours, setHours] = useState<BusinessHour[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const data = await getBusinessHours(organizationId)

            // Fill missing days with defaults
            const completeData: BusinessHour[] = DAYS.map((_, index) => {
                const existing = data.find(h => h.day_of_week === index)
                return existing || {
                    day_of_week: index,
                    start_time: "09:00",
                    end_time: "18:00",
                    is_closed: index === 0 // Default Sunday closed
                }
            })

            setHours(completeData)
            setLoading(false)
        }
        load()
    }, [organizationId])

    const handleUpdate = (index: number, field: keyof BusinessHour, value: any) => {
        const newHours = [...hours]
        newHours[index] = { ...newHours[index], [field]: value }
        setHours(newHours)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await saveBusinessHours(organizationId, hours)
            alert("Horários salvos com sucesso!")
        } catch (error) {
            alert("Erro ao salvar.")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-4"><Loader2 className="animate-spin" /></div>

    return (
        <Card>
            <CardHeader>
                <CardTitle>Horários de Funcionamento</CardTitle>
                <CardDescription>Configure os dias e horários que a barbearia está aberta.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {hours.map((day, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-4 min-w-[150px]">
                                <Switch
                                    checked={!day.is_closed}
                                    onCheckedChange={(checked) => handleUpdate(index, 'is_closed', !checked)}
                                />
                                <Label className={day.is_closed ? "text-muted-foreground" : "font-medium"}>
                                    {DAYS[index]}
                                </Label>
                            </div>

                            {!day.is_closed ? (
                                <div className="flex items-center gap-2">
                                    <Select value={day.start_time.substring(0, 5)} onValueChange={(val) => handleUpdate(index, 'start_time', val)}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <span>até</span>
                                    <Select value={day.end_time.substring(0, 5)} onValueChange={(val) => handleUpdate(index, 'end_time', val)}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <span className="text-sm text-muted-foreground italic px-2">Fechado</span>
                            )}
                        </div>
                    ))}

                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Salvar Horários
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
