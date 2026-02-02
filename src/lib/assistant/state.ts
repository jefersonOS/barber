export interface BookingState {
    service_id?: string;
    service_name?: string;
    service_key?: "corte" | "barba" | "sobrancelha" | null; // Canonical Intent

    professional_id?: string;
    professional_name?: string;

    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm

    client_name?: string;
    hold_booking_id?: string;
    payment_id?: string;

    last_offer?: {
        service_id?: string;
        service_name?: string;
        professional_id?: string;
        professional_name?: string;
        date?: string;
        time?: string;
    };
}

export interface AssistantTurnResult {
    reply: string;
    state_updates: Partial<BookingState>;
    next_action: "NONE" | "ASK_MISSING" | "CREATE_HOLD" | "CREATE_PAYMENT" | "CHECK_PAYMENT" | "CONFIRM_BOOKING";
    missing_fields: string[];
}

// Safe merge: undefined/null values in 'updates' do NOT overwrite existing state
export function applyStateUpdates(
    currentState: BookingState,
    updates: Partial<BookingState>
): BookingState {
    const out: BookingState = { ...currentState };
    if (!updates) return out;

    for (const [k, v] of Object.entries(updates) as [keyof BookingState, any][]) {
        if (v === undefined || v === null) continue;

        // Special merge for last_offer object
        if (k === "last_offer" && typeof v === "object") {
            out.last_offer = { ...(out.last_offer ?? {}), ...(v ?? {}) };
            continue;
        }

        (out as any)[k] = v;
    }

    return out;
}

export function computeMissing(state: BookingState): string[] {
    const missing: string[] = [];

    // Service: Key OR ID OR Name satisfies requirement
    if (!state.service_key && !state.service_id && !state.service_name) missing.push("service");

    // Professional: ID OR Name satisfies
    if (!state.professional_id && !state.professional_name) missing.push("professional");

    if (!state.date) missing.push("date");
    if (!state.time) missing.push("time");

    return missing;
}
