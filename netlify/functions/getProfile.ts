import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet } from "./_db";

export const handler: Handler = async (event) => {
  const u = requireAuth(event);
  if (!u) return json(401, { error: "Unauthorized" });

  const rows = await dbGet<any[]>(`users?id=eq.${u.userId}&select=id,display_name,slug,timezone,slot_minutes,day_start,day_end,work_days`);
  const p = rows[0];
  if (!p) return json(404, { error: "Not found" });
  return json(200, {
    ok: true,
    profile: {
      id: p.id,
      display_name: p.display_name,
      user_id: p.slug,
      timezone: p.timezone,
      slot_minutes: p.slot_minutes,
      day_start: p.day_start,
      day_end: p.day_end,
      work_days: Array.isArray(p.work_days) ? p.work_days : [0, 1, 2, 3, 4],
    },
  });
};
