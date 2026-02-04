export interface BookingState {
    service_id?: string;
    service_name?: string;
    service_key?: "corte" | "barba" | "sobrancelha" | "hidratacao" | null; // Canonical Intent

    professional_id?: string;
    professional_name?: string;

    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm

    client_name?: string;
    client_phone?: string;
    hold_booking_id?: string;
    payment_id?: string;
    deposit_percentage?: number;

    last_offer?: {
        service_id?: string;
        service_name?: string;
        professional_id?: string;
        professional_name?: string;
        date?: string;
        time?: string;
        service_options?: string[]; // IDs of services listed in the menu
        service_options_label?: string[];
        professional_options?: string[];
        professional_options_label?: string[];
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

// Validation Strict for CREATE_HOLD (needs real IDs)
export function computeMissingForHold(state: BookingState): string[] {
    const missing: string[] = [];

    // HOLD needs real ID or at least a Key we can resolve later
    if (!state.service_id && !state.service_key) missing.push("service_id");
    // Professional can be "any" or ID
    if (!state.professional_id) missing.push("professional_id");

    // Strict Date/Time regex or valid string check
    if (!state.date || !/^\d{4}-\d{2}-\d{2}$/.test(state.date)) missing.push("date");
    if (!state.time || !/^\d{2}:\d{2}$/.test(state.time)) missing.push("time");

    return missing;
}

export function normalizeStateUpdates(u: any): Partial<BookingState> {
    const out = { ...(u ?? {}) };

    if (out.service && !out.service_name) out.service_name = out.service;
    if (out.professional && !out.professional_name) out.professional_name = out.professional;

    delete (out as any).service;
    delete (out as any).professional;

    return out;
}
