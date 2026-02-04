"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getAISystemPrompt, saveAISystemPrompt } from "@/app/actions/settings"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface AIPromptEditorProps {
    organizationId: string
}

export function AIPromptEditor({ organizationId }: AIPromptEditorProps) {
    const [prompt, setPrompt] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        async function loadPrompt() {
            const data = await getAISystemPrompt(organizationId)
            if (data) {
                setPrompt(data)
            }
            setLoading(false)
        }
        loadPrompt()
    }, [organizationId])

    async function handleSave() {
        setSaving(true)
        const result = await saveAISystemPrompt(organizationId, prompt)

        if (result.error) {
            toast({
                title: "Erro",
                description: result.error,
                variant: "destructive"
            })
        } else {
            toast({
                title: "Sucesso",
                description: "Prompt do AI salvo com sucesso!"
            })
        }
        setSaving(false)
    }

    if (loading) return <div>Carregando...</div>

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Prompt do Assistente AI</h3>
                <p className="text-sm text-muted-foreground">
                    Personalize o comportamento do assistente de agendamento via WhatsApp
                </p>
            </div>

            <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Digite o prompt do sistema..."
                className="min-h-[400px] font-mono text-sm"
            />

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {prompt.length} caracteres
                </p>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Prompt"}
                </Button>
            </div>
        </div>
    )
}
