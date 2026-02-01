import { createClient } from "@/lib/supabase/server"

export async function processAIResponse(organizationId: string, userPhone: string, message: string) {
    // In a real scenario, this would call OpenAI with tools.
    // Tools: check_availability, book_appointment

    const supabase = await createClient()

    // 1. Check intent (Mock)
    const lowerMsg = message.toLowerCase()

    if (lowerMsg.includes('horário') || lowerMsg.includes('agenda') || lowerMsg.includes('marcar')) {
        return "Olá! Claro. Tenho horários disponíveis hoje às 14:00 e 16:00. Qual você prefere?"
    }

    if (lowerMsg.includes('14') || lowerMsg.includes('16')) {
        // Mock booking
        // Insert appointment?
        // For now, just say "Confirmed"
        return "Perfeito! Seu agendamento para as " + (lowerMsg.includes('14') ? '14:00' : '16:00') + " foi realizado. O pagamento pode ser feito via PIX."
    }

    if (lowerMsg.includes('serviço') || lowerMsg.includes('preço')) {
        // Fetch services
        const { data: services } = await supabase.from('services').select('name, price').eq('organization_id', organizationId)
        if (services && services.length > 0) {
            const serviceList = services.map(s => `${s.name} (R$ ${s.price})`).join('\n')
            return `Nossos serviços:\n${serviceList}`
        }
        return "Oferecemos Corte e Barba."
    }

    return "Olá! Sou o assistente virtual da Barbearia. Posso ajudar com agendamentos e informações de serviços."
}
