"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"

const formSchema = z.object({
    clientName: z.string().min(2, "Client name is required"),
    clientPhone: z.string().min(8, "Phone is required"),
    serviceId: z.string().min(1, "Select a service"),
    professionalId: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    time: z.string().min(1, "Time is required"),
})

interface NewAppointmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    organizationId: string
    onSuccess: () => void
}

export function NewAppointmentDialog({ open, onOpenChange, organizationId, onSuccess }: NewAppointmentDialogProps) {
    const { t } = useLanguage()
    const [loading, setLoading] = useState(false)
    const [services, setServices] = useState<any[]>([])
    const [professionals, setProfessionals] = useState<any[]>([])
    const supabase = createClient()

    useEffect(() => {
        if (open) {
            loadData()
        }
    }, [open])

    async function loadData() {
        const { data: servicesData } = await supabase.from('services').select('*').eq('organization_id', organizationId)
        const { data: profilesData } = await supabase.from('profiles').select('*').eq('organization_id', organizationId)

        if (servicesData) setServices(servicesData)
        if (profilesData) setProfessionals(profilesData)
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            clientName: "",
            clientPhone: "",
            serviceId: "",
            professionalId: "",
            date: new Date().toISOString().split('T')[0],
            time: "10:00",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            const startDateTime = new Date(`${values.date}T${values.time}`)

            const service = services.find(s => s.id === values.serviceId)
            const duration = service ? service.duration_min : 30
            const endDateTime = new Date(startDateTime.getTime() + duration * 60000)

            const { error } = await supabase.from('appointments').insert({
                organization_id: organizationId,
                client_name: values.clientName,
                client_phone: values.clientPhone,
                service_id: values.serviceId,
                professional_id: values.professionalId || null,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                status: 'confirmed',
            })

            if (error) throw error

            onSuccess()
            onOpenChange(false)
            form.reset()
        } catch (error) {
            console.error(error)
            alert(t("common.error"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t("dialog.newAppointment.title")}</DialogTitle>
                    <DialogDescription>
                        {t("dialog.newAppointment.description")}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="clientName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("dialog.clientName")}</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="clientPhone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("dialog.phone")}</FormLabel>
                                    <FormControl>
                                        <Input placeholder="(11) 99999-9999" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="serviceId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("dialog.service")}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t("dialog.selectService")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {services.map((service) => (
                                                <SelectItem key={service.id} value={service.id}>
                                                    {service.name} ({service.duration_min} min)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="professionalId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("dialog.professional")}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t("dialog.anyProfessional")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {professionals.map((pro) => (
                                                <SelectItem key={pro.id} value={pro.id}>
                                                    {pro.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("dialog.date")}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("dialog.time")}</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>{loading ? t("dialog.saving") : t("dialog.create")}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
