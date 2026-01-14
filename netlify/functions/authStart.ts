import type { Handler } from "@netlify/functions";
import { json, randomToken } from "./_util";
import { dbPost } from "./_db";

export const handler: Handler = async () => {
  try {
    const nonce = randomToken(16);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await dbPost("login_nonces", { nonce, status: "created", expires_at: expiresAt }, "return=minimal");

    const botUsername = process.env.TG_BOT_USERNAME!;
    const telegramLink = `https://t.me/${botUsername}?start=${nonce}`;
    return json(200, { ok: true, telegramLink });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
};
