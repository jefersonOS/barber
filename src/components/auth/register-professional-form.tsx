"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { acceptInvite } from "@/app/actions/invite"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
    email: z.string().email("Email inválido."),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),
    confirmPassword: z.string().min(6, "Confirme sua senha."),
}).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
})

interface RegisterProfessionalFormProps {
    token: string
    initialName: string
    initialPhone: string
}

export function RegisterProfessionalForm({ token, initialName, initialPhone }: RegisterProfessionalFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            const result = await acceptInvite(token, values.email, values.password, initialName)

            if (result.error) {
                alert(result.error)
            } else {
                alert("Cadastro realizado com sucesso! Faça login para continuar.")
                router.push("/auth/login")
            }
        } catch (error) {
            console.error(error)
            alert("Erro ao realizar cadastro.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">Nome</label>
                    <Input value={initialName} disabled className="bg-slate-100" />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Telefone</label>
                    <Input value={initialPhone} disabled className="bg-slate-100" />
                </div>

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Seu Email (Login)</FormLabel>
                            <FormControl>
                                <Input placeholder="email@exemplo.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Crie uma Senha</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="******" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirme a Senha</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="******" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Concluir Cadastro
                </Button>
            </form>
        </Form>
    )
}
