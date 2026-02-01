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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

// Schema for organization creation
const formSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
    phone: z.string().min(10, "Phone number is required for profile"),
    fullName: z.string().min(2, "Full name is required"),
})

export default function OnboardingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            slug: "",
            phone: "",
            fullName: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        setError(null)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                throw new Error("No authenticated user found. Please login.")
            }

            // 1. Create Organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: values.name,
                    slug: values.slug,
                })
                .select()
                .single()

            if (orgError) {
                if (orgError.code === '23505') { // Unique violation for slug
                    throw new Error("This URL identifier (slug) is already taken. Please choose another.")
                }
                throw new Error(`Failed to create organization: ${orgError.message}`)
            }

            // 2. Create Profile (Admin/Owner)
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id, // Link to Auth User
                    organization_id: org.id,
                    role: 'owner',
                    full_name: values.fullName,
                    phone: values.phone,
                })

            if (profileError) {
                // Rollback? Ideally yes, but hard without transactions/functions.
                // For MVP, we catch error and show it.
                throw new Error(`Failed to create profile: ${profileError.message}`)
            }

            // Success
            router.push("/dashboard")
            router.refresh()

        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Welcome to Your New Barber Management System</CardTitle>
                    <CardDescription>Let&apos;s set up your barbershop details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Barbershop Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Cool Cuts Barbershop" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="slug"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL Identifier (Slug)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="cool-cuts" {...field} />
                                        </FormControl>
                                        <FormDescription>Your unique ID. Used for your shop&apos;s URL.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Your Full Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="John Doe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Your Phone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="(11) 99999-9999" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Setting up..." : "Complete Setup"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
