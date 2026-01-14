import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet } from "./_db";

export const handler: Handler = async (event) => {
  const u = requireAuth(event);
  if (!u) return json(200, { ok: false });

  const rows = await dbGet<any[]>(`users?id=eq.${u.userId}&select=id,telegram_user_id,display_name,slug,timezone,slot_minutes,day_start,day_end`);
  const user = rows[0];
  if (!user) return json(200, { ok: false });

  return json(200, { ok: true, user });
};
