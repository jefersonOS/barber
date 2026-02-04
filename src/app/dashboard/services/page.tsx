"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { updateService, deleteService } from "@/app/actions/services"

export default function ServicesPage() {
    const [services, setServices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingService, setEditingService] = useState<any | null>(null)
    const [deletingService, setDeletingService] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({
        name: "",
        description: "",
        duration_min: 0,
        price: 0,
        deposit_percentage: null as number | null
    })
    const { t } = useLanguage()
    const supabase = createClient()

    async function fetchServices() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
        if (!profile?.organization_id) return

        const { data } = await supabase
            .from('services')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false })

        setServices(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchServices()
    }, [])

    function openEditDialog(service: any) {
        setEditingService(service)
        setEditForm({
            name: service.name,
            description: service.description || "",
            duration_min: service.duration_min,
            price: service.price,
            deposit_percentage: service.deposit_percentage
        })
    }

    async function handleUpdate() {
        if (!editingService) return

        const result = await updateService(editingService.id, editForm)
        if (result.success) {
            setEditingService(null)
            fetchServices()
        } else {
            alert(result.error)
        }
    }

    async function handleDelete() {
        if (!deletingService) return

        const result = await deleteService(deletingService.id)
        if (result.success) {
            setDeletingService(null)
            fetchServices()
        } else {
            alert(result.error)
        }
    }

    if (loading) return <div>{t("common.loading")}</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t("services.title")}</h1>
                <Link href="/dashboard/services/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> {t("services.add")}
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                    <Card key={service.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                {service.name}
                                <span className="text-sm font-normal text-muted-foreground">R$ {service.price}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            <p className="mt-2 text-sm font-medium">{service.duration_min} {t("services.mins")}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Entrada: {service.deposit_percentage ? `${service.deposit_percentage}%` : "Padrão global"}
                            </p>
                        </CardContent>
                        <CardFooter className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(service)}>
                                <Pencil className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeletingService(service)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Excluir
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
                {services.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                        {t("services.empty")}
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Serviço</DialogTitle>
                        <DialogDescription>Atualize as informações do serviço</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nome</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div>
                            <Label>Descrição</Label>
                            <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Duração (min)</Label>
                                <Input type="number" value={editForm.duration_min} onChange={(e) => setEditForm({ ...editForm, duration_min: Number(e.target.value) })} />
                            </div>
                            <div>
                                <Label>Preço (R$)</Label>
                                <Input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div>
                            <Label>Porcentagem de Entrada (%)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Deixe vazio para usar padrão global"
                                value={editForm.deposit_percentage ?? ""}
                                onChange={(e) => setEditForm({ ...editForm, deposit_percentage: e.target.value ? Number(e.target.value) : null })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Se não definido, será usado o padrão global da organização
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingService(null)}>Cancelar</Button>
                        <Button onClick={handleUpdate}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingService} onOpenChange={() => setDeletingService(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir o serviço "{deletingService?.name}"? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingService(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
