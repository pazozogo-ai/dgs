import type { Handler } from "@netlify/functions";
import { json } from "./_util";
import { requireAuth } from "./_auth";
import { dbGet } from "./_db";

export const handler: Handler = async (event) => {
  const u = requireAuth(event);
  if (!u) return json(401, { error: "Unauthorized" });

  const items = await dbGet<any[]>(
    `bookings?owner_user_id=eq.${u.userId}&status=eq.pending&select=id,start_at,end_at,client_name,client_comment,status&order=start_at.asc`
  );
  return json(200, { ok: true, items });
};
