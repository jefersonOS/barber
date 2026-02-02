"use server"

import { NewProfessionalForm } from "@/components/dashboard/professionals/new-professional-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function NewProfessionalPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/auth/login")
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Convidar Novo Profissional
            </h1>
            <p className="text-muted-foreground">
                Envie um convite via WhatsApp para o profissional se cadastrar na sua equipe.
            </p>

            <NewProfessionalForm />
        </div>
    )
}
