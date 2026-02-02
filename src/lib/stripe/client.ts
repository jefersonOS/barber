import Stripe from "stripe";

// Prevent build failures if env is missing (Next.js statically analyzes this file)
const apiKey = process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_for_build";

export const stripe = new Stripe(apiKey, {
    apiVersion: "2026-01-28.clover", // Updated to match installed types
    typescript: true
});
