import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function ServicesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Get user's org
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()

    if (!profile?.organization_id) return <div>No organization found.</div>

    const { data: services } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Services</h1>
                <Link href="/dashboard/services/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Service
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services?.map((service) => (
                    <Card key={service.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                {service.name}
                                <span className="text-sm font-normal text-muted-foreground">${service.price}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            <p className="mt-2 text-sm font-medium">{service.duration_min} mins</p>
                        </CardContent>
                    </Card>
                ))}
                {services?.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                        No services added yet.
                    </div>
                )}
            </div>
        </div>
    )
}
