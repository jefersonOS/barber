"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { format, startOfDay, endOfDay, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { NewAppointmentDialog } from "./new-appointment-dialog"
import { useLanguage } from "@/contexts/language-context"
import { ptBR, enUS } from "date-fns/locale"

interface ScheduleViewProps {
    organizationId: string
    userRole?: string
    userId?: string
}

export function ScheduleView({ organizationId, userRole, userId }: ScheduleViewProps) {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [appointments, setAppointments] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false)
    const { t, language } = useLanguage()

    const supabase = createClient()

    useEffect(() => {
        if (date && organizationId) {
            fetchAppointments(date)
        }
    }, [date, organizationId])

    async function fetchAppointments(selectedDate: Date) {
        setLoading(true)
        const start = startOfDay(selectedDate).toISOString()
        const end = endOfDay(selectedDate).toISOString()

        let query = supabase
            .from('appointments')
            .select('*, profiles(full_name), services(name)')
            .eq('organization_id', organizationId)
            .gte('start_time', start)
            .lte('start_time', end)
            .order('start_time', { ascending: true })

        if (userRole === 'professional' && userId) {
            query = query.eq('professional_id', userId)
        }

        const { data, error } = await query

        if (error) {
            console.error(error)
        } else {
            setAppointments(data || [])
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t("schedule.title")}</h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-auto">
                    <Card className="w-fit">
                        <CardContent className="p-0">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                className="rounded-md border"
                                locale={language === 'pt' ? ptBR : enUS}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold capitalize">
                            {date ? format(date, "MMMM d, yyyy", { locale: language === 'pt' ? ptBR : enUS }) : t("schedule.selectDate")}
                        </h2>
                        <Button onClick={() => setIsNewAppointmentOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> {t("schedule.newAppointment")}
                        </Button>
                    </div>

                    {loading ? (
                        <div>{t("schedule.loading")}</div>
                    ) : appointments.length === 0 ? (
                        <div className="text-muted-foreground p-8 border rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                            {t("schedule.noAppointments")}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {appointments.map((apt) => (
                                <Card key={apt.id}>
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-medium text-lg">
                                                {format(parseISO(apt.start_time), "HH:mm")} - {apt.client_name}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {apt.services?.name} • {apt.profiles?.full_name || "Unassigned"}
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium capitalize px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                                            {apt.status}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <NewAppointmentDialog
                open={isNewAppointmentOpen}
                onOpenChange={setIsNewAppointmentOpen}
                organizationId={organizationId}
                onSuccess={() => date && fetchAppointments(date)}
            />
        </div>
    )
}
