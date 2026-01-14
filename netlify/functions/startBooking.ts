import type { Handler } from "@netlify/functions";
import { json, randomToken } from "./_util";
import { dbGet, dbPost } from "./_db";

export const handler: Handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { ownerUserId, startAt, endAt, clientName, clientComment } = body;

    if (!ownerUserId || !startAt || !endAt || !clientName) {
      return json(400, { error: "Missing fields" });
    }

    const owners = await dbGet<any[]>(`users?slug=eq.${encodeURIComponent(ownerUserId)}&select=id,telegram_user_id,display_name,slug,timezone`);
    const owner = owners[0];
    if (!owner) return json(404, { error: "Owner not found" });

    const nonce = randomToken(18);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await dbPost(
      "booking_nonces",
      {
        nonce,
        status: "created",
        owner_user_id: owner.id,
        owner_telegram_user_id: String(owner.telegram_user_id),
        start_at: startAt,
        end_at: endAt,
        client_name: clientName,
        client_comment: clientComment ?? null,
        expires_at: expiresAt,
      },
      "return=minimal"
    );

    const botUsername = process.env.TG_BOT_USERNAME;
    if (!botUsername) return json(500, { error: "TG_BOT_USERNAME is not set" });

    const tgLink = `https://t.me/${botUsername}?start=b_${encodeURIComponent(nonce)}`;

    return json(200, {
      ok: true,
      tgLink,
      expiresAt,
      ownerName: owner.display_name ?? owner.slug,
    });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
};
