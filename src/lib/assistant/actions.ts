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

    let professionalId = state.professional_id;
    if (!professionalId && state.professional_name) {
        const { data: p } = await supabase.from('profiles').select('id').ilike('full_name', `%${state.professional_name}%`).eq('organization_id', organizationId).limit(1).single();
        if (p) professionalId = p.id;
    }

    if (!serviceId) throw new Error(`Service not found: ${state.service_name}`);
    // Professional might be optional depending on business logic, but let's enforce if name was provided
    if (state.professional_name && !professionalId) throw new Error(`Professional not found: ${state.professional_name}`);

    // Default to first service/pro if not found? No, better to fail or hold without ID?
    // Let's create the HOLD anyway with what we have.

    // Calculate times
    // Date + Time strings to ISO
    let startTime = null;
    let endTime = null;
    if (state.date && state.time) {
        const dt = new Date(`${state.date}T${state.time}:00`); // Naive
        startTime = dt.toISOString();
        // Default 30 min if no service found
        endTime = new Date(dt.getTime() + 30 * 60000).toISOString();
    }

    const { data, error } = await supabase.from('bookings').insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        service_id: serviceId,
        professional_id: professionalId,
        status: 'HOLD',
        start_time: startTime,
        end_time: endTime,
        client_name: state.client_name,
        payload: state as any
    }).select().single();

    if (error) {
        console.error("Error creating hold:", error);
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
    // Check if stripe is configured, if not return mock link for dev
    if (!process.env.STRIPE_SECRET_KEY) {
        return {
            sessionId: "mock_session_" + Date.now(),
            url: `https://mock-payment.com/pay/${bookingId}`
        };
    }

    // Real implementation would go here
    // const session = await stripe.checkout.sessions.create(...)

    return {
        sessionId: "mock_session_" + Date.now(),
        url: `https://mock-payment.com/pay/${bookingId}`
    };
}
