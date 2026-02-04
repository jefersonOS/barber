"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

interface DepositSettingsProps {
    organizationId: string
}

export function DepositSettings({ organizationId }: DepositSettingsProps) {
    const [depositPercentage, setDepositPercentage] = useState(50)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState("")
    const supabase = createClient()

    useEffect(() => {
        async function loadSettings() {
            const { data } = await supabase
                .from('organizations')
                .select('default_deposit_percentage')
                .eq('id', organizationId)
                .single()

            if (data?.default_deposit_percentage !== undefined) {
                setDepositPercentage(data.default_deposit_percentage)
            }
            setLoading(false)
        }
        loadSettings()
    }, [organizationId])

    async function handleSave() {
        setSaving(true)
        setMessage("")

        const { error } = await supabase
            .from('organizations')
            .update({ default_deposit_percentage: depositPercentage })
            .eq('id', organizationId)

        if (error) {
            setMessage(`Erro: ${error.message}`)
        } else {
            setMessage("✅ Configuração salva com sucesso!")
        }
        setSaving(false)

        setTimeout(() => setMessage(""), 3000)
    }

    if (loading) return <div>Carregando...</div>

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Porcentagem de Entrada Padrão</h3>
                <p className="text-sm text-muted-foreground">
                    Esta porcentagem será usada para serviços que não têm uma porcentagem personalizada
                </p>
            </div>

            <div className="max-w-xs space-y-2">
                <Label htmlFor="deposit-percentage">Porcentagem (%)</Label>
                <Input
                    id="deposit-percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                    Valor entre 0 e 100. Padrão: 50%
                </p>
            </div>

            <div className="flex items-center gap-4">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                </Button>
                {message && (
                    <p className="text-sm font-medium text-green-600">
                        {message}
                    </p>
                )}
            </div>
        </div>
    )
}
