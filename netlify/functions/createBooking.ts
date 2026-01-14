import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet, dbPost } from "./_db";
import { tgSendMessage } from "./_tg";

export const handler: Handler = async (event) => {
  try {
    const client = requireAuth(event);
    if (!client) return json(200, { ok: true, needTelegramLogin: true });

    const body = JSON.parse(event.body || "{}");
    const { ownerSlug, startAt, endAt, clientName, clientComment } = body;
    if (!ownerSlug || !startAt || !endAt || !clientName) return json(400, { error: "Missing fields" });

    const owners = await dbGet<any[]>(`users?slug=eq.${encodeURIComponent(ownerSlug)}&select=id,telegram_user_id,display_name,slug`);
    const owner = owners[0];
    if (!owner) return json(404, { error: "Owner not found" });

    let inserted;
    try {
      inserted = await dbPost<any[]>("bookings", {
        owner_user_id: owner.id,
        owner_telegram_user_id: String(owner.telegram_user_id),
        client_user_id: client.userId,
        client_telegram_user_id: String(client.telegramUserId),
        start_at: startAt,
        end_at: endAt,
        client_name: clientName,
        client_comment: clientComment ?? null,
        status: "pending",
      });
    } catch (e: any) {
      const msg = String(e.message || "");
      if (msg.includes("23505") || msg.toLowerCase().includes("duplicate")) return json(409, { error: "Этот слот уже занят. Выберите другой." });
      throw e;
    }

    const booking = inserted[0];
    const when = new Date(startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const text =
`<b>Новая заявка</b>
К кому: ${owner.display_name ?? owner.slug}
Кто: <b>${clientName}</b>
Когда: <b>${when}</b>
Комментарий: ${clientComment ? clientComment : "—"}

Подтвердить?`;

    const reply_markup = { inline_keyboard: [[
      { text: "✅ OK", callback_data: `approve:${booking.id}` },
      { text: "❌ Отказ", callback_data: `reject:${booking.id}` }
    ]]};

    await tgSendMessage(owner.telegram_user_id, text, reply_markup);
    return json(200, { ok: true, bookingId: booking.id });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
};
