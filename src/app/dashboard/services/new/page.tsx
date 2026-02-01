"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const formSchema = z.object({
    name: z.string().min(2, "Name is required"),
    description: z.string().optional(),
    duration_min: z.coerce.number().min(5, "Duration must be at least 5 minutes"),
    price: z.coerce.number().min(0, "Price must be positive"),
})

export default function NewServicePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            duration_min: 30,
            price: 0,
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Not authenticated")

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
            if (!profile) throw new Error("No profile found")

            const { error } = await supabase.from('services').insert({
                organization_id: profile.organization_id,
                name: values.name,
                description: values.description,
                duration_min: values.duration_min,
                price: values.price,
            })

            if (error) throw error

            router.push("/dashboard/services")
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to create service")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/services">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">New Service</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Service Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Service Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Haircut" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Detailed description..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="duration_min"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duration (minutes)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Price ($)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Saving..." : "Create Service"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
