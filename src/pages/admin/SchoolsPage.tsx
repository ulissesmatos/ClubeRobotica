import { useState, useEffect, useCallback, useMemo } from "react";
import { AdminLayout } from "./AdminLayout";
import {
  School,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  GripVertical,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiListRawSchoolNames,
  apiListSchoolGroups,
  apiCreateSchoolGroup,
  apiUpdateSchoolGroup,
  apiDeleteSchoolGroup,
  apiRemoveSchoolAlias,
  type RawSchoolName,
  type SchoolGroup,
} from "@/api/admin";

// ─── Fuzzy similarity (Levenshtein normalizado) ───────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(escola|municipal|estadual|emeif|emef|emei|colegio|unidade|ensino|basica|de|da|do|e|em|a|o)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** Para um raw_name, retorna os grupos ordenados por similaridade (desc) */
function suggestGroups(rawName: string, groups: SchoolGroup[]) {
  return groups
    .map((g) => {
      const scores = [g.canonical_name, ...g.aliases].map((n) => similarity(rawName, n));
      return { group: g, score: Math.max(...scores) };
    })
    .filter((x) => x.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ─── NewGroupModal ────────────────────────────────────────────────────────────

function NewGroupModal({
  initialAlias,
  onConfirm,
  onCancel,
  saving,
}: {
  initialAlias: string;
  onConfirm: (canonical: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialAlias);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-bold text-foreground">Novo grupo</h3>
        <p className="text-sm text-muted-foreground">
          Nome oficial/canônico da escola: será exibido nos relatórios.
        </p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Ex: EMEF João da Silva"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(name.trim())}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar grupo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onRemoveAlias,
  onDelete,
  busy,
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  group: SchoolGroup;
  onRemoveAlias: (alias: string) => void;
  onDelete: () => void;
  busy: boolean;
  isDragOver: boolean;
  onDragOver: React.DragEventHandler<HTMLDivElement>;
  onDragEnter: React.DragEventHandler<HTMLDivElement>;
  onDragLeave: React.DragEventHandler<HTMLDivElement>;
  onDrop: React.DragEventHandler<HTMLDivElement>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-all ${
        isDragOver
          ? "border-primary ring-2 ring-primary/30 bg-primary/5 scale-[1.01]"
          : "border-border"
      }`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 text-left">
          <School className={`w-4 h-4 shrink-0 ${isDragOver ? "text-primary" : "text-primary"}`} />
          <span className="font-semibold text-sm text-foreground">{group.canonical_name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {group.count} inscr.
          </span>
          <span className="text-xs text-muted-foreground">
            · {group.aliases.length} variação{group.aliases.length !== 1 ? "ões" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDragOver && (
            <span className="text-xs text-primary font-semibold animate-pulse">Solte aqui</span>
          )}
          {!busy && !isDragOver && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="Excluir grupo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/20">
          {group.aliases.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">Nenhuma variação mapeada.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-2">
              {group.aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-1 bg-white border border-border rounded-lg px-2.5 py-1 text-xs text-foreground"
                >
                  {alias}
                  <button
                    onClick={() => onRemoveAlias(alias)}
                    disabled={busy}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                    title="Remover variação"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SchoolsPage ──────────────────────────────────────────────────────────────

export default function SchoolsPage() {
  const { accessToken } = useAuth();

  const [rawNames, setRawNames]   = useState<RawSchoolName[]>([]);
  const [groups,   setGroups]     = useState<SchoolGroup[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState("");
  const [toast,    setToast]      = useState("");

  // Item selecionado na coluna esquerda
  const [selected, setSelected] = useState<RawSchoolName | null>(null);

  // Drag-and-drop state
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<number | "new" | null>(null);

  // Modal de novo grupo — alias pode vir de click ou de drag
  const [modalAlias, setModalAlias] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [saving, setSaving] = useState(false);

  // busy set (alias removals / group deletes)
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [r, g] = await Promise.all([
        apiListRawSchoolNames(accessToken),
        apiListSchoolGroups(accessToken),
      ]);
      setRawNames(r);
      setGroups(g);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  // Nomes sem grupo (não mapeados)
  const unclassified = useMemo(
    () => rawNames.filter((n) => n.group_id === null),
    [rawNames]
  );

  // Sugestões fuzzy para o item selecionado
  const suggestions = useMemo(
    () => (selected ? suggestGroups(selected.raw_name, groups) : []),
    [selected, groups]
  );

  async function handleAddToGroup(rawName: string, group: SchoolGroup) {
    if (!accessToken) return;
    const key = `alias-${rawName}`;
    setBusy((b) => new Set(b).add(key));
    try {
      const updated = await apiUpdateSchoolGroup(accessToken, group.id, {
        add_aliases: [rawName],
      });
      setGroups((gs) => gs.map((g) => (g.id === updated.id ? updated : g)));
      setRawNames((rs) =>
        rs.map((r) =>
          r.raw_name === rawName
            ? { ...r, group_id: group.id, canonical_name: group.canonical_name }
            : r
        )
      );
      if (selected?.raw_name === rawName) setSelected(null);
      showToast(`"${rawName}" adicionado ao grupo "${group.canonical_name}".`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(key); return n; });
    }
  }

  async function handleCreateGroup(canonical: string) {
    if (!accessToken || !modalAlias || !canonical) return;
    setSaving(true);
    try {
      const group = await apiCreateSchoolGroup(accessToken, canonical, [modalAlias]);
      setGroups((gs) => [...gs, group].sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)));
      setRawNames((rs) =>
        rs.map((r) =>
          r.raw_name === modalAlias
            ? { ...r, group_id: group.id, canonical_name: group.canonical_name }
            : r
        )
      );
      if (selected?.raw_name === modalAlias) setSelected(null);
      setShowNewGroup(false);
      setModalAlias("");
      showToast(`Grupo "${canonical}" criado com sucesso.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar grupo.");
    } finally {
      setSaving(false);
    }
  }

  // ── Drag handlers ──
  function handleDragStart(n: RawSchoolName, e: React.DragEvent) {
    setDraggingName(n.raw_name);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", n.raw_name);
  }

  function handleDragEnd() {
    setDraggingName(null);
    setDragOverId(null);
  }

  function handleDropOnGroup(group: SchoolGroup, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const name = e.dataTransfer.getData("text/plain") || draggingName;
    if (!name) return;
    setDraggingName(null);
    handleAddToGroup(name, group);
  }

  function handleDropOnNew(e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const name = e.dataTransfer.getData("text/plain") || draggingName;
    if (!name) return;
    setDraggingName(null);
    setModalAlias(name);
    setShowNewGroup(true);
  }

  async function handleRemoveAlias(alias: string) {
    if (!accessToken) return;
    const key = `rm-${alias}`;
    setBusy((b) => new Set(b).add(key));
    try {
      await apiRemoveSchoolAlias(accessToken, alias);
      setGroups((gs) =>
        gs.map((g) => ({
          ...g,
          aliases: g.aliases.filter((a) => a !== alias),
          count: g.aliases.includes(alias) ? g.count : g.count,
        }))
      );
      setRawNames((rs) =>
        rs.map((r) =>
          r.raw_name === alias ? { ...r, group_id: null, canonical_name: null } : r
        )
      );
      showToast("Variação removida do grupo.");
      await load();
    } catch {
      setError("Erro ao remover variação.");
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(key); return n; });
    }
  }

  async function handleDeleteGroup(groupId: number) {
    if (!accessToken) return;
    const key = `del-${groupId}`;
    setBusy((b) => new Set(b).add(key));
    try {
      await apiDeleteSchoolGroup(accessToken, groupId);
      setGroups((gs) => gs.filter((g) => g.id !== groupId));
      await load();
      showToast("Grupo excluído.");
    } catch {
      setError("Erro ao excluir grupo.");
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(key); return n; });
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando escolas...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}

      {showNewGroup && (
        <NewGroupModal
          initialAlias={modalAlias}
          onConfirm={handleCreateGroup}
          onCancel={() => { setShowNewGroup(false); setModalAlias(""); }}
          saving={saving}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Agrupamento de Escolas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mapeie os nomes digitados pelos pais para uma escola oficial. Os dados das inscrições não são alterados.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-3">
          <School className="w-5 h-5 text-primary" />
          <div>
            <p className="text-lg font-bold leading-none">{rawNames.length}</p>
            <p className="text-xs text-muted-foreground">nomes únicos</p>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-lg font-bold leading-none">{rawNames.filter(n => n.group_id).length}</p>
            <p className="text-xs text-muted-foreground">mapeados</p>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-lg font-bold leading-none">{unclassified.length}</p>
            <p className="text-xs text-muted-foreground">sem grupo</p>
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <div>
            <p className="text-lg font-bold leading-none">{groups.length}</p>
            <p className="text-xs text-muted-foreground">grupos criados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Coluna esquerda: nomes sem grupo ── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Nomes sem grupo ({unclassified.length})
          </h2>

          {draggingName && (
            <p className="text-xs text-primary font-semibold text-center mb-2 animate-pulse">
              Arraste e solte sobre um grupo →
            </p>
          )}

          {unclassified.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-2xl text-muted-foreground text-sm gap-2">
              <CheckCircle className="w-8 h-8 text-green-500 opacity-60" />
              Todos os nomes estão mapeados!
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {unclassified.map((n) => {
                const isSelected = selected?.raw_name === n.raw_name;
                const isDragging = draggingName === n.raw_name;
                return (
                  <div
                    key={n.raw_name}
                    draggable
                    onDragStart={(e) => handleDragStart(n, e)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelected(isSelected ? null : n)}
                    className={`cursor-grab active:cursor-grabbing w-full text-left flex items-center justify-between px-3 py-3 rounded-xl border transition-all select-none ${
                      isDragging
                        ? "opacity-40 scale-95 border-dashed border-primary"
                        : isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-white hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                      <span className="text-sm text-foreground truncate">{n.raw_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                      {n.count}×
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Painel de ação quando há seleção */}
          {selected && (
            <div className="mt-4 bg-white border border-primary/30 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Ação para: "{selected.raw_name}"
              </p>

              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Sugestões por similaridade:
                  </p>
                  {suggestions.map(({ group, score }) => (
                    <button
                      key={group.id}
                      onClick={() => handleAddToGroup(selected.raw_name, group)}
                      disabled={busy.has(`alias-${selected.raw_name}`)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-sm disabled:opacity-50"
                    >
                      <span className="font-medium text-foreground truncate max-w-[75%]">
                        {group.canonical_name}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        {Math.round(score * 100)}% similar
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {groups.length > suggestions.length && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Outros grupos:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {groups
                      .filter((g) => !suggestions.find((s) => s.group.id === g.id))
                      .map((g) => (
                        <button
                          key={g.id}
                          onClick={() => handleAddToGroup(selected.raw_name, g)}
                          disabled={busy.has(`alias-${selected.raw_name}`)}
                          className="w-full text-left px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted/40 transition-colors disabled:opacity-50 truncate"
                        >
                          {g.canonical_name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setModalAlias(selected.raw_name); setShowNewGroup(true); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-primary/40 text-primary rounded-xl text-sm font-semibold hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar novo grupo com este nome
              </button>
            </div>
          )}
        </div>

        {/* ── Coluna direita: grupos ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Grupos ({groups.length})
            </h2>
            <button
              onClick={() => { setSelected(null); setModalAlias(""); setShowNewGroup(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo grupo vazio
            </button>
          </div>

          {groups.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl text-muted-foreground text-sm gap-2 transition-colors ${
                dragOverId === "new"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverId("new"); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={handleDropOnNew}
            >
              <School className="w-8 h-8 opacity-40" />
              {dragOverId === "new" ? "Solte para criar novo grupo" : "Nenhum grupo criado ainda."}
              <span className="text-xs">Selecione ou arraste um nome à esquerda para começar.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  onRemoveAlias={(alias) => handleRemoveAlias(alias)}
                  onDelete={() => handleDeleteGroup(g.id)}
                  busy={busy.has(`rm-${g.id}`) || busy.has(`del-${g.id}`)}
                  isDragOver={dragOverId === g.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(g.id); }}
                  onDragEnter={(e) => { e.preventDefault(); setDragOverId(g.id); }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null);
                  }}
                  onDrop={(e) => handleDropOnGroup(g, e)}
                />
              ))}
              {/* zona para criar novo grupo via drag */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverId("new"); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={handleDropOnNew}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors ${
                  dragOverId === "new"
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {dragOverId === "new" ? "Solte para criar novo grupo" : "Arraste aqui para criar novo grupo"}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
