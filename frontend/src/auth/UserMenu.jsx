import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, Cloud, Download, Upload, User } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

export default function UserMenu({ onBackup, onRestore }) {
  const { user, setLoginOpen, logout } = useAuth();

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="glass-panel h-11 md:h-12 rounded-xl px-3 md:px-4 gap-2 text-emerald-50 hover:bg-emerald-950/60 hover:text-emerald-300 flex-shrink-0"
        onClick={() => setLoginOpen(true)}
        data-testid="btn-open-login"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden md:inline text-xs font-semibold">Accedi</span>
      </Button>
    );
  }

  const initial = (user.name || user.email || "U").trim()[0].toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="glass-panel h-11 md:h-12 rounded-xl px-2 md:px-3 gap-2 text-emerald-50 hover:bg-emerald-950/60 hover:text-emerald-300 flex-shrink-0"
          data-testid="btn-user-menu"
        >
          {user.picture ? (
            <img src={user.picture} alt="" className="w-7 h-7 rounded-full border border-emerald-500/40" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">{initial}</div>
          )}
          <span className="hidden md:inline text-xs font-semibold truncate max-w-[100px]">{user.name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass-panel border-stone-700 text-stone-100">
        <DropdownMenuLabel className="text-emerald-400 text-[10px] uppercase tracking-widest">Account</DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs">
          <div className="text-stone-100 font-semibold truncate">{user.name}</div>
          <div className="text-stone-500 text-[11px] truncate">{user.email}</div>
        </div>
        <DropdownMenuSeparator className="bg-stone-800" />
        <div className="px-2 py-1 text-[10px] text-emerald-300 font-mono flex items-center gap-1">
          <Cloud className="w-3 h-3" /> Sincronizzato
        </div>
        <DropdownMenuSeparator className="bg-stone-800" />
        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-emerald-900/40" onClick={onBackup} data-testid="menu-backup">
          <Download className="w-3.5 h-3.5 mr-2 text-emerald-400" /> Backup JSON
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-emerald-900/40" onClick={onRestore} data-testid="menu-restore">
          <Upload className="w-3.5 h-3.5 mr-2 text-emerald-400" /> Ripristina Backup
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-stone-800" />
        <DropdownMenuItem className="text-xs cursor-pointer focus:bg-red-950/40 text-red-400" onClick={logout} data-testid="menu-logout">
          <LogOut className="w-3.5 h-3.5 mr-2" /> Disconnetti
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
