"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getSystemSettings(keys: string[]) {
    const supabase = await createClient()

    // Check if user is super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) {
        return { error: "Unauthorized access" }
    }

    const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', keys)

    if (error) {
        console.error("Error fetching settings:", error)
        return { error: "Failed to fetch settings" }
    }

    // Convert array to object
    const settings: Record<string, string> = {}
    data?.forEach(item => {
        settings[item.key] = item.value
    })

    return { settings }
}

export async function updateSystemSetting(key: string, value: string) {
    const supabase = await createClient()

    // Check permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_super_admin) {
        return { error: "Unauthorized access" }
    }

    const { error } = await supabase
        .from('system_settings')
        .upsert({
            key,
            value,
            updated_at: new Date().toISOString()
        })

    if (error) {
        console.error("Error updating setting:", error)
        return { error: "Failed to update setting" }
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}
