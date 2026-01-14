import React from "react";
import { useParams } from "react-router-dom";
import { getJSON, postJSON } from "../lib/api";
import { buildSlotsForNextDays } from "../lib/slots";

type PublicProfile = {
  id: string;
  slug: string;
  display_name: string | null;
  timezone: string;
  slot_minutes: number;
  day_start: number;
  day_end: number;
};

type BookingRow = {
  start_at: string;
  end_at: string;
  status: "pending" | "approved" | "rejected";
};

export default function PublicSchedule() {
  const { slug } = useParams();
  const [profile, setProfile] = React.useState<PublicProfile | null>(null);
  const [busy, setBusy] = React.useState<BookingRow[]>([]);
  const [selected, setSelected] = React.useState<{ startAt: Date; endAt: Date } | null>(null);
  const [form, setForm] = React.useState({ name: "", comment: "" });
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getJSON<{ ok: true; profile: PublicProfile; busy: BookingRow[] }>(`/.netlify/functions/getPublicSchedule?slug=${encodeURIComponent(slug || "")}`);
        setProfile(res.profile);
        setBusy(res.busy);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <div className="card">Загрузка...</div>;
  if (!profile) return <div className="card">Пользователь не найден</div>;

  const availability = [0,1,2,3,4,5,6].map((weekday) => ({
    weekday,
    start_min: profile.day_start * 60,
    end_min: profile.day_end * 60,
  }));

  const slots = buildSlotsForNextDays({
    now: new Date(),
    days: 7,
    slotMinutes: profile.slot_minutes,
    availability,
  });

  const busySet = new Set(busy.filter(b=>["pending","approved"].includes(b.status)).map((x) => `${x.start_at}__${x.end_at}`));
  const freeSlots = slots.filter((s) => !busySet.has(`${s.startAt.toISOString()}__${s.endAt.toISOString()}`));

  async function submit() {
    if (!selected) return;
    if (!form.name.trim()) return alert("Заполни имя");
    setSending(true);
    try {
      const res = await postJSON<{ ok: true; bookingId: string; needTelegramLogin?: boolean }>(
        "/.netlify/functions/createBooking",
        { ownerSlug: profile.slug, startAt: selected.startAt.toISOString(), endAt: selected.endAt.toISOString(), clientName: form.name, clientComment: form.comment }
      );
      if (res.needTelegramLogin) {
        alert("Чтобы записаться, нужно зайти через Telegram на этом сайте (кнопка Войти).");
      } else {
        alert("Заявка отправлена! Подтверждение придёт вам в Telegram.");
        setSelected(null);
        setForm({ name: "", comment: "" });
        setBusy((prev) => [...prev, { start_at: selected.startAt.toISOString(), end_at: selected.endAt.toISOString(), status: "pending" }]);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <h1>Запись к {profile.display_name ?? profile.slug}</h1>
      <p className="muted">Выберите свободный слот. Подтверждение придёт вам в Telegram.</p>

      <div className="slots">
        {freeSlots.length === 0 && <div className="muted">Нет свободных слотов на ближайшие 7 дней.</div>}
        {freeSlots.map((s) => {
          const key = s.startAt.toISOString();
          const isSel = selected?.startAt.toISOString() === key;
          return (
            <button key={key} className={`slot ${isSel ? "selected" : ""}`} onClick={() => setSelected(s)}>
              {s.startAt.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="modal">
          <h2>Заявка на {selected.startAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</h2>

          <label className="label">Ваше имя</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <label className="label">Комментарий (опционально)</label>
          <textarea className="input" rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />

          <div className="row">
            <button className="btn" onClick={() => setSelected(null)} disabled={sending}>Отмена</button>
            <button className="btn primary" onClick={submit} disabled={sending}>{sending ? "..." : "Отправить заявку"}</button>
          </div>

          <div className="hint"><b>Важно:</b> для записи клиент должен быть залогинен через Telegram на сайте.</div>
        </div>
      )}
    </div>
  );
}
