import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { dbGet } from "./_db";

export const handler: Handler = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId || event.queryStringParameters?.slug;
    if (!userId) return json(400, { error: "userId required" });

    const users = await dbGet<any[]>(
      `users?slug=eq.${encodeURIComponent(userId)}&select=id,slug,display_name,timezone,slot_minutes,day_start,day_end,telegram_user_id,work_days`
    );
    const profile = users[0];
    if (!profile) return json(404, { error: "Not found" });

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const busy = await dbGet<any[]>(
      `bookings?owner_user_id=eq.${profile.id}&status=in.(pending,approved)&start_at=gte.${encodeURIComponent(now.toISOString())}&start_at=lte.${encodeURIComponent(end.toISOString())}&select=start_at,end_at,status`
    );

    return json(200, {
      ok: true,
      profile: {
        ...profile,
        user_id: profile.slug,
        work_days: Array.isArray(profile.work_days) ? profile.work_days : [0, 1, 2, 3, 4],
      },
      range: { start: now.toISOString(), end: end.toISOString() },
      busy,
    });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
};
