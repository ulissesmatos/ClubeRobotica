// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchStatus = "pending" | "confirmed" | "rejected" | "manual";

export interface SubmissionCandidate {
  submission_id: number;
  protocol: string;
  nome_inscricao: string;
  escola_inscricao: string | null;
  status: string;
  score: number;
}

export interface PublicResultItem {
  id: number;
  nome_completo: string;
  nome_normalizado: string;
  escola: string;
  resultado: "aprovado" | "cadastro_reserva";
  submission_id: number | null;
  match_status: MatchStatus;
  created_at: string;
  linked_protocol: string | null;
  linked_nome: string | null;
  candidates: SubmissionCandidate[];
}

export interface DuplicateGroup {
  key: string;
  entries: Omit<PublicResultItem, "candidates">[];
}

export interface MissingEntry {
  submission_id: number;
  protocol: string;
  nome_inscricao: string;
  escola_inscricao: string | null;
  status: string;
}

export interface UnmatchedEntry {
  id: number;
  nome_completo: string;
  nome_normalizado: string;
  escola: string;
  resultado: "aprovado" | "cadastro_reserva";
  match_status: MatchStatus;
  created_at: string;
}

export interface ResultadosResponse {
  results: PublicResultItem[];
  duplicates: DuplicateGroup[];
  missing: MissingEntry[];
  unmatched: UnmatchedEntry[];
}

// ─── Fetcher type (matches AuthContext.authFetch signature) ──────────────────

export type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

// ─── API functions ────────────────────────────────────────────────────────────

export async function apiGetResultados(
  authFetch: AuthFetch,
  params?: {
    escola?: string;
    match_status?: MatchStatus | "";
    resultado?: "" | "aprovado" | "cadastro_reserva";
  }
): Promise<ResultadosResponse> {
  const qs = new URLSearchParams();
  if (params?.escola) qs.set("escola", params.escola);
  if (params?.match_status) qs.set("match_status", params.match_status);
  if (params?.resultado) qs.set("resultado", params.resultado);
  const res = await authFetch(`/api/admin/resultados?${qs}`);
  if (!res.ok) throw new Error("Erro ao carregar resultados");
  return res.json();
}

export async function apiLinkResultado(
  authFetch: AuthFetch,
  id: number,
  submissionId: number
): Promise<void> {
  const res = await authFetch(`/api/admin/resultados/${id}/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Erro ao vincular");
  }
}

export async function apiUnlinkResultado(
  authFetch: AuthFetch,
  id: number
): Promise<void> {
  const res = await authFetch(`/api/admin/resultados/${id}/link`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao desvincular");
}

export async function apiDeleteResultado(
  authFetch: AuthFetch,
  id: number
): Promise<void> {
  const res = await authFetch(`/api/admin/resultados/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao remover");
}

export async function apiAddResultado(
  authFetch: AuthFetch,
  data: {
    nome_completo: string;
    escola: string;
    resultado: "aprovado" | "cadastro_reserva";
  }
): Promise<PublicResultItem> {
  const res = await authFetch("/api/admin/resultados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? "Erro ao adicionar");
  }
  const json = await res.json();
  return (json as { result: PublicResultItem }).result;
}

export async function apiUpdateResultado(
  authFetch: AuthFetch,
  id: number,
  fields: Partial<{
    nome_completo: string;
    escola: string;
    resultado: "aprovado" | "cadastro_reserva";
    match_status: MatchStatus;
  }>
): Promise<PublicResultItem> {
  const res = await authFetch(`/api/admin/resultados/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Erro ao atualizar");
  const json = await res.json();
  return (json as { result: PublicResultItem }).result;
}

export async function apiAutoLink(
  authFetch: AuthFetch,
  minScore = 80
): Promise<{ linked: number; skipped: number }> {
  const res = await authFetch("/api/admin/resultados/auto-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minScore }),
  });
  if (!res.ok) throw new Error("Erro ao vincular automaticamente");
  return res.json();
}

export async function apiBulkApprove(
  authFetch: AuthFetch
): Promise<{ approved: number; reserved: number; alreadyDone: number }> {
  const res = await authFetch("/api/admin/resultados/bulk-approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Erro ao deferir inscrições");
  return res.json();
}
