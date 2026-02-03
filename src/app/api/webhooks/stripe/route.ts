import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { EvolutionClient } from "@/lib/evolution/client";

export async function POST(req: Request) {
    let event: any; // Declare event here so it's accessible outside the try block if needed

    try {
        console.log('[Stripe Webhook] === WEBHOOK CALLED ===');
        console.log('[Stripe Webhook] Timestamp:', new Date().toISOString());

        const body = await req.text();
        console.log('[Stripe Webhook] Body length:', body.length);

        const signature = (await headers()).get("Stripe-Signature") as string;
        console.log('[Stripe Webhook] Has signature:', !!signature);

        try {
            event = stripe.webhooks.constructEvent(
                body,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET!
            );
            console.log('[Stripe Webhook] Event verified:', event.type);
        } catch (err: any) {
            console.error(`[Stripe Webhook] Signature verification failed:`, err.message);
            return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
        }
    } catch (outerErr: any) {
        console.error('[Stripe Webhook] OUTER ERROR:', outerErr);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }

    if (event.type === "checkout.session.completed") {
        console.log('[Stripe Webhook] Processing checkout.session.completed');
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        const sessionId = session.id;
        console.log('[Stripe Webhook] Booking ID:', bookingId, 'Session ID:', sessionId);

        if (bookingId) {
            const supabase = await createClient();

            // 1. Update Appointment Status
            console.log('[Stripe Webhook] Updating appointment status to confirmed');
            const { error: appointmentError } = await supabase
                .from("appointments")
                .update({
                    status: "confirmed",
                    payment_status: "paid",
                    stripe_session_id: sessionId
                })
                .eq("id", bookingId);

            if (appointmentError) {
                console.error('[Stripe Webhook] Error updating appointment:', appointmentError);
            } else {
                console.log('[Stripe Webhook] Appointment updated successfully');
            }

            // 2. Fetch Appointment Details for WhatsApp Confirmation
            const { data: appointment } = await supabase
                .from("appointments")
                .select("client_phone, client_name, organization_id, start_time, profiles(full_name), services(name), organizations(whatsapp_instance_id)")
                .eq("id", bookingId)
                .single();

            const org = Array.isArray(appointment?.organizations) ? appointment.organizations[0] : appointment?.organizations;
            const service = Array.isArray(appointment?.services) ? appointment.services[0] : appointment?.services;
            const profile = Array.isArray(appointment?.profiles) ? appointment.profiles[0] : appointment?.profiles;

            if (appointment && org?.whatsapp_instance_id) {
                const evo = new EvolutionClient();
                const dateStr = new Date(appointment.start_time).toLocaleString("pt-BR");
                const msg = `✅ Pagamento confirmado, ${appointment.client_name}!\n\nSeu agendamento para *${service?.name}* com *${profile?.full_name}* em *${dateStr}* está garantido.`;

                await evo.sendText(org.whatsapp_instance_id, appointment.client_phone, msg);
            }
        }
    }

    return NextResponse.json({ received: true });
}
