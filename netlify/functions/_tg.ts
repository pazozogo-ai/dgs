const BOT_TOKEN = process.env.TG_BOT_TOKEN!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function tgSendMessage(chatId: string | number, text: string, replyMarkup?: any) {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  });
  if (!res.ok) throw new Error(`TG sendMessage failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function tgAnswerCallbackQuery(callbackQueryId: string, text?: string) {
  const res = await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}), show_alert: false }),
  });
  if (!res.ok) throw new Error(`TG answerCallbackQuery failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function tgEditMessageText(chatId: number, messageId: number, text: string) {
  const res = await fetch(`${API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) throw new Error(`TG editMessageText failed: ${res.status} ${await res.text()}`);
  return res.json();
}
