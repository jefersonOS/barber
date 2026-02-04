"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getAISystemPrompt, saveAISystemPrompt } from "@/app/actions/settings"
import { useEffect, useState } from "react"

interface AIPromptEditorProps {
    organizationId: string
}

export function AIPromptEditor({ organizationId }: AIPromptEditorProps) {
    const [prompt, setPrompt] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState("")

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
        setMessage("")
        const result = await saveAISystemPrompt(organizationId, prompt)

        if (result.error) {
            setMessage(`Erro: ${result.error}`)
        } else {
            setMessage("✅ Prompt salvo com sucesso!")
        }
        setSaving(false)

        // Clear message after 3 seconds
        setTimeout(() => setMessage(""), 3000)
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
                <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        {prompt.length} caracteres
                    </p>
                    {message && (
                        <p className="text-sm font-medium text-green-600">
                            {message}
                        </p>
                    )}
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Prompt"}
                </Button>
            </div>
        </div>
    )
}
