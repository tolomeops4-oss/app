import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Mail, Lock, User as UserIcon, Chrome, LogIn, UserPlus } from "lucide-react";

function formatApiErrorDetail(detail) {
  if (detail == null) return "Errore, riprova.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function LoginDialog({ open, onOpenChange, onSuccess }) {
  const { loginEmail, registerEmail } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        await loginEmail(email.trim(), password);
        toast.success("Accesso effettuato");
      } else {
        await registerEmail(email.trim(), password, name.trim());
        toast.success("Account creato");
      }
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-stone-700 text-stone-100 max-w-md" data-testid="login-dialog">
        <DialogHeader>
          <DialogTitle className="text-emerald-300 font-bold text-xl tracking-tight">
            {mode === "login" ? "Accedi al tuo account" : "Crea un nuovo account"}
          </DialogTitle>
          <DialogDescription className="text-stone-400 text-xs">
            Sincronizza i tuoi campi tra più dispositivi e non perdere i tuoi progetti.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          onClick={handleGoogle}
          className="w-full h-11 bg-white text-stone-900 hover:bg-stone-100 font-semibold gap-2"
          data-testid="btn-google-login"
        >
          <Chrome className="w-4 h-4" /> Continua con Google
        </Button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-800"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-stone-950 px-2 text-stone-500">oppure</span></div>
        </div>

        <form onSubmit={submit} className="space-y-3" data-testid="form-auth-email">
          {mode === "register" && (
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-widest text-stone-400">Nome</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" className="pl-9 bg-stone-900/60 border-stone-700 h-10" data-testid="input-auth-name" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-widest text-stone-400">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="tuonome@email.it" className="pl-9 bg-stone-900/60 border-stone-700 h-10" data-testid="input-auth-email" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-widest text-stone-400">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Almeno 6 caratteri" className="pl-9 bg-stone-900/60 border-stone-700 h-10" data-testid="input-auth-password" />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2" data-testid="btn-submit-auth">
            {mode === "login" ? <><LogIn className="w-4 h-4" /> Accedi</> : <><UserPlus className="w-4 h-4" /> Crea Account</>}
          </Button>
        </form>

        <div className="text-center text-xs text-stone-400">
          {mode === "login" ? (
            <>Non hai un account? <button onClick={() => setMode("register")} className="text-emerald-300 hover:underline font-semibold" data-testid="btn-switch-to-register">Registrati</button></>
          ) : (
            <>Hai già un account? <button onClick={() => setMode("login")} className="text-emerald-300 hover:underline font-semibold" data-testid="btn-switch-to-login">Accedi</button></>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
