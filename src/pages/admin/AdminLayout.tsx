import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Bot, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  {
    to: "/admin/dashboard",
    label: "Inscrições",
    prefixes: ["/admin/dashboard", "/admin/submissions"],
  },
  {
    to: "/admin/forms",
    label: "Turmas",
    prefixes: ["/admin/forms"],
  },
  {
    to: "/admin/settings",
    label: "Configurações",
    prefixes: ["/admin/settings"],
  },
];

export function AdminLayout({
  children,
  contentClassName = "max-w-7xl mx-auto px-4 py-8",
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => pathname.startsWith(p));

  async function handleLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[hsl(var(--navy))] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-secondary" />
          <span className="font-bold text-base">Painel Admin</span>
          <span className="text-white/40 hidden sm:inline">·</span>
          <span className="text-white/70 text-sm hidden sm:inline">
            Programa de Robótica
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`text-sm transition-colors ${
                isActive(item.prefixes)
                  ? "text-white font-semibold border-b border-white/60 pb-0.5"
                  : "text-white/80 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <span className="text-white/30">|</span>
          <span className="text-sm text-white/70">{admin?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-white/80 hover:text-white p-1"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Menu"
        >
          {mobileOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="sm:hidden bg-[hsl(var(--navy))] border-t border-white/10 px-6 py-4 flex flex-col gap-4 shadow-lg">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`text-sm transition-colors ${
                isActive(item.prefixes)
                  ? "text-white font-semibold"
                  : "text-white/75 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <hr className="border-white/10" />
          <span className="text-xs text-white/50">{admin?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors w-fit"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      )}

      {contentClassName ? (
        <main className={contentClassName}>{children}</main>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
