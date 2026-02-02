export interface BookingState {
    service_id?: string;
    service_name?: string;
    professional_id?: string;
    professional_name?: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm
    client_name?: string;
    hold_booking_id?: string;
    payment_id?: string;
}

export interface AssistantTurnResult {
    reply: string;
    state_updates: Partial<BookingState>;
    next_action: "NONE" | "ASK_MISSING" | "CREATE_HOLD" | "CREATE_PAYMENT" | "CHECK_PAYMENT" | "CONFIRM_BOOKING";
    missing_fields: string[];
}

export function applyStateUpdates(currentState: BookingState, updates: Partial<BookingState>): BookingState {
    return {
        ...currentState,
        ...updates
    };
}

export function computeMissing(state: BookingState): string[] {
    const missing: string[] = [];
    if (!state.service_id && !state.service_name) missing.push("service");
    if (!state.professional_id && !state.professional_name) missing.push("professional");
    if (!state.date) missing.push("date");
    if (!state.time) missing.push("time");
    return missing;
}
