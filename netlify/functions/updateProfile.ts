import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet, dbPatch } from "./_db";

function isSlug(s: string) {
  return /^[a-z0-9][a-z0-9-_]{2,30}$/i.test(s);
}

export const handler: Handler = async (event) => {
  const u = requireAuth(event);
  if (!u) return json(401, { error: "Unauthorized" });

  const body = JSON.parse(event.body || "{}");
  const slug = String(body.slug || "");
  if (!isSlug(slug)) return json(400, { error: "Bad slug" });

  const existing = await dbGet<any[]>(`users?slug=eq.${encodeURIComponent(slug)}&select=id`);
  if (existing.length > 0 && existing[0].id !== u.userId) return json(409, { error: "Slug already taken" });

  await dbPatch(`users?id=eq.${u.userId}`, {
    slug,
    timezone: body.timezone || "Europe/Amsterdam",
    slot_minutes: Number(body.slot_minutes) || 30,
    day_start: Number(body.day_start) || 10,
    day_end: Number(body.day_end) || 18,
    updated_at: new Date().toISOString(),
  }, "return=minimal");

  return json(200, { ok: true });
};
