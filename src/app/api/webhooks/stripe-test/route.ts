import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        status: "ok",
        message: "Webhook endpoint is reachable",
        timestamp: new Date().toISOString()
    });
}

export async function POST(req: Request) {
    console.log('[Stripe Webhook TEST] Received POST request');
    console.log('[Stripe Webhook TEST] Headers:', Object.fromEntries(req.headers.entries()));

    const body = await req.text();
    console.log('[Stripe Webhook TEST] Body length:', body.length);

    return NextResponse.json({ received: true });
}
