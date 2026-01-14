const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

export async function dbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`DB GET failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function dbPost<T>(path: string, body: any, prefer: string = "return=representation"): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...headers(), Prefer: prefer },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`DB POST failed: ${res.status} ${text}`);

  // return=minimal -> empty body
  return (text ? (JSON.parse(text) as T) : (null as unknown as T));
}

export async function dbPatch<T>(path: string, body: any, prefer: string = "return=representation"): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: prefer },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`DB PATCH failed: ${res.status} ${text}`);

  // return=minimal -> empty body
  return (text ? (JSON.parse(text) as T) : (null as unknown as T));
}
