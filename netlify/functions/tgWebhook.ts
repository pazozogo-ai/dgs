import type { Handler } from "@netlify/functions";
import { dbGet, dbPost, dbPatch } from "./_db";
import { json, randomToken } from "./_util";
import { tgSendMessage, tgAnswerCallbackQuery, tgEditMessageText } from "./_tg";

function normalizeSlug(s: string) {
  const out = s.toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (out.length >= 3) return out.slice(0, 24);
  return null;
}

async function ensureUser(tgUser: any) {
  const tgId = String(tgUser.id);
  const existing = await dbGet<any[]>(`users?telegram_user_id=eq.${tgId}&select=id,telegram_user_id,display_name,slug`);
  if (existing[0]) return existing[0];

  const baseName = tgUser.username ? normalizeSlug(tgUser.username) : null;
  const slug = baseName ?? `u${tgId.slice(-6)}`;

  const same = await dbGet<any[]>(`users?slug=eq.${encodeURIComponent(slug)}&select=id`);
  const finalSlug = same.length ? `${slug}-${tgId.slice(-3)}` : slug;

  const inserted = await dbPost<any[]>("users", {
    telegram_user_id: tgId,
    display_name: tgUser.first_name ?? tgUser.username ?? "User",
    slug: finalSlug,
    timezone: "Europe/Amsterdam",
    slot_minutes: 30,
    day_start: 10,
    day_end: 18
  });
  return inserted[0];
}

async function handleStart(msg: any) {
  const chatId = msg.chat.id;
  const text: string = msg.text || "";
  const parts = text.split(" ");
  const nonce = parts[1];

  if (!nonce) {
    await tgSendMessage(chatId, "Привет! Чтобы войти на сайт, нажми кнопку “Войти через Telegram” на сайте — бот пришлёт ссылку сюда.");
    return;
  }

  const rows = await dbGet<any[]>(`login_nonces?nonce=eq.${encodeURIComponent(nonce)}&select=nonce,status,expires_at`);
  const row = rows[0];
  if (!row) {
    await tgSendMessage(chatId, "Ссылка устарела или неверна. Вернись на сайт и попробуй ещё раз.");
    return;
  }
  if (Date.now() > new Date(row.expires_at).getTime()) {
    await tgSendMessage(chatId, "Ссылка устарела. Вернись на сайт и попробуй ещё раз.");
    return;
  }

  const user = await ensureUser(msg.from);

  await dbPatch(`login_nonces?nonce=eq.${encodeURIComponent(nonce)}`, {
    telegram_user_id: String(msg.from.id),
    user_id: user.id,
    status: "linked"
  }, "return=minimal");

  const reply_markup = { inline_keyboard: [[{ text: "✅ Подтвердить вход", callback_data: `login:${nonce}` }]] };
  await tgSendMessage(chatId, "Подтверди вход на сайт:", reply_markup);
}

async function handleLoginConfirm(callback: any, nonce: string) {
  const chatId = callback.message.chat.id;
  const fromId = String(callback.from.id);

  const rows = await dbGet<any[]>(`login_nonces?nonce=eq.${encodeURIComponent(nonce)}&select=nonce,status,telegram_user_id,user_id,expires_at`);
  const row = rows[0];
  if (!row || String(row.telegram_user_id) !== fromId) {
    await tgAnswerCallbackQuery(callback.id, "Ссылка недействительна");
    return;
  }

  if (row.status === "consumed") {
    await tgAnswerCallbackQuery(callback.id, "Вход уже подтверждён");
    return;
  }

  if (row.status !== "linked") {
    await tgAnswerCallbackQuery(callback.id, "Сначала начни вход на сайте");
    return;
  }
  if (Date.now() > new Date(row.expires_at).getTime()) {
    await tgAnswerCallbackQuery(callback.id, "Срок истёк. Сгенерируй вход заново на сайте.");
    return;
  }

  const existing = await dbGet<any[]>(
    `login_tokens?user_id=eq.${row.user_id}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`
  );

  if (existing.length > 0) {
    await tgAnswerCallbackQuery(callback.id, "Ссылка уже отправлена");
    return;
  }

  const token = randomToken(20);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await dbPost("login_tokens", { token, user_id: row.user_id, telegram_user_id: row.telegram_user_id, status: "active", expires_at: expiresAt }, "return=minimal");
  await dbPatch(`login_nonces?nonce=eq.${encodeURIComponent(nonce)}`, { status: "consumed" }, "return=minimal");

  const base = new URL(process.env.APP_BASE_URL!).origin;
  const link = `${base}/.netlify/functions/authFinish?token=${encodeURIComponent(token)}`;

  await tgAnswerCallbackQuery(callback.id, "Ок!");
  await tgSendMessage(chatId, `Готово ✅\nОткрой ссылку для входа:\n${link}`);
}

async function handleBookingAction(callback: any, action: "approve"|"reject", bookingId: string) {
  const fromId = String(callback.from.id);
  const rows = await dbGet<any[]>(`bookings?id=eq.${bookingId}&select=*`);
  const booking = rows[0];
  if (!booking) { await tgAnswerCallbackQuery(callback.id, "Заявка не найдена"); return; }
  if (String(booking.owner_telegram_user_id) !== fromId) { await tgAnswerCallbackQuery(callback.id, "Это не твоё расписание"); return; }
  if (booking.status !== "pending") { await tgAnswerCallbackQuery(callback.id, "Уже обработано"); return; }

  const newStatus = action === "approve" ? "approved" : "rejected";
  await dbPatch(`bookings?id=eq.${bookingId}`, { status: newStatus, approved_at: action==="approve" ? new Date().toISOString() : null }, "return=minimal");

  const when = new Date(booking.start_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  await tgSendMessage(booking.client_telegram_user_id,
    newStatus === "approved"
      ? `✅ Консультация подтверждена\nВремя: <b>${when}</b>`
      : `❌ Консультация отклонена\nВремя: <b>${when}</b>`
  );

  await tgAnswerCallbackQuery(callback.id, "Готово");
  const statusLine = newStatus === "approved" ? "✅ Подтверждено" : "❌ Отклонено";
  await tgEditMessageText(callback.message.chat.id, callback.message.message_id, callback.message.text + `\n\n<b>${statusLine}</b>`);
}

export const handler: Handler = async (event) => {
  try {
    const update = JSON.parse(event.body || "{}");

    if (update.message?.text) {
      if (String(update.message.text).startsWith("/start")) await handleStart(update.message);
    }

    if (update.callback_query) {
      const cb = update.callback_query;
      const data: string = cb.data || "";
      if (data.startsWith("login:")) await handleLoginConfirm(cb, data.slice(6));
      else if (data.startsWith("approve:")) await handleBookingAction(cb, "approve", data.slice(8));
      else if (data.startsWith("reject:")) await handleBookingAction(cb, "reject", data.slice(7));
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
};
