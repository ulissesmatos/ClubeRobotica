import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Bot,
  LogOut,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiListSubmissions,
  apiListForms,
  apiCountByForm,
  type SubmissionListItem,
  type PaginatedSubmissions,
  type FormRow,
  type SubmissionStatus,
} from "@/api/admin";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente:  "bg-amber-100 text-amber-800 border-amber-200",
    aprovado:  "bg-green-100 text-green-800 border-green-200",
    rejeitado: "bg-red-100 text-red-800 border-red-200",
  };
  const labels: Record<string, string> = {
    pendente: "Pendente", aprovado: "Aprovado", rejeitado: "Rejeitado",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, color,
}: {
  label: string; value: number | string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navLink = (to: string, label: string, matchPrefixes: string[]) => {
    const isActive = matchPrefixes.some((p) => pathname.startsWith(p));
    return (
      <Link
        to={to}
        className={`text-sm transition-colors ${
          isActive
            ? "text-white font-semibold border-b border-white/60 pb-0.5"
            : "text-white/80 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

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
          <span className="text-white/70 text-sm hidden sm:inline">Programa de Robótica</span>
        </div>
        <nav className="flex items-center gap-4">
          {navLink("/admin/dashboard", "Inscrições", ["/admin/dashboard", "/admin/submissions"])}
          {navLink("/admin/forms", "Turmas", ["/admin/forms"])}
          <span className="text-white/30">|</span>
          <span className="text-sm text-white/70 hidden sm:inline">{admin?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { accessToken } = useAuth();

  // Data
  const [data, setData]   = useState<PaginatedSubmissions | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  // Filters
  const [search,    setSearch]    = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [formId,    setFormId]    = useState<number | undefined>();
  const [status,    setStatus]    = useState<SubmissionStatus | undefined>();
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [page,      setPage]      = useState(1);

  // UI
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Form submission counts for filter labels
  const [formCounts, setFormCounts] = useState<Record<number, number>>({});

  // Fetch forms list and counts for filter dropdown (once)
  useEffect(() => {
    if (!accessToken) return;
    apiListForms(accessToken).then(setForms).catch(() => {});
    apiCountByForm(accessToken)
      .then((counts) => {
        const map: Record<number, number> = {};
        for (const c of counts) map[c.form_id] = c.count;
        setFormCounts(map);
      })
      .catch(() => {});
  }, [accessToken]);

  // Fetch summary counts (once + on refresh)
  const fetchCounts = useCallback(() => {
    if (!accessToken) return;
    Promise.all([
      apiListSubmissions(accessToken, { status: "pendente",  pageSize: 1, page: 1 }),
      apiListSubmissions(accessToken, { status: "aprovado",  pageSize: 1, page: 1 }),
      apiListSubmissions(accessToken, { status: "rejeitado", pageSize: 1, page: 1 }),
    ]).then(([p, a, r]) => {
      setCounts({ pending: p.total, approved: a.total, rejected: r.total });
    }).catch(() => {});
  }, [accessToken]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Main data fetch
  const fetchData = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    apiListSubmissions(accessToken, {
      page,
      pageSize: PAGE_SIZE,
      formId,
      status,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo:   dateTo   || undefined,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, page, formId, status, search, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [formId, status, search, dateFrom, dateTo]);

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setFormId(undefined);
    setStatus(undefined);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const total = data?.total ?? 0;

  return (
    <AdminLayout>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total de inscrições"
          value={total}
          icon={<Users className="w-5 h-5 text-primary" />}
          color="bg-[hsl(var(--sky))]"
        />
        <SummaryCard
          label="Pendentes"
          value={counts.pending}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
        <SummaryCard
          label="Aprovados"
          value={counts.approved}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <SummaryCard
          label="Rejeitados"
          value={counts.rejected}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          color="bg-red-50"
        />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b border-border flex flex-wrap gap-3 items-center">
          <h2 className="font-bold text-foreground text-lg mr-auto">Inscrições</h2>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                className="pl-9 pr-3 py-2 border border-border rounded-lg text-sm w-48 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              onClick={applySearch}
              className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Buscar
            </button>
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>

          {/* Refresh */}
          <button
            onClick={() => { fetchData(); fetchCounts(); }}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="px-5 pb-4 pt-3 border-b border-border bg-muted/30 flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Formulário</label>
              <select
                value={formId ?? ""}
                onChange={(e) => setFormId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>{f.title} ({formCounts[f.id] ?? 0})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={status ?? ""}
                onChange={(e) => setStatus((e.target.value as SubmissionStatus) || undefined)}
                className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-destructive text-sm gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhuma inscrição encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Protocolo</th>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Turma</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Data</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item: SubmissionListItem) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.protocol || `#${item.id}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                      {item.nome_completo ?? <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[180px] truncate">
                      {item.form_title}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {new Date(item.submitted_at + "Z").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/admin/submissions/${item.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} de {data.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-foreground">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
