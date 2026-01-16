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
  const [showAllSlots, setShowAllSlots] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", comment: "" });
  const [tgLink, setTgLink] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  const dayCardRef = React.useRef<HTMLDivElement | null>(null);
  const timeCardRef = React.useRef<HTMLDivElement | null>(null);
  const confirmCardRef = React.useRef<HTMLDivElement | null>(null);

  function scrollToRef(ref: React.RefObject<HTMLElement>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setTgLink(null);
      setSelectedSlot(null);
      try {
        const res: any = await getJSON<any>(`/.netlify/functions/getPublicSchedule?userId=${encodeURIComponent(userId || "")}`);
        // API может вернуть {error: ...} без поля ok. Защищаемся от падений рендера.
        if (!res || res.ok !== true || !res.profile) {
          setData(null);
          return;
        }
        setData(res as Api);

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

  if (loading)
    return (
      <div className="container narrow">
        <div className="card step step1">Загрузка...</div>
      </div>
    );
  if (!data)
    return (
      <div className="container narrow">
        <div className="card step step2">Расписание не найдено</div>
      </div>
    );

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

  const slotGroups = React.useMemo(() => {
    const groups: Record<string, { startAt: Date; endAt: Date }[]> = {};
    for (const sl of daySlots) {
      const h = sl.startAt.getHours().toString().padStart(2, "0");
      groups[h] = groups[h] || [];
      groups[h].push(sl);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([hour, slots]) => ({ hour, slots }));
  }, [daySlots]);

  async function startTelegramConfirm() {
    if (!selectedSlot) return;
    if (!form.name.trim()) {
      alert("Укажите имя");
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
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || profile.timezone;
  const currentStep = selectedSlot ? 3 : 2;

  
  return (
    <div className="container narrow">
      <div className="pageHeader">
        <h1 className="title">Запись к {ownerName}</h1>
        <p className="lead">Выберите удобное время. Подтверждение записи — в Telegram.</p>

        <div className="stepper">
          <button
            type="button"
            className={`stepItem ${currentStep >= 1 ? "done" : ""} ${currentStep === 1 ? "current" : ""}`}
            onClick={() => scrollToRef(dayCardRef)}
            aria-label="Шаг 1: выбрать день"
          >
            <span className="stepNum">1</span>
            <span className="stepText">День</span>
          </button>
          <span className={`stepLine ${currentStep >= 2 ? "done" : ""}`} aria-hidden />
          <button
            type="button"
            className={`stepItem ${currentStep >= 2 ? "done" : ""} ${currentStep === 2 ? "current" : ""}`}
            onClick={() => scrollToRef(timeCardRef)}
            aria-label="Шаг 2: выбрать время"
          >
            <span className="stepNum">2</span>
            <span className="stepText">Время</span>
          </button>
          <span className={`stepLine ${currentStep >= 3 ? "done" : ""}`} aria-hidden />
          <button
            type="button"
            className={`stepItem ${currentStep >= 3 ? "done" : ""} ${currentStep === 3 ? "current" : ""}`}
            onClick={() => scrollToRef(confirmCardRef)}
            aria-label="Шаг 3: подтвердить запись"
          >
            <span className="stepNum">3</span>
            <span className="stepText">Подтвердить</span>
          </button>
        </div>
        <div className="kvRow" style={{ marginTop: 10 }}>
          <span className="badge">⏱ {profile.slot_minutes} мин</span>
          <span className="badge">🕒 {profile.day_start}:00—{profile.day_end}:00</span>
          <span className="badge">🌍 Время показано в Вашей таймзоне: <b>{deviceTz}</b></span>
          {profile.timezone && profile.timezone !== deviceTz && (
            <span className="badge">🧭 Таймзона владельца: <b>{profile.timezone}</b></span>
          )}
        </div>
      </div>

      <div ref={dayCardRef} className="card step step1">
        <div className="cardHeader">
          <div>
            <div className="title">1. Выберите день</div>
            <div className="sub">Дни со свободными слотами отмечены точкой.</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
            <div className="title" style={{ minWidth: 200, textAlign: "center" }}>
              {month.toLocaleDateString([], { month: "long", year: "numeric" })}
            </div>
            <button className="btn" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          </div>
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
                  setShowAllSlots(false);
                  setSelectedSlot(null);
                  setForm({ name: "", comment: "" });
                  setTgLink(null);
                }}
              >
                <span>{d.getDate()}</span>
                {active && <span className="dot" aria-hidden />}
              </button>
            );
          })}
        </div>

        <div className="hint" style={{ marginTop: 10 }}>Доступность показывается на ближайшие 30 дней.</div>

        <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
          <button
            className="btn primary"
            type="button"
            disabled={daySlots.length === 0}
            onClick={() => scrollToRef(timeCardRef)}
          >
            Дальше: выбрать время →
          </button>
        </div>
      </div>

      <div ref={timeCardRef} className="card step step2">
        <div className="cardHeader">
          <div>
            <div className="title">2. Выберите время</div>
            <div className="sub">{formatDayTitle(selectedDay)}</div>
          </div>
        </div>

        {daySlots.length === 0 ? (
          <div className="sub">На выбранный день свободных слотов нет. Выберите другую дату.</div>
        ) : (
          <div className="slotGroups">
            {slotGroups.slice(0, showAllSlots ? slotGroups.length : 3).map((g) => (
              <div key={g.hour}>
                <div className="slotGroupHeader">
                  <div className="slotGroupTitle">{g.hour}:00</div>
                </div>
                <div className="slotGroupChips">
                  {(showAllSlots ? g.slots : g.slots.slice(0, 8)).map((sl) => {
                    const key = sl.startAt.toISOString();
                    const sel = selectedSlot?.startAt.toISOString() === key;
                    const label = sl.startAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`slotChip ${sel ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedSlot(sl);
                          setTgLink(null);
                          // UX: after choosing a time, guide the user to the confirmation section
                          setTimeout(() => scrollToRef(confirmCardRef), 60);
                        }}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {slotGroups.length > 3 && (
              <button className="btn ghost" type="button" onClick={() => setShowAllSlots((v) => !v)}>
                {showAllSlots ? "Показать меньше" : "Показать больше времени"}
              </button>
            )}

            <div className="hint">Свободные слоты показаны на выбранный день. Если Вам нужно другое время — попробуйте соседнюю дату.</div>
          </div>
        )}
      </div>

      <div ref={confirmCardRef} className="card step step3">
        <div className="cardHeader">
          <div>
            <div className="title">3. Подтвердите запись</div>
            <div className="sub">Пароль не нужен — подтверждение происходит в Telegram.</div>
          </div>
        </div>

        {!selectedSlot ? (
          <div className="sub">Сначала выберите день и время.</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <div className="summaryBox">
  <div className="summaryLabel">Вы выбрали</div>
  <div className="summaryValue">
    {formatDayTitle(selectedDay)} · {selectedSlot.startAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {profile.slot_minutes} мин
  </div>
</div>

            <label className="label">Ваше имя</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Например: Иван"
            />

            <label className="label">Комментарий (необязательно)</label>
            <textarea
              className="input"
              style={{ height: 92, resize: "vertical" }}
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />

            <button className="btn primary big" disabled={!form.name.trim() || sending} onClick={startTelegramConfirm}>
              {sending ? "Подготовка..." : "Подтвердить в Telegram"}
            </button>

            {tgLink && (
              <a className="btn" href={tgLink} target="_blank" rel="noreferrer">
                Открыть Telegram
              </a>
            )}

            <div className="hint">Сервис dialogs.tech не запрашивает пароль — подтверждение происходит через Telegram.</div>
          </div>
        )}
      </div>
    </div>
  );

}
