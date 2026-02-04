"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateService(serviceId: string, data: {
    name?: string
    description?: string
    duration_min?: number
    price?: number
    deposit_percentage?: number | null
}) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('services')
        .update(data)
        .eq('id', serviceId)

    if (error) {
        console.error("Error updating service:", error)
        return { error: error.message || "Failed to update service." }
    }

    revalidatePath('/dashboard/services')
    return { success: true }
}

export async function deleteService(serviceId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId)

    if (error) {
        console.error("Error deleting service:", error)
        return { error: error.message || "Failed to delete service." }
    }

    revalidatePath('/dashboard/services')
    return { success: true }
}
