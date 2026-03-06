import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const MAX_ATTEMPTS = 5;

export default function LoginPage() {
  const { login, admin, isInitializing } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown]     = useState(0);

  // Already authenticated → go to dashboard
  useEffect(() => {
    if (!isInitializing && admin) navigate("/admin/dashboard", { replace: true });
  }, [admin, isInitializing, navigate]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setCountdown(0);
        clearInterval(id);
      } else {
        setCountdown(remaining);
      }
    }, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = !!lockedUntil && Date.now() < lockedUntil;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked || loading) return;

    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/admin/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar.";
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        const unlockAt = Date.now() + 15 * 60 * 1000;
        setLockedUntil(unlockAt);
        setError("Muitas tentativas. Aguarde 15 minutos.");
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(`${msg} (${remaining} tentativa${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""})`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--navy))] to-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-3">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-white/60 text-sm mt-1">Programa de Robótica</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Entrar</h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center">
              <p className="text-sm font-semibold text-amber-800">Acesso bloqueado</p>
              <p className="text-xs text-amber-700 mt-1">
                Tente novamente em{" "}
                <span className="font-mono font-bold">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@exemplo.com"
                required
                disabled={isLocked || loading}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLocked || loading}
                  className="w-full px-4 py-2.5 pr-11 border border-border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLocked || loading || !email || !password}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
