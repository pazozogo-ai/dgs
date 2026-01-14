import React from "react";
import { postJSON } from "../lib/api";

export default function Login() {
  const [loading, setLoading] = React.useState(false);
  const [tgLink, setTgLink] = React.useState<string | null>(null);

  async function start() {
    setLoading(true);
    try {
      const res = await postJSON<{ ok: true; telegramLink: string }>("/.netlify/functions/authStart", {});
      setTgLink(res.telegramLink);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>Вход</h1>
      <p className="muted">
        Логин через Telegram. Нажми кнопку, откроется бот, подтверди вход — бот пришлёт ссылку.
      </p>

      <button className="btn primary" onClick={start} disabled={loading}>
        {loading ? "..." : "Войти через Telegram"}
      </button>

      {tgLink && (
        <div className="modal">
          <h2>Шаг 2</h2>
          <p className="muted">Открой бота и нажми “Подтвердить вход”.</p>
          <a className="btn" href={tgLink} target="_blank" rel="noreferrer">Открыть Telegram бота</a>
          <div className="hint">
            После подтверждения бот пришлёт magic‑link. Открой её в этом же браузере.
          </div>
        </div>
      )}
    </div>
  );
}
