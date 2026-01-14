import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet, dbPatch } from "./_db";
import { tgSendMessage } from "./_tg";

export const handler: Handler = async (event) => {
  try {
    const u = requireAuth(event);
    if (!u) return json(401, { error: "Unauthorized" });

    const body = JSON.parse(event.body || "{}");
    const { bookingId, action } = body;
    if (!bookingId || !["approve","reject"].includes(action)) return json(400, { error: "Bad request" });

    const rows = await dbGet<any[]>(`bookings?id=eq.${bookingId}&select=*`);
    const booking = rows[0];
    if (!booking) return json(404, { error: "Not found" });
    if (String(booking.owner_user_id) !== String(u.userId)) return json(403, { error: "Forbidden" });

    const newStatus = action === "approve" ? "approved" : "rejected";
    await dbPatch(`bookings?id=eq.${bookingId}`, { status: newStatus, approved_at: action==="approve" ? new Date().toISOString() : null }, "return=minimal");

    const when = new Date(booking.start_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    await tgSendMessage(booking.client_telegram_user_id,
      newStatus === "approved"
        ? `✅ Консультация подтверждена\nВремя: <b>${when}</b>`
        : `❌ Консультация отклонена\nВремя: <b>${when}</b>`
    );

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
};
