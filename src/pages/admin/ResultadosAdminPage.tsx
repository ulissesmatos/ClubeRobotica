import { useState, useEffect, useCallback, useMemo } from "react";
import { AdminLayout } from "./AdminLayout";
import {
  apiGetResultados,
  apiLinkResultado,
  apiUnlinkResultado,
  apiDeleteResultado,
  apiAddResultado,
  apiAutoLink,
  apiBulkApprove,
  type PublicResultItem,
  type DuplicateGroup,
  type MissingEntry,
  type UnmatchedEntry,
  type MatchStatus,
} from "@/api/resultados-admin";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Link2, Link2Off, Trash2, Plus, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Wand2, CheckSquare } from "lucide-react";

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  if (score >= 95) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300">✓ {score}% Muito provável</span>;
  if (score >= 80) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">~ {score}% Provável</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">? {score}% Possível</span>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MatchStatus }) {
  switch (status) {
    case "confirmed":
      return <span className="flex items-center gap-1 text-xs text-green-700 font-semibold"><CheckCircle className="w-3.5 h-3.5" />Confirmado</span>;
    case "rejected":
      return <span className="flex items-center gap-1 text-xs text-red-700 font-semibold"><XCircle className="w-3.5 h-3.5" />Rejeitado</span>;
    case "manual":
      return <span className="flex items-center gap-1 text-xs text-blue-700 font-semibold"><Plus className="w-3.5 h-3.5" />Manual</span>;
    default:
      return <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />Pendente</span>;
  }
}

// ─── Resultado row ────────────────────────────────────────────────────────────

function ResultRow({
  item,
  onLink,
  onUnlink,
  onDelete,
}: {
  item: PublicResultItem;
  onLink: (id: number, submissionId: number) => Promise<void>;
  onUnlink: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [selectedCandidate, setSelectedCandidate] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const resultadoLabel =
    item.resultado === "aprovado"
      ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Aprovado</span>
      : <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">Reserva</span>;

  async function handleLink() {
    if (!selectedCandidate) return;
    setBusy(true);
    try {
      await onLink(item.id, selectedCandidate as number);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    try {
      await onUnlink(item.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover "${item.nome_completo}" da lista?`)) return;
    setBusy(true);
    try {
      await onDelete(item.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2.5 min-w-[220px]">
        <div className="font-medium text-sm text-gray-900">{item.nome_completo}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {resultadoLabel}
          <StatusBadge status={item.match_status} />
        </div>
      </td>
      <td className="px-3 py-2.5 min-w-[200px]">
        {item.match_status === "confirmed" && item.linked_protocol ? (
          <div className="text-sm">
            <span className="font-semibold text-green-700">{item.linked_protocol}</span>
            {item.linked_nome && (
              <div className="text-xs text-gray-500 truncate max-w-[180px]">{item.linked_nome}</div>
            )}
          </div>
        ) : item.candidates.length > 0 ? (
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {item.candidates.length} candidato{item.candidates.length !== 1 ? "s" : ""}
            </button>
            {expanded && (
              <div className="flex flex-col gap-1">
                {item.candidates.map((c) => (
                  <label key={c.submission_id} className="flex items-start gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`candidate-${item.id}`}
                      value={c.submission_id}
                      checked={selectedCandidate === c.submission_id}
                      onChange={() => setSelectedCandidate(c.submission_id)}
                      className="mt-0.5"
                    />
                    <span className="text-xs">
                      <span className="font-medium text-gray-800">{c.nome_inscricao}</span>
                      <span className="text-gray-400 ml-1">({c.protocol})</span>
                      <span className="ml-1"><ScoreBadge score={c.score} /></span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">Sem candidatos</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {item.match_status !== "confirmed" && selectedCandidate !== "" && (
            <button
              onClick={handleLink}
              disabled={busy}
              title="Confirmar vínculo"
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Vincular
            </button>
          )}
          {item.match_status === "confirmed" && (
            <button
              onClick={handleUnlink}
              disabled={busy}
              title="Remover vínculo"
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              Desvincular
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy}
            title="Remover da lista"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Tab 1: Vinculações ───────────────────────────────────────────────────────

function TabVinculacoes({
  items,
  onLink,
  onUnlink,
  onDelete,
}: {
  items: PublicResultItem[];
  onLink: (id: number, submissionId: number) => Promise<void>;
  onUnlink: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [filterEscola, setFilterEscola] = useState("");
  const [filterStatus, setFilterStatus] = useState<MatchStatus | "">("");
  const [filterResultado, setFilterResultado] = useState<"" | "aprovado" | "cadastro_reserva">("");

  const escolas = useMemo(() => {
    const s = new Set(items.map((i) => i.escola));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterEscola && i.escola !== filterEscola) return false;
      if (filterStatus && i.match_status !== filterStatus) return false;
      if (filterResultado && i.resultado !== filterResultado) return false;
      return true;
    });
  }, [items, filterEscola, filterStatus, filterResultado]);

  // Group by escola
  const grouped = useMemo(() => {
    const map = new Map<string, PublicResultItem[]>();
    for (const item of filtered) {
      if (!map.has(item.escola)) map.set(item.escola, []);
      map.get(item.escola)!.push(item);
    }
    return map;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: items.length,
    confirmed: items.filter((i) => i.match_status === "confirmed").length,
    pending: items.filter((i) => i.match_status === "pending").length,
    rejected: items.filter((i) => i.match_status === "rejected").length,
  }), [items]);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", value: stats.total, color: "text-gray-700" },
          { label: "Confirmados", value: stats.confirmed, color: "text-green-700" },
          { label: "Pendentes", value: stats.pending, color: "text-yellow-700" },
          { label: "Rejeitados", value: stats.rejected, color: "text-red-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterEscola}
          onChange={(e) => setFilterEscola(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todas as escolas</option>
          {escolas.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as MatchStatus | "")}
          className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="confirmed">Confirmado</option>
          <option value="rejected">Rejeitado</option>
          <option value="manual">Manual</option>
        </select>

        <select
          value={filterResultado}
          onChange={(e) => setFilterResultado(e.target.value as "" | "aprovado" | "cadastro_reserva")}
          className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Aprovado + Reserva</option>
          <option value="aprovado">Apenas Aprovado</option>
          <option value="cadastro_reserva">Apenas Reserva</option>
        </select>

        {(filterEscola || filterStatus || filterResultado) && (
          <button
            onClick={() => { setFilterEscola(""); setFilterStatus(""); setFilterResultado(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {grouped.size === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-10">Nenhum resultado encontrado.</p>
      ) : (
        Array.from(grouped.entries()).map(([escola, rows]) => (
          <div key={escola} className="mb-6">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2 border-b pb-1">
              {escola} <span className="font-normal text-gray-400">({rows.length})</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm bg-white">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-2">Nome no PDF</th>
                    <th className="px-3 py-2">Inscrição vinculada</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <ResultRow
                      key={item.id}
                      item={item}
                      onLink={onLink}
                      onUnlink={onUnlink}
                      onDelete={onDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Tab 2: Duplicatas ────────────────────────────────────────────────────────

function TabDuplicatas({
  duplicates,
  onDelete,
}: {
  duplicates: DuplicateGroup[];
  onDelete: (id: number) => Promise<void>;
}) {
  if (duplicates.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Nenhuma duplicata encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {duplicates.map((group) => (
        <div key={group.key} className="border border-yellow-300 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-4 py-2 flex items-center gap-2 border-b border-yellow-200">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-800">
              {group.entries[0]?.nome_completo} — {group.entries[0]?.escola}
            </span>
            <span className="ml-auto text-xs text-yellow-600">{group.entries.length} entradas</span>
          </div>
          <div className="bg-white divide-y divide-gray-100">
            {group.entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm text-gray-800">{entry.nome_completo}</span>
                  <span className="ml-2 text-xs text-gray-400">#{entry.id}</span>
                  <span className="ml-2">
                    {entry.resultado === "aprovado"
                      ? <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Aprovado</span>
                      : <span className="text-xs text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">Reserva</span>}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Remover entrada #${entry.id}?`)) return;
                    await onDelete(entry.id);
                  }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 3: Ausentes ──────────────────────────────────────────────────────────

function TabAusentes({
  missing,
  onAdd,
}: {
  missing: MissingEntry[];
  onAdd: (submissionId: number, nome: string, escola: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState<Set<number>>(new Set());
  const [escolaMap, setEscolaMap] = useState<Record<number, string>>({});

  if (missing.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Todos os aprovados estão no PDF.</p>
      </div>
    );
  }

  async function handleAdd(entry: MissingEntry) {
    const escola = escolaMap[entry.submission_id] ?? entry.escola_inscricao ?? "";
    if (!escola) {
      alert("Informe o nome exato da escola no campo abaixo.");
      return;
    }
    setAdding((prev) => new Set(prev).add(entry.submission_id));
    try {
      await onAdd(entry.submission_id, entry.nome_inscricao, escola);
    } finally {
      setAdding((prev) => {
        const s = new Set(prev);
        s.delete(entry.submission_id);
        return s;
      });
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Inscrições com status "aprovado" cujo nome não foi encontrado no PDF da escola correspondente.
        Você pode adicioná-las manualmente ao PDF.
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm bg-white">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2">Protocolo</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Escola (inscrição)</th>
              <th className="px-3 py-2">Escola PDF</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((entry) => (
              <tr key={entry.submission_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{entry.protocol}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900">{entry.nome_inscricao}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{entry.escola_inscricao ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <input
                    type="text"
                    placeholder="Nome exato da escola no PDF"
                    value={escolaMap[entry.submission_id] ?? entry.escola_inscricao ?? ""}
                    onChange={(e) =>
                      setEscolaMap((prev) => ({ ...prev, [entry.submission_id]: e.target.value }))
                    }
                    className="text-xs border border-gray-300 rounded px-2 py-1 w-52 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => handleAdd(entry)}
                    disabled={adding.has(entry.submission_id)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 ml-auto"
                  >
                    {adding.has(entry.submission_id)
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Plus className="w-3.5 h-3.5" />}
                    Adicionar ao PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Add Result Modal ─────────────────────────────────────────────────────────

function AddResultModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (nome: string, escola: string, resultado: "aprovado" | "cadastro_reserva") => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [escola, setEscola] = useState("");
  const [resultado, setResultado] = useState<"aprovado" | "cadastro_reserva">("aprovado");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !escola.trim()) { setError("Preencha todos os campos."); return; }
    setBusy(true);
    setError("");
    try {
      await onSave(nome.trim(), escola.trim(), resultado);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">Adicionar entrada manual</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Ex: JOÃO DA SILVA"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Escola</label>
            <input
              value={escola}
              onChange={(e) => setEscola(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Ex: UIME ESTEVAM"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resultado</label>
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value as "aprovado" | "cadastro_reserva")}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="aprovado">Aprovado</option>
              <option value="cadastro_reserva">Cadastro de Reserva</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={busy} className="text-sm px-4 py-1.5 rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Tab 4: Sem inscrição (PDF entries with no match in system) ──────────────

function TabSemInscricao({
  items,
  onDelete,
}: {
  items: UnmatchedEntry[];
  onDelete: (id: number) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Todas as entradas do PDF têm inscrição correspondente.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Entradas importadas do PDF que não possuem nenhuma inscrição correspondente no sistema
        (nenhum candidato com similaridade ≥ 60%).
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm bg-white">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Nome no PDF</th>
              <th className="px-3 py-2">Escola</th>
              <th className="px-3 py-2">Resultado</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900">{item.nome_completo}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{item.escola}</td>
                <td className="px-3 py-2.5">
                  {item.resultado === "aprovado"
                    ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Aprovado</span>
                    : <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">Reserva</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={async () => {
                      if (!confirm(`Remover "${item.nome_completo}" da lista?`)) return;
                      await onDelete(item.id);
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Tab = "vinculacoes" | "duplicatas" | "ausentes" | "sem-inscricao";

export default function ResultadosAdminPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<Tab>("vinculacoes");
  const [autoLinking, setAutoLinking] = useState(false);
  const [autoLinkResult, setAutoLinkResult] = useState<{ linked: number; skipped: number } | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkApproveResult, setBulkApproveResult] = useState<{ approved: number; reserved: number; alreadyDone: number } | null>(null);
  const [data, setData] = useState<{
    results: PublicResultItem[];
    duplicates: DuplicateGroup[];
    missing: MissingEntry[];
    unmatched: UnmatchedEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGetResultados(authFetch);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLink = useCallback(async (id: number, submissionId: number) => {
    await apiLinkResultado(authFetch, id, submissionId);
    await fetchData();
  }, [authFetch, fetchData]);

  const handleUnlink = useCallback(async (id: number) => {
    await apiUnlinkResultado(authFetch, id);
    await fetchData();
  }, [authFetch, fetchData]);

  const handleDelete = useCallback(async (id: number) => {
    await apiDeleteResultado(authFetch, id);
    await fetchData();
  }, [authFetch, fetchData]);

  const handleAdd = useCallback(async (nome: string, escola: string, resultado: "aprovado" | "cadastro_reserva") => {
    await apiAddResultado(authFetch, { nome_completo: nome, escola, resultado });
    await fetchData();
  }, [authFetch, fetchData]);

  const handleAddFromMissing = useCallback(async (_submissionId: number, nome: string, escola: string) => {
    await apiAddResultado(authFetch, { nome_completo: nome, escola, resultado: "aprovado" });
    await fetchData();
  }, [authFetch, fetchData]);

  const handleAutoLink = useCallback(async () => {
    if (!confirm(
      "Vincular automaticamente todas as entradas pendentes ao candidato com maior score (≥ 80%)?\n\nEsta ação pode ser desfeita manualmente entrada por entrada."
    )) return;
    setAutoLinking(true);
    setAutoLinkResult(null);
    try {
      const result = await apiAutoLink(authFetch, 80);
      setAutoLinkResult(result);
      await fetchData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAutoLinking(false);
    }
  }, [authFetch, fetchData]);

  const handleBulkApprove = useCallback(async () => {
    const confirmed = data?.results.filter(
      (r) => r.match_status === "confirmed" && r.resultado === "aprovado"
    ).length ?? 0;
    if (!confirm(
      `Deferir ${confirmed} inscrições vinculadas como \"aprovado\" no PDF?\n\nIsso irá alterar o status delas para Deferido no painel de inscrições.`
    )) return;
    setBulkApproving(true);
    setBulkApproveResult(null);
    try {
      const result = await apiBulkApprove(authFetch);
      setBulkApproveResult(result);
      await fetchData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkApproving(false);
    }
  }, [authFetch, fetchData, data]);

  const semInscricao = data?.unmatched ?? [];

  const tabs: { id: Tab; label: string; count?: number; badge?: string }[] = [
    { id: "vinculacoes", label: "Vinculações", count: data?.results.length },
    { id: "duplicatas", label: "Duplicatas", count: data?.duplicates.length },
    { id: "ausentes", label: "Ausentes", count: data?.missing.length },
    { id: "sem-inscricao", label: "Sem Inscrição", count: semInscricao.length, badge: semInscricao.length > 0 ? "orange" : undefined },
  ];

  return (
    <AdminLayout contentClassName="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resultados PDF</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vinculação entre entradas do PDF e inscrições do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproving || loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {bulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            Deferir aprovados
          </button>
          <button
            onClick={handleAutoLink}
            disabled={autoLinking || loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {autoLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Vincular automaticamente
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Adicionar entrada
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "↻"}
            Atualizar
          </button>
        </div>
      </div>

      {/* Auto-link result banner */}
      {autoLinkResult && (
        <div className="mb-4 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-indigo-800">
          <span>
            <strong>{autoLinkResult.linked}</strong> vinculações realizadas,{" "}
            <strong>{autoLinkResult.skipped}</strong> sem candidato suficiente (score &lt; 80%).
          </span>
          <button onClick={() => setAutoLinkResult(null)} className="ml-4 text-indigo-500 hover:text-indigo-700 font-bold">×</button>
        </div>
      )}

      {/* Bulk-approve result banner */}
      {bulkApproveResult && (
        <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
          <span>
            <strong>{bulkApproveResult.approved}</strong> inscrições deferidas,{" "}
            <strong>{bulkApproveResult.reserved}</strong> marcadas como reserva,{" "}
            <strong>{bulkApproveResult.alreadyDone}</strong> já estavam atualizadas.
          </span>
          <button onClick={() => setBulkApproveResult(null)} className="ml-4 text-green-500 hover:text-green-700 font-bold">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                tab === t.id
                  ? "bg-primary/10 text-primary"
                  : t.badge === "orange" && t.count > 0
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {tab === "vinculacoes" && (
            <TabVinculacoes
              items={data.results}
              onLink={handleLink}
              onUnlink={handleUnlink}
              onDelete={handleDelete}
            />
          )}
          {tab === "duplicatas" && (
            <TabDuplicatas
              duplicates={data.duplicates}
              onDelete={handleDelete}
            />
          )}
          {tab === "ausentes" && (
            <TabAusentes
              missing={data.missing}
              onAdd={handleAddFromMissing}
            />
          )}
          {tab === "sem-inscricao" && (
            <TabSemInscricao
              items={semInscricao}
              onDelete={handleDelete}
            />
          )}
        </>
      ) : null}

      {showAddModal && (
        <AddResultModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAdd}
        />
      )}
    </AdminLayout>
  );
}
