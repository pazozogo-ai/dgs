import React from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PublicSchedule from "./pages/PublicSchedule";
import Approvals from "./pages/Approvals";
import { getJSON, postJSON } from "./lib/api";

type Me =
  | { ok: true; user: { id: string; telegram_user_id: string; display_name: string | null; slug: string; timezone: string; slot_minutes: number; day_start: number; day_end: number } }
  | { ok: false };

function useMe() {
  const [me, setMe] = React.useState<Me | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const data = await getJSON<Me>("/.netlify/functions/getMe");
        setMe(data);
      } catch {
        setMe({ ok: false });
      }
    })();
  }, []);
  return me;
}

function Topbar({ authed, onLogout }: { authed: boolean; onLogout: () => void }) {
  return (
    <div className="topbar">
      <Link to="/" className="brand">SchedLinks</Link>
      <div className="spacer" />
      {authed ? (
        <>
          <Link to="/approvals">Заявки</Link>
          <button className="btn" onClick={onLogout}>Выйти</button>
        </>
      ) : (
        <Link to="/login">Войти</Link>
      )}
    </div>
  );
}

export default function App() {
  const me = useMe();
  const nav = useNavigate();

  async function logout() {
    await postJSON("/.netlify/functions/logout", {});
    nav("/login");
    window.location.reload();
  }

  if (me === null) return <div className="container"><div className="card">Загрузка...</div></div>;
  const authed = me.ok === true;

  return (
    <div className="container">
      <Topbar authed={authed} onLogout={logout} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={authed ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/approvals" element={authed ? <Approvals /> : <Navigate to="/login" replace />} />
        <Route path="/u/:slug" element={<PublicSchedule />} />
        <Route path="*" element={<div className="card">404</div>} />
      </Routes>
    </div>
  );
}
