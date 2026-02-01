import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function getFinancialMetrics(organizationId: string) {
    const supabase = await createClient()
    const now = new Date()
    const firstDayCurrentMonth = startOfMonth(now).toISOString()
    const lastDayCurrentMonth = endOfMonth(now).toISOString()

    const firstDayLastMonth = startOfMonth(subMonths(now, 1)).toISOString()
    const lastDayLastMonth = endOfMonth(subMonths(now, 1)).toISOString()

    // 1. Total Revenue (Lifetime)
    const { data: allPaid } = await supabase
        .from('appointments')
        .select('price')
        .eq('organization_id', organizationId)
        .eq('payment_status', 'paid')

    const totalRevenue = allPaid?.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) || 0

    // 2. Current Month Revenue
    const { data: monthPaid } = await supabase
        .from('appointments')
        .select('price')
        .eq('organization_id', organizationId)
        .eq('payment_status', 'paid')
        .gte('start_time', firstDayCurrentMonth)
        .lte('start_time', lastDayCurrentMonth)

    const currentMonthRevenue = monthPaid?.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) || 0

    // 3. Last Month Revenue (for comparison)
    const { data: lastMonthPaid } = await supabase
        .from('appointments')
        .select('price')
        .eq('organization_id', organizationId)
        .eq('payment_status', 'paid')
        .gte('start_time', firstDayLastMonth)
        .lte('start_time', lastDayLastMonth)

    const lastMonthRevenue = lastMonthPaid?.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) || 0

    // Calculate percentage change
    let percentageChange = 0
    if (lastMonthRevenue > 0) {
        percentageChange = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    } else if (currentMonthRevenue > 0) {
        percentageChange = 100 // Growth from 0
    }

    // 4. Total Appointments (Month)
    const { count: monthAppointments } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('start_time', firstDayCurrentMonth)
        .lte('start_time', lastDayCurrentMonth)

    return {
        totalRevenue,
        currentMonthRevenue,
        percentageChange: percentageChange.toFixed(1),
        monthAppointments: monthAppointments || 0
    }
}
