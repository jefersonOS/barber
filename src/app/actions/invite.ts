"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Helper to get admin client
function getAdminClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("SUPABASE_SERVICE_ROLE_KEY is missing")
        return null
    }
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function getInvite(token: string) {
    const supabaseAdmin = getAdminClient()
    if (!supabaseAdmin) return null

    try {
        const { data, error } = await supabaseAdmin
            .from('professional_invites')
            .select('*, organizations(name)')
            .eq('token', token)
            .eq('status', 'pending')
            .single()

        if (error) {
            console.error("Error fetching invite:", error)
            return null
        }
        return data
    } catch (e) {
        console.error("Unexpected error in getInvite:", e)
        return null
    }
}

export async function acceptInvite(token: string, email: string, password: string, name: string) {
    const supabaseAdmin = getAdminClient()
    if (!supabaseAdmin) return { error: "Erro interno: Chave de API não configurada." }

    // 1. Validate Invite
    const invite = await getInvite(token)
    if (!invite) return { error: "Convite inválido ou expirado." }

    // 2. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
    })

    if (authError) return { error: authError.message }
    if (!authData.user) return { error: "Erro ao criar usuário." }

    // 3. Create Profile (Linked to Org)
    // Profile creation might be handled by trigger, but we need to ensure correct data
    // Let's upsert to be safe or rely on trigger if it exists. 
    // Looking at schema: no auto-create trigger seen in previous migrations (except 006 maybe?)
    // Safe to insert/update.
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: authData.user.id,
        organization_id: invite.organization_id,
        full_name: name,
        phone: invite.phone,
        role: 'professional'
    })

    if (profileError) {
        // Rollback user creation? Hard with admin api, better to just error.
        console.error("Profile creation error", profileError)
        return { error: "Erro ao criar perfil. Contate o suporte." }
    }

    // 4. Update Invite Status
    await supabaseAdmin.from('professional_invites').update({ status: 'accepted' }).eq('id', invite.id)

    return { success: true }
}
