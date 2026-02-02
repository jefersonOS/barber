import { getInvite } from "@/app/actions/invite"
import { RegisterProfessionalForm } from "@/components/auth/register-professional-form"
import { notFound } from "next/navigation"

interface InvitePageProps {
    params: Promise<{
        token: string
    }>
}

export default async function InvitePage({ params }: InvitePageProps) {
    const { token } = await params
    const result = await getInvite(token)

    if (!result.success || !result.invite) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-slate-50 dark:bg-slate-900">
                <h1 className="text-2xl font-bold text-red-600 mb-2">Problema com o Convite</h1>
                <p className="text-muted-foreground mb-4">{result.error}</p>
                {result.errorCode === "CONFIG_ERROR" && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md text-sm max-w-md mx-auto">
                        <strong>Atenção Admin:</strong> A variável de ambiente <code>SUPABASE_SERVICE_ROLE_KEY</code> não está configurada na Vercel.
                    </div>
                )}
            </div>
        )
    }

    const { invite } = result

    //organization is nested
    const orgName = invite.organizations?.name || "Barbearia"

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Bem-vindo ao {orgName}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Olá <strong>{invite.name}</strong>! Complete seu cadastro para acessar a plataforma.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-950 p-6 rounded-lg shadow-sm border">
                    <RegisterProfessionalForm
                        token={token}
                        initialName={invite.name}
                        initialPhone={invite.phone}
                    />
                </div>
            </div>
        </div>
    )
}
