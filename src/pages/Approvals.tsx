import React from "react";
import { getJSON, postJSON } from "../lib/api";

type Booking = {
  id: string;
  start_at: string;
  end_at: string;
  client_name: string;
  client_comment: string | null;
  status: string;
};

export default function Approvals() {
  const [items, setItems] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    const res = await getJSON<{ ok: true; items: Booking[] }>("/.netlify/functions/listPending");
    setItems(res.items);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    await postJSON("/.netlify/functions/approveBooking", { bookingId: id, action });
    await load();
  }

  return (
    <div className="card">
      <h1>Заявки (web)</h1>
      <p className="muted">Основной поток — подтверждение кнопками в Telegram. Тут дублируем для теста.</p>

      {loading && <div>Загрузка...</div>}
      {!loading && items.length === 0 && <div className="muted">Нет заявок</div>}

      <div className="list">
        {items.map((b) => (
          <div key={b.id} className="listItem">
            <div>
              <div className="title">
                {new Date(b.start_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                {" — "}
                {new Date(b.end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="muted">{b.client_name}{b.client_comment ? ` • ${b.client_comment}` : ""}</div>
            </div>
            <div className="row">
              <button className="btn" onClick={() => act(b.id, "reject")}>Отказ</button>
              <button className="btn primary" onClick={() => act(b.id, "approve")}>ОК</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn" onClick={load}>Обновить</button>
    </div>
  );
}
