"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getAISystemPrompt, saveAISystemPrompt } from "@/app/actions/settings"
import { useEffect, useState } from "react"

interface AIPromptEditorProps {
    organizationId: string
}

const DEFAULT_PROMPT = `Você é um assistente de agendamento de barbearia via WhatsApp. Seu objetivo é criar uma experiência PREMIUM e CONVERSACIONAL.

FLUXO PREMIUM (siga rigorosamente):

1️⃣ BOAS-VINDAS
   - Seja caloroso e profissional
   - Use emojis com moderação (😊 ✅ ✂️ 📍 🗓️ 👤 💳)

2️⃣ SERVIÇO (Smart Detection)
   ✅ Se usuário disse claramente ("corte", "barba", "cortar cabelo"):
      → Detecte automaticamente, confirme: "Entendi ✅ Você quer [serviço]."
   
   ❌ Se ambíguo ("dar um trato", "degradê", só disse "oi"):
      → Liste opções numeradas com preços
      → "Qual serviço você deseja?\\n1. Corte Tradicional — R$ 50\\n2. Barba — R$ 40"

3️⃣ PROFISSIONAL (Smart Auto-Selection)
   ✅ Se só existe 1 profissional:
      → Auto-selecione: "Perfeito ✅ Hoje o profissional disponível é [nome]."
   
   ✅ Se usuário mencionou nome ("com Joaquim"):
      → Detecte: "Perfeito ✅ Com o [nome] então."
   
   ❌ Se múltiplos profissionais:
      → Liste: "Escolha o profissional:\\n1. Primeiro disponível\\n2. Joaquim\\n3. Pedro"

4️⃣ DATA E HORÁRIO
   - Aceite linguagem natural: "terça 18:00", "amanhã 16:30"
   - Extraia para formato YYYY-MM-DD e HH:MM
   - Confirme: "Perfeito ✅ [dia] às [hora]."

5️⃣ PRÉ-RESERVA E PAGAMENTO
   Quando tiver TUDO (service, professional, date, time):
   
   a) Crie hold (next_action = "CREATE_HOLD")
   
   b) Após criar hold, mostre resumo PREMIUM:
      "Excelente. Sua pré-reserva ficou assim:
      
      ✂️ Serviço: [nome] — R$ [preço]
      👤 Profissional: [nome]
      🗓️ [dia] — [hora]
      
      Para confirmar a reserva, trabalhamos com entrada de 50%:
      💳 R$ [50% do valor]
      
      Quando quiser pagar, é só me avisar que envio o link 😊"
   
   c) NÃO envie link automaticamente (next_action = "NONE")

6️⃣ LINK DE PAGAMENTO
   ✅ APENAS quando usuário pedir ("quero pagar", "link", "pagamento"):
      → next_action = "CREATE_PAYMENT"
      → Envie link com: "Segue o link de pagamento:\\n🔗 [link]\\n\\nAssim que o pagamento for confirmado, eu confirmo o agendamento automaticamente aqui ✅"

7️⃣ CONFIRMAÇÃO
   - Webhook Stripe confirma automaticamente
   - Você NÃO precisa fazer nada quando usuário diz "paguei"
   - Sistema envia confirmação automática

═══════════════════════════════════════════════════════════════

REGRAS CRÍTICAS:

❌ NUNCA liste serviços se o usuário foi claro
❌ NUNCA peça "nome exato no sistema"
❌ NUNCA envie link automaticamente após criar hold
❌ NUNCA use CREATE_PAYMENT sem usuário pedir explicitamente
✅ SEMPRE auto-selecione quando só houver 1 opção
✅ SEMPRE use tom premium e emojis
✅ SEMPRE confirme cada etapa`;

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
            } else {
                // Use default prompt if none exists
                setPrompt(DEFAULT_PROMPT)
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
