import { SupabaseClient } from "@supabase/supabase-js";
import { BookingState } from "./state";
/* import { stripe } from "@/lib/stripe/client"; (Will implement later) */

export async function createHoldBooking({
    supabase,
    conversationId,
    state,
    organizationId
}: {
    supabase: SupabaseClient;
    conversationId: string;
    state: BookingState;
    organizationId: string;
}) {
    // 1. Resolve IDs if names are used (simplified for now, assumes IDs passed or resolved by AI)
    // Ideally AI should pass IDs if provided in context, or we search here.

    // For V2 MVP, let's assume the State has the IDs or we use the names to look them up.
    // This is a critical step. If AI only put "Corte" in service_name, we need to find the ID.

    let serviceId = state.service_id;
    if (!serviceId && state.service_name) {
        const { data: s } = await supabase.from('services').select('id').ilike('name', `%${state.service_name}%`).eq('organization_id', organizationId).limit(1).single();
        if (s) serviceId = s.id;
    }

    // Fallback: If no name but we have a KEY (e.g. "corte"), try generic search
    if (!serviceId && state.service_key) {
        const query = state.service_key === 'corte' ? '%corte%' : state.service_key === 'barba' ? '%barba%' : '%sobrancelha%';
        const { data: s } = await supabase.from('services').select('id').ilike('name', query).eq('organization_id', organizationId).limit(1).single();
        if (s) serviceId = s.id;
    }

    let professionalId = state.professional_id;
    if (professionalId === 'any') {
        // Find first available pro - optimization for "Any"
        const { data: p } = await supabase.from('profiles').select('id').eq('organization_id', organizationId).eq('role', 'professional').limit(1).single();
        if (p) professionalId = p.id;
    } else if (!professionalId && state.professional_name) {
        const { data: p } = await supabase.from('profiles').select('id').ilike('full_name', `%${state.professional_name}%`).eq('organization_id', organizationId).limit(1).single();
        if (p) professionalId = p.id;
    }

    if (!serviceId) throw new Error(`Service not found: ${state.service_name}`);
    // Professional might be optional depending on business logic, but let's enforce if name was provided
    if (state.professional_name && !professionalId) throw new Error(`Professional not found: ${state.professional_name}`);

    // Default to first service/pro if not found? No, better to fail or hold without ID?
    // Let's create the HOLD anyway with what we have.

    // Store times as naive timestamps (no timezone info)
    // This way they're stored and displayed exactly as entered
    let startTime = null;
    let endTime = null;
    if (state.date && state.time) {
        // Format without timezone - Postgres will store as-is
        startTime = `${state.date}T${state.time}:00`;
        // Calculate end time (30 min later)
        const [hours, minutes] = state.time.split(':').map(Number);
        const endMinutes = minutes + 30;
        const endHours = hours + Math.floor(endMinutes / 60);
        const finalMinutes = endMinutes % 60;
        endTime = `${state.date}T${String(endHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}:00`;
    }

    const { data, error } = await supabase.from('appointments').insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        service_id: serviceId,
        professional_id: professionalId,
        status: 'pending', // HOLD -> pending
        payment_status: 'pending',
        start_time: startTime,
        end_time: endTime,
        client_name: state.client_name || 'Cliente',
        client_phone: state.client_phone || '',
        metadata: state as any
    }).select().single();

    if (error) {
        console.error("Error creating appointment:", error);
        throw error;
    }

    return { bookingId: data.id };
}

export async function createStripeCheckout({
    supabase,
    bookingId,
    state
}: {
    supabase: SupabaseClient;
    bookingId: string;
    state: BookingState;
}) {
    // Import stripe client
    const { stripe } = await import("@/lib/stripe/client");

    // Fetch appointment details to get service price
    const { data: booking, error: bookingError } = await supabase
        .from('appointments')
        .select(`
            id,
            organization_id,
            client_name,
            services(name, price),
            organizations(name)
        `)
        .eq('id', bookingId)
        .single();

    if (bookingError || !booking) {
        throw new Error(`Appointment not found: ${bookingId}`);
    }

    const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
    const organization = Array.isArray(booking.organizations) ? booking.organizations[0] : booking.organizations;

    if (!service || !service.price) {
        throw new Error('Service or price not found');
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], // Add 'pix' when available in your Stripe account
        line_items: [
            {
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: `${service.name} - Entrada 50%`,
                        description: `Entrada de 50% para agendamento com ${organization?.name || 'Barbearia'}`,
                    },
                    unit_amount: Math.round(Number(service.price) * 0.5 * 100), // 50% deposit in cents
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/cancel`,
        metadata: {
            booking_id: bookingId,
            organization_id: booking.organization_id,
            client_name: state.client_name || 'Cliente',
        },
    });

    return {
        sessionId: session.id,
        url: session.url!,
    };
}
