import { ScheduleView } from "@/components/dashboard/schedule/schedule-view"
import { createClient } from "@/lib/supabase/server"

export default async function SchedulePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()

    // Pass organization ID to client component to fetch data
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
            </div>
            <ScheduleView organizationId={profile?.organization_id} />
        </div>
    )
}
