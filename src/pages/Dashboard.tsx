import React from "react";
import { getJSON, postJSON } from "../lib/api";

type Profile = {
  id: string;
  display_name: string | null;
  slug: string;
  timezone: string;
  slot_minutes: number;
  day_start: number;
  day_end: number;
};

export default function Dashboard() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const res = await getJSON<{ ok: true; profile: Profile }>("/.netlify/functions/getProfile");
      setProfile(res.profile);
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await postJSON<{ ok: true }>("/.netlify/functions/updateProfile", profile);
      alert("Сохранено");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="card">Загрузка...</div>;

  const publicUrl = `${window.location.origin}/u/${profile.slug}`;

  return (
    <div className="grid">
      <div className="card">
        <h1>Настройки</h1>

        <label className="label">Публичный slug (ссылка)</label>
        <input
          className="input"
          value={profile.slug}
          onChange={(e) => setProfile({ ...profile, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") })}
        />

        <label className="label">Таймзона</label>
        <input className="input" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} />

        <label className="label">Длительность слота (мин)</label>
        <select
          className="input"
          value={profile.slot_minutes}
          onChange={(e) => setProfile({ ...profile, slot_minutes: Number(e.target.value) })}
        >
          {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="label">Начало дня (час)</label>
            <input className="input" type="number" min={0} max={23}
              value={profile.day_start}
              onChange={(e) => setProfile({ ...profile, day_start: Number(e.target.value) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Конец дня (час)</label>
            <input className="input" type="number" min={1} max={24}
              value={profile.day_end}
              onChange={(e) => setProfile({ ...profile, day_end: Number(e.target.value) })}
            />
          </div>
        </div>

        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>

      <div className="card">
        <h2>Твоя ссылка</h2>
        <p className="muted">Кидаешь эту ссылку клиенту — он выбирает слот и отправляет заявку. Подтверждение придёт в Telegram.</p>
        <div className="copybox"><code>{publicUrl}</code></div>
        <a className="btn" href={publicUrl} target="_blank" rel="noreferrer">Открыть расписание</a>
      </div>
    </div>
  );
}
