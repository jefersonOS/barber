import OpenAI from "openai";
import { BookingState, AssistantTurnResult } from "./state";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function chatTurn({
    state,
    history,
    incomingText,
    context
}: {
    state: BookingState;
    history: string[];
    incomingText: string;
    context: string;
}): Promise<AssistantTurnResult> {
    const system = `
Você é o Atendente IA da barbearia.
ANTI-LOOP: nunca pergunte algo já presente no BOOKING_STATE ou já dito no histórico.
Se cliente disse "pode ser", "sim", "combinado", considere CONFIRMADO a última proposta feita.

ESTADO ATUAL (O QUE JÁ SABEMOS):
${JSON.stringify(state, null, 2)}

REGRA DE OURO (ANTI-ALUCINAÇÃO):
- O status oficial é o que está no "ESTADO ATUAL" acima.
- Se "hold_booking_id" for nulo/vazio, NÃO EXISTE RESERVA NO SISTEMA AINDA.
- Mesmo que o histórico mostre que você disse "agendado", se o ID não estiver aqui, falhou. TENTE NOVAMENTE (CREATE_HOLD).

CONTEXTO EXTRA (HORÁRIOS/PROFISSIONAIS):
${context}

HISTÓRICO RECENTE:
${JSON.stringify(history)}

INSTRUÇÕES:
1. Analise a mensagem do usuário.
2. Atualize o state_updates se ele forneceu nova info.
3. Decida a next_action.
   - Se falta info (service, professional, date, time), next_action = "ASK_MISSING".
   - Se tem tudo e não tem hold, next_action = "CREATE_HOLD".
   - Se tem hold e não pagou, next_action = "CREATE_PAYMENT".
   - Se pagou, next_action = "CONFIRM_BOOKING" (mas geralmente isso é via webhook).
4. Gere uma reply curta e natural (WhatsApp style).

Você DEVE responder APENAS um JSON neste formato:
{
  "reply": string,
  "state_updates": object,
  "next_action": "NONE"|"ASK_MISSING"|"CREATE_HOLD"|"CREATE_PAYMENT"|"CHECK_PAYMENT"|"CONFIRM_BOOKING",
  "missing_fields": string[]
}
`;

    const res = await client.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
            { role: "system", content: system },
            { role: "user", content: incomingText },
        ],
        response_format: { type: "json_object" },
    });

    const content = res.choices[0]?.message?.content ?? "{}";
    try {
        return JSON.parse(content) as AssistantTurnResult;
    } catch (e) {
        console.error("Failed to parse JSON from OpenAI", content);
        return {
            reply: "Desculpe, não entendi. Pode repetir?",
            state_updates: {},
            next_action: "NONE",
            missing_fields: []
        };
    }
}
