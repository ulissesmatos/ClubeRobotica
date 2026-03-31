import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import {
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
  Download,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiListSubmissions,
  apiListForms,
  apiCountByForm,
  apiExportSubmissions,
  type SubmissionListItem,
  type PaginatedSubmissions,
  type FormRow,
  type SubmissionStatus,
} from "@/api/admin";
import { apiListSchoolGroups, type SchoolGroup } from "@/api/admin";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente:  "bg-amber-100 text-amber-800 border-amber-200",
    aprovado:  "bg-green-100 text-green-800 border-green-200",
    rejeitado: "bg-red-100 text-red-800 border-red-200",
  };
  const labels: Record<string, string> = {
    pendente: "Pendente", aprovado: "Deferido", rejeitado: "Indeferido",
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

// ─── Pagination helper ───────────────────────────────────────────────────────

function getPaginationPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set(
    [1, current - 1, current, current + 1, total].filter((n) => n >= 1 && n <= total)
  );
  const sorted = Array.from(set).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (const n of sorted) {
    const last = result[result.length - 1];
    if (typeof last === "number" && n - last > 1) result.push("…");
    result.push(n);
  }
  return result;
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { accessToken } = useAuth();

  // Data
  const [data, setData]   = useState<PaginatedSubmissions | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [groups, setGroups] = useState<SchoolGroup[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  // Filters — estado persistido na URL para que o botão Voltar restaure a página/filtros
  const [searchParams, setSearchParams] = useSearchParams();
  const page          = Math.max(1, Number(searchParams.get("page")) || 1);
  const formId        = searchParams.get("formId") ? Number(searchParams.get("formId")) : undefined;
  const status        = (searchParams.get("status") as SubmissionStatus) || undefined;
  const search        = searchParams.get("search") || "";
  const dateFrom      = searchParams.get("dateFrom") || "";
  const dateTo        = searchParams.get("dateTo") || "";
  const schoolGroupId = searchParams.get("schoolGroupId") ? Number(searchParams.get("schoolGroupId")) : undefined;
  const [searchInput, setSearchInput] = useState(search);

  // UI
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [showFilters, setShowFilters] = useState(
    !!(searchParams.get("formId") || searchParams.get("status") || searchParams.get("dateFrom") || searchParams.get("dateTo") || searchParams.get("schoolGroupId"))
  );

  // Form submission counts for filter labels
  const [formCounts, setFormCounts] = useState<Record<number, number>>({});

  // Fetch forms list and counts for filter dropdown (once)
  useEffect(() => {
    if (!accessToken) return;
    apiListForms(accessToken).then(setForms).catch(() => {});
    apiListSchoolGroups(accessToken).then(setGroups).catch(() => {});
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
      schoolGroupId,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, page, formId, status, search, dateFrom, dateTo, schoolGroupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function updateParams(updates: Record<string, string | undefined>, resetPage = true) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v); else next.delete(k);
      }
      if (resetPage) next.set("page", "1");
      return next;
    }, { replace: true });
  }

  function goToPage(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(p));
      return next;
    }, { replace: true });
  }

  function applySearch() {
    updateParams({ search: searchInput.trim() || undefined });
  }

  function clearFilters() {
    setSearchInput("");
    setSearchParams({}, { replace: true });
  }

  async function handleExport() {
    if (!accessToken) return;
    setExporting(true);
    setExportError("");
    try {
      const blob = await apiExportSubmissions(accessToken, formId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inscricoes_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : "Erro ao exportar.");
    } finally {
      setExporting(false);
    }
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
          label="Deferidos"
          value={counts.approved}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <SummaryCard
          label="Indeferidos"
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

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            title={formId ? "Exportar turma filtrada" : "Exportar todas as inscrições"}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? "Exportando..." : "Excel"}
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

        {/* Export error */}
        {exportError && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>{exportError}</span>
            <button onClick={() => setExportError("")} className="text-red-400 hover:text-red-600 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Expandable filters */}
        {showFilters && (
          <div className="px-5 pb-3 pt-3 border-b border-border bg-muted/30 flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Escola</label>
              <select
                value={schoolGroupId ?? ""}
                onChange={(e) => updateParams({ schoolGroupId: e.target.value || undefined })}
                className="w-40 px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todas</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.canonical_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Formulário</label>
              <select
                value={formId ?? ""}
                onChange={(e) => updateParams({ formId: e.target.value || undefined })}
                className="w-40 px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>{f.title} ({formCounts[f.id] ?? 0})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={status ?? ""}
                onChange={(e) => updateParams({ status: e.target.value || undefined })}
                className="w-32 px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Deferido</option>
                <option value="rejeitado">Indeferido</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => updateParams({ dateFrom: e.target.value || undefined })}
                className="w-36 px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => updateParams({ dateTo: e.target.value || undefined })}
                className="w-36 px-2 py-1.5 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
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
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {getPaginationPages(page, data.totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`ell-${i}`} className="px-1 select-none text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(page + 1)}
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
