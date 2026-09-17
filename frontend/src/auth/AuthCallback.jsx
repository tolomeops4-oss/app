import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSessionFromGoogle } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = location.hash || window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/"); return; }
    const session_id = decodeURIComponent(match[1]);
    (async () => {
      try {
        const u = await setSessionFromGoogle(session_id);
        toast.success(`Benvenuto ${u.name || u.email}`);
        // Clear hash and navigate to root
        try { window.history.replaceState(null, "", "/"); } catch(e){}
        navigate("/", { replace: true, state: { user: u, claimGuest: true } });
      } catch (e) {
        toast.error("Accesso Google non riuscito");
        navigate("/", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 flex items-center justify-center">
      <div className="text-emerald-300 font-mono text-sm animate-pulse">Accesso in corso...</div>
    </div>
  );
}
