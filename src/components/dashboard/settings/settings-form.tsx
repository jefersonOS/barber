"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"
import { useState } from "react"
import { useRouter } from "next/navigation"

const formSchema = z.object({
    name: z.string().min(2, {
        message: "O nome deve ter pelo menos 2 caracteres.",
    }),
    whatsapp_instance_id: z.string().optional(),
})

interface SettingsFormProps {
    organization: {
        id: string
        name: string
        whatsapp_instance_id: string | null
    }
}

export function SettingsForm({ organization }: SettingsFormProps) {
    const { t } = useLanguage()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: organization.name,
            whatsapp_instance_id: organization.whatsapp_instance_id || "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: values.name,
                    whatsapp_instance_id: values.whatsapp_instance_id || null,
                })
                .eq('id', organization.id)

            if (error) throw error

            router.refresh()
            alert(t("settings.success"))
        } catch (error) {
            console.error(error)
            alert(t("common.error"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settings.orgName")}</FormLabel>
                            <FormControl>
                                <Input placeholder={t("settings.placeholder.name")} {...field} />
                            </FormControl>
                            <FormDescription>
                                {t("settings.orgNameDesc")}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="whatsapp_instance_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settings.whatsapp")}</FormLabel>
                            <FormControl>
                                <Input placeholder={t("settings.placeholder.instance")} {...field} />
                            </FormControl>
                            <FormDescription>
                                {t("settings.whatsappDesc")}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={loading}>
                    {loading ? t("settings.saving") : t("settings.save")}
                </Button>
            </form>
        </Form>
    )
}
