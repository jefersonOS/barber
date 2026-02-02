import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function getFinancialMetrics(organizationId: string, professionalId?: string) {
    const supabase = await createClient()
    const now = new Date()
    const firstDayCurrentMonth = startOfMonth(now).toISOString()
    const lastDayCurrentMonth = endOfMonth(now).toISOString()

    const firstDayLastMonth = startOfMonth(subMonths(now, 1)).toISOString()
    const lastDayLastMonth = endOfMonth(subMonths(now, 1)).toISOString()

    // Helper to apply professional filter
    const applyFilter = (query: any) => {
        if (professionalId) {
            return query.eq('professional_id', professionalId)
        }
        return query
    }

    // 1. Total Revenue (Lifetime)
    let queryTotal = supabase
        .from('appointments')
        .select('price')
        .eq('organization_id', organizationId)
        .eq('payment_status', 'paid')

    const { data: allPaid } = await applyFilter(queryTotal)

    const totalRevenue = allPaid?.reduce((acc: number, curr: any) => acc + (Number(curr.price) || 0), 0) || 0

    // 2. Current Month Revenue
    let queryMonth = supabase
        .from('appointments')
        .select('price')
        .eq('organization_id', organizationId)
        .eq('payment_status', 'paid')
        .gte('start_time', firstDayCurrentMonth)
        .lte('start_time', lastDayCurrentMonth)

    const { data: monthPaid } = await applyFilter(queryMonth)

    const currentMonthRevenue = monthPaid?.reduce((acc: number, curr: any) => acc + (Number(curr.price) || 0), 0) || 0

    // 3. Last Month Revenue (for comparison)
    let queryLastMonth = supabase
        .from('appointments')
        .select('price')
        .eq('organization_id', organizationId)
        .eq('payment_status', 'paid')
        .gte('start_time', firstDayLastMonth)
        .lte('start_time', lastDayLastMonth)

    const { data: lastMonthPaid } = await applyFilter(queryLastMonth)

    const lastMonthRevenue = lastMonthPaid?.reduce((acc: number, curr: any) => acc + (Number(curr.price) || 0), 0) || 0

    // Calculate percentage change
    let percentageChange = 0
    if (lastMonthRevenue > 0) {
        percentageChange = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    } else if (currentMonthRevenue > 0) {
        percentageChange = 100 // Growth from 0
    }

    // 4. Total Appointments (Month)
    let queryAppointments = supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('start_time', firstDayCurrentMonth)
        .lte('start_time', lastDayCurrentMonth)

    const { count: monthAppointments } = await applyFilter(queryAppointments)

    return {
        totalRevenue,
        currentMonthRevenue,
        percentageChange: percentageChange.toFixed(1),
        monthAppointments: monthAppointments || 0
    }
}

return {
    totalRevenue,
    currentMonthRevenue,
    percentageChange: percentageChange.toFixed(1),
    monthAppointments: monthAppointments || 0
}
}
