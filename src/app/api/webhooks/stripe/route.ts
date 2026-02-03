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

            // 1. Update Booking Status
            console.log('[Stripe Webhook] Updating booking status to CONFIRMED');
            const { error: bookingError } = await supabase
                .from("bookings")
                .update({ status: "CONFIRMED" })
                .eq("id", bookingId);

            if (bookingError) {
                console.error('[Stripe Webhook] Error updating booking:', bookingError);
            } else {
                console.log('[Stripe Webhook] Booking updated successfully');
            }

            // 2. Create Payment Record
            const { error: paymentError } = await supabase.from("payments").insert({
                booking_id: bookingId,
                stripe_session_id: sessionId,
                amount_cents: session.amount_total || 0,
                currency: session.currency || 'brl',
                status: "PAID"
            });

            if (paymentError) console.error("Error inserting payment", paymentError);

            // 3. Notify User via WhatsApp (Using Evolution)
            const { data: booking } = await supabase
                .from("bookings")
                .select("client_phone, client_name, organization_id, start_time, profiles(full_name), services(name), organizations(whatsapp_instance_id)")
                .eq("id", bookingId)
                .single();

            const org = Array.isArray(booking?.organizations) ? booking.organizations[0] : booking?.organizations;
            const service = Array.isArray(booking?.services) ? booking.services[0] : booking?.services;
            const profile = Array.isArray(booking?.profiles) ? booking.profiles[0] : booking?.profiles;

            if (booking && org?.whatsapp_instance_id) {
                const evo = new EvolutionClient();
                const dateStr = new Date(booking.start_time).toLocaleString("pt-BR");
                const msg = `✅ Pagamento confirmado, ${booking.client_name}!\n\nSeu agendamento para *${service?.name}* com *${profile?.full_name}* em *${dateStr}* está garantido.`;

                await evo.sendText(org.whatsapp_instance_id, booking.client_phone, msg);
            }
        }
    }

    return NextResponse.json({ received: true });
}
