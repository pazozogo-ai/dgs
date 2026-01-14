import React from "react";
import { useParams } from "react-router-dom";
import { getJSON, postJSON } from "../lib/api";
import { weekdayMon0 } from "../lib/slots";

type PublicProfile = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string | null;
  timezone: string;
  slot_minutes: number;
  day_start: number;
  day_end: number;
  work_days: number[]; // 0=Mon..6=Sun
};

type BusyRow = { start_at: string; end_at: string; status: "pending" | "approved" | "rejected" };

type Api = {
  ok: true;
  profile: PublicProfile;
  range: { start: string; end: string };
  busy: BusyRow[];
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDayTitle(d: Date) {
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthMatrix(base: Date) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstMon0 = weekdayMon0(first); // 0=Mon
  const start = addDays(first, -firstMon0);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) week.push(addDays(start, w * 7 + i));
    weeks.push(week);
  }
  return weeks;
}

function buildDaySlots(params: { date: Date; profile: PublicProfile }) {
  const { date, profile } = params;
  const wd = weekdayMon0(date);
  if (!profile.work_days?.includes(wd)) return [] as { startAt: Date; endAt: Date }[];

  const day = startOfDay(date);
  const base = day.getTime();
  const slots: { startAt: Date; endAt: Date }[] = [];

  const startMin = profile.day_start * 60;
  const endMin = profile.day_end * 60;

  for (let t = startMin; t + profile.slot_minutes <= endMin; t += profile.slot_minutes) {
    const s = new Date(base + t * 60_000);
    const e = new Date(base + (t + profile.slot_minutes) * 60_000);
    slots.push({ startAt: s, endAt: e });
  }
  return slots;
}

export default function PublicSchedule() {
  const params = useParams();
  const userId = (params as any).userId || (params as any).slug;

  const [data, setData] = React.useState<Api | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [month, setMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState(() => startOfDay(new Date()));
  const [selectedSlot, setSelectedSlot] = React.useState<{ startAt: Date; endAt: Date } | null>(null);
  const [form, setForm] = React.useState({ name: "", comment: "" });
  const [tgLink, setTgLink] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setTgLink(null);
      setSelectedSlot(null);
      try {
        const res = await getJSON<Api>(`/.netlify/functions/getPublicSchedule?userId=${encodeURIComponent(userId || "")}`);
        setData(res);

        // Default selected day: today (or next available)
        const today = startOfDay(new Date());
        setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDay(today);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <div className="card">Загрузка...</div>;
  if (!data) return <div className="card">Пользователь не найден</div>;

  const profile = data.profile;
  const busySet = new Set(
    data.busy
      .filter((b) => b.status === "pending" || b.status === "approved")
      .map((b) => `${b.start_at}__${b.end_at}`)
  );

  const weeks = monthMatrix(month);
  const today = startOfDay(new Date());
  const rangeEnd = new Date(data.range.end);

  function dayHasFree(d: Date) {
    if (d.getTime() < today.getTime()) return false;
    if (d.getTime() > startOfDay(rangeEnd).getTime()) return false;
    const slots = buildDaySlots({ date: d, profile });
    return slots.some((s) => !busySet.has(`${s.startAt.toISOString()}__${s.endAt.toISOString()}`) && s.endAt.getTime() > Date.now());
  }

  const daySlots = buildDaySlots({ date: selectedDay, profile })
    .filter((s) => s.endAt.getTime() > Date.now())
    .filter((s) => !busySet.has(`${s.startAt.toISOString()}__${s.endAt.toISOString()}`));

  async function startTelegramConfirm() {
    if (!selectedSlot) return;
    if (!form.name.trim()) {
      alert("Укажи имя");
      return;
    }
    setSending(true);
    try {
      const res = await postJSON<{ ok: true; tgLink: string; expiresAt: string }>("/.netlify/functions/startBooking", {
        ownerUserId: profile.user_id || profile.slug,
        startAt: selectedSlot.startAt.toISOString(),
        endAt: selectedSlot.endAt.toISOString(),
        clientName: form.name.trim(),
        clientComment: form.comment?.trim() || null,
      });
      setTgLink(res.tgLink);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  }

  const ownerName = profile.display_name ?? profile.user_id ?? profile.slug;

  return (
    <div className="stack">
      <div className="card">
        <div className="sectionHead">
          <div>
            <div className="h1">Запись к {ownerName}</div>
            <div className="sub">Выберите дату и время. Подтверждение записи — в Telegram.</div>
          </div>
          <div className="pill">{profile.slot_minutes} мин • {profile.day_start}:00—{profile.day_end}:00</div>
        </div>

        <div className="grid2">
          <div>
            <div className="calHeader">
              <button className="btn" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
              <div className="title" style={{ textAlign: "center" }}>
                {month.toLocaleDateString([], { month: "long", year: "numeric" })}
              </div>
              <button className="btn" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
            </div>

            <div className="calGrid">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <div key={d} className="calDow">{d}</div>
              ))}
              {weeks.flat().map((d) => {
                const inMonth = d.getMonth() === month.getMonth();
                const disabled = d.getTime() < today.getTime() || d.getTime() > startOfDay(rangeEnd).getTime();
                const active = dayHasFree(d);
                const selected = isSameDay(d, selectedDay);

                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    className={`calDay ${inMonth ? "" : "muted"} ${selected ? "selected" : ""} ${active ? "active" : ""}`}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedDay(startOfDay(d));
                      setSelectedSlot(null);
                      setTgLink(null);
                    }}
                  >
                    <span>{d.getDate()}</span>
                    {active && <span className="dot" aria-hidden />}
                  </button>
                );
              })}
            </div>

            <div className="hint">
              Время показано в вашей таймзоне: <b>{Intl.DateTimeFormat().resolvedOptions().timeZone || profile.timezone}</b>
            </div>
          </div>

          <div>
            <div className="title" style={{ marginBottom: 10 }}>{formatDayTitle(selectedDay)}</div>

            {daySlots.length === 0 ? (
              <div className="sub">На этот день свободных слотов нет. Выберите другую дату.</div>
            ) : (
              <div className="slotList">
                {daySlots.slice(0, 16).map((s) => {
                  const key = s.startAt.toISOString();
                  const sel = selectedSlot?.startAt.toISOString() === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`slotRow ${sel ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedSlot(s);
                        setTgLink(null);
                      }}
                    >
                      <div className="slotTime">
                        {s.startAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="slotMeta">{profile.slot_minutes} мин</div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <div className="divider" style={{ marginTop: 14 }} />
            )}

            {selectedSlot && (
              <div className="stack" style={{ gap: 10 }}>
                <div className="title" style={{ fontSize: 18 }}>Данные для заявки</div>

                <label className="label">Ваше имя</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

                <label className="label">Комментарий (опционально)</label>
                <textarea className="input" rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />

                {!tgLink ? (
                  <button className="btn primary" type="button" onClick={startTelegramConfirm} disabled={sending}>
                    {sending ? "..." : "Подтвердить в Telegram"}
                  </button>
                ) : (
                  <div className="note">
                    <div className="noteTitle">Шаг 2: подтвердите заявку в Telegram</div>
                    <div className="sub" style={{ marginTop: 6 }}>
                      Откройте Telegram и нажмите “Подтвердить запись” в боте. После этого заявка уйдёт владельцу расписания.
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      <a className="btn primary" href={tgLink}>
                        Открыть Telegram
                      </a>
                      <button className="btn" type="button" onClick={() => navigator.clipboard?.writeText(tgLink)}>
                        Скопировать ссылку
                      </button>
                    </div>
                  </div>
                )}

                <div className="hint">Сервис dialogs.tech не просит пароль — подтверждение идёт через Telegram.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="footer">dialogs.tech</div>
    </div>
  );
}
