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
            {/* Title moved to ScheduleView for client-side translation */}
            <ScheduleView
                organizationId={profile?.organization_id}
                userRole={profile?.role}
                userId={user.id}
            />
        </div>
    )
}
