import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet } from "./_db";

export const handler: Handler = async (event) => {
  const u = requireAuth(event);
  if (!u) return json(401, { error: "Unauthorized" });

  const rows = await dbGet<any[]>(`users?id=eq.${u.userId}&select=id,display_name,slug,timezone,slot_minutes,day_start,day_end`);
  return json(200, { ok: true, profile: rows[0] });
};
