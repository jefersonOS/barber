import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { EvolutionClient } from "@/lib/evolution/client";

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get("Stripe-Signature") as string;

    let event: any;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error(`Webhook signature verification failed.`, err.message);
        return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        const sessionId = session.id;

        if (bookingId) {
            const supabase = await createClient();

            // 1. Update Booking Status
            const { error: bookingError } = await supabase
                .from("bookings")
                .update({ status: "CONFIRMED" })
                .eq("id", bookingId);

            if (bookingError) console.error("Error updating booking", bookingError);

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

            if (booking && booking.organizations?.whatsapp_instance_id) {
                const evo = new EvolutionClient();
                const dateStr = new Date(booking.start_time).toLocaleString("pt-BR");
                const msg = `✅ Pagamento confirmado, ${booking.client_name}!\n\nSeu agendamento para *${booking.services?.name}* com *${booking.profiles?.full_name}* em *${dateStr}* está garantido.`;

                await evo.sendText(booking.organizations.whatsapp_instance_id, booking.client_phone, msg);
            }
        }
    }

    return NextResponse.json({ received: true });
}
