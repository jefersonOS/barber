"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type BusinessHour = {
    id?: string
    day_of_week: number
    start_time: string
    end_time: string
    is_closed: boolean
}

export async function getBusinessHours(organizationId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('organization_id', organizationId)
        .order('day_of_week', { ascending: true })

    if (error) {
        console.error("Error fetching business hours:", error)
        return []
    }

    // Initialize defaults if missing (client-side logic usually, but helper here is nice)
    // Actually, let's just return what's in DB.
    return data as BusinessHour[]
}

export async function saveBusinessHours(organizationId: string, hours: BusinessHour[]) {
    const supabase = await createClient()

    // Upsert logic
    // We map the incoming hours to include organization_id and handle the upsert
    const upsertData = hours.map(h => ({
        organization_id: organizationId,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_closed: h.is_closed,
        // if id exists, it will update, usually upsert works on unique constraint (org_id, day)
    }))

    const { error } = await supabase
        .from('business_hours')
        .upsert(upsertData, { onConflict: 'organization_id, day_of_week' })

    if (error) {
        console.error("Error saving business hours:", error)
        return { error: "Failed to save settings." }
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
}
