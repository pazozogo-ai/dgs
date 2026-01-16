import React from "react";
import { getJSON, postJSON } from "../lib/api";

type Profile = {
  id: string;
  display_name: string | null;
  user_id: string; // public id in URL
  timezone: string;
  slot_minutes: number;
  day_start: number;
  day_end: number;
  work_days: number[]; // 0=Mon .. 6=Sun
};

export default function Dashboard() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const res = await getJSON<{ ok: true; profile: Profile }>("/.netlify/functions/getProfile");
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || res.profile.timezone;
      setProfile({ ...res.profile, timezone: tz });
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

  const publicUrl = `${window.location.origin}/${profile.user_id}`;

  function setMinutesPreset(m: number) {
    setProfile({ ...profile, slot_minutes: m });
  }

  const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  function toggleWorkDay(idx: number) {
    const has = profile.work_days.includes(idx);
    const next = has ? profile.work_days.filter((d) => d !== idx) : [...profile.work_days, idx].sort((a, b) => a - b);
    setProfile({ ...profile, work_days: next });
  }

  return (
    <div className="container narrow">
      <div className="grid2">
        <div className="card">
        <div className="sectionHead">
          <div>
            <div className="h1">Настройки</div>
            <div className="sub">Настройте, когда Вам удобно принимать консультации. Клиент выберет время и подтвердит запись в Telegram.</div>
          </div>
        </div>

        <label className="label">Укажите userID (можете оставить значение по умолчанию)</label>
        <input
          className="input"
          value={profile.user_id}
          onChange={(e) => setProfile({ ...profile, user_id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") })}
        />
        <div className="hint">Это будет в ссылке: <span className="mono">{window.location.origin}/{profile.user_id}</span></div>

        <div className="divider" />

        <label className="label">Таймзона</label>
        <div className="pill">Время показано в Вашей таймзоне: <b>{profile.timezone}</b></div>

        <label className="label" style={{ marginTop: 14 }}>Длительность одной консультации</label>
        <div className="pills" style={{ marginBottom: 10 }}>
          {[5, 10, 15, 30, 45, 60].map((m) => (
            <button
              key={m}
              className={`pillBtn ${profile.slot_minutes === m ? "active" : ""}`}
              onClick={() => setMinutesPreset(m)}
              type="button"
            >
              {m} мин
            </button>
          ))}
          <div className="spacer" />
          <div style={{ minWidth: 120 }}>
            <input
              className="input"
              style={{ margin: 0, height: 42 }}
              type="number"
              min={5}
              step={5}
              value={profile.slot_minutes}
              onChange={(e) => setProfile({ ...profile, slot_minutes: Math.max(5, Number(e.target.value || 0)) })}
            />
          </div>
        </div>

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

        <label className="label">Рабочие дни</label>
        <div className="pills">
          {dayLabels.map((d, idx) => (
            <button
              key={d}
              type="button"
              className={`pillBtn ${profile.work_days.includes(idx) ? "active" : ""}`}
              onClick={() => toggleWorkDay(idx)}
            >
              {d}
            </button>
          ))}
        </div>

        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>

        <div className="card">
        <div className="sectionHead">
          <div>
            <div className="h1" style={{ fontSize: 22 }}>Ваша ссылка</div>
            <div className="sub">Отправьте эту ссылку клиенту — он выберет время и подтвердит запись в Telegram.</div>
          </div>
        </div>

        <p className="muted">Ссылка публичная — её можно просто переслать в чате.</p>
        <div className="copybox"><code>{publicUrl}</code></div>
        <a className="btn" href={publicUrl} target="_blank" rel="noreferrer">Открыть расписание</a>
      </div>

      </div>
    </div>
  );
}
