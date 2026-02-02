"use server"

import { createClient } from "@/lib/supabase/server"
import { EvolutionClient } from "@/lib/evolution/client"
import { randomBytes } from "crypto"

export async function inviteProfessional(name: string, phone: string) {
    const supabase = await createClient()

    // 1. Get current user's organization
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return { error: "Perfil não encontrado" }

    const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()

    // 2. Generate Token
    const token = randomBytes(20).toString('hex')

    // 3. Create Invite Record
    const { error } = await supabase.from('professional_invites').insert({
        organization_id: profile.organization_id,
        name,
        phone,
        token,
        status: 'pending'
    })

    if (error) {
        console.error(error)
        return { error: "Erro ao criar convite" }
    }

    // 4. Send WhatsApp Message
    if (org.whatsapp_instance_id) {
        const evo = new EvolutionClient()
        // Determine Public URL (use existing env or default to localhost for dev / vercel for prod)
        // Ideally should be set in .env
        const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

        // Clean URL to ensure valid link
        const baseUrl = publicUrl.startsWith('http') ? publicUrl : `https://${publicUrl}`
        const inviteLink = `${baseUrl}/invite/${token}`

        const message = `👋 Olá ${name}!\n\n💈 Você foi convidado para se juntar à equipe da **${org.name}**.\n\nPara concluir seu cadastro e acessar sua agenda, clique no link abaixo:\n👉 ${inviteLink}\n\nBem-vindo ao time!`

        try {
            await evo.sendText(org.whatsapp_instance_id, phone, message)
        } catch (e) {
            console.error("Failed to send invite via WhatsApp", e)
            return { warning: "Convite criado, mas falha ao enviar WhatsApp. Copie o link manualmente.", inviteLink }
        }
    } else {
        return { warning: "Instância WhatsApp não configurada. Copie o link.", inviteLink: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}` }
    }

    return { success: true }
}
