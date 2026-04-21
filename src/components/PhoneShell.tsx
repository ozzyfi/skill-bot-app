import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { useSyncQueue, flushQueue } from "@/hooks/useSyncQueue";

const TabIcon = ({ name }: { name: "home" | "msg" | "user" }) => {
  if (name === "home")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>
    );
  if (name === "msg")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  );
};

export const PhoneShell = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { pending } = useSyncQueue();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  // Track real network changes + simulate toggle
  useEffect(() => {
    const onUp = () => { setOnline(true); flushQueue(); };
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  // Try a flush on mount in case there's pending work
  useEffect(() => { if (online) flushQueue(); }, []); // eslint-disable-line

  const isActive = (p: string) =>
    pathname === p ||
    (p === "/" && (pathname.startsWith("/machine") || pathname.startsWith("/job") || pathname.startsWith("/close")));

  return (
    <div className="device">
      <header className="flex justify-between items-center px-5 py-4 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="text-[22px] font-bold tracking-tight text-primary leading-none">ToolA</div>
          <div className="text-[13px] text-text-3 font-medium">{profile?.client ?? "Putzmeister"}</div>
        </div>
        <button
          className={`status-pill ${online ? "" : "offline"}`}
          onClick={() => setOnline((o) => !o)}
          title="Bağlantı durumunu değiştir (demo)"
        >
          {online ? "Çevrimiçi" : "Çevrimdışı"}
          {pending > 0 && <span className="ml-1 font-bold">· {pending}</span>}
        </button>
      </header>

      <main className="scroll-area">{children}</main>

      <nav className="tabbar">
        <button className={`tab-btn ${isActive("/") ? "active" : ""}`} onClick={() => navigate("/")}>
          <TabIcon name="home" />
          Ana Sayfa
        </button>
        <button className={`tab-btn ${pathname.startsWith("/diagnosis") ? "active" : ""}`} onClick={() => navigate("/diagnosis")}>
          <TabIcon name="msg" />
          Teşhis
        </button>
        <button className={`tab-btn ${pathname.startsWith("/profile") ? "active" : ""}`} onClick={() => navigate("/profile")}>
          <TabIcon name="user" />
          Profil
        </button>
      </nav>
    </div>
  );
};

