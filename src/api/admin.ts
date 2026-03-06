// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  username: string;
}

export interface SubmissionListItem {
  id: number;
  form_id: number;
  form_title: string;
  status: "pendente" | "aprovado" | "rejeitado";
  protocol: string;
  submitted_at: string;
  nome_completo: string | null;
}

export interface SubmissionDataRow {
  id: number;
  submission_id: number;
  field_name: string;
  field_label: string;
  value_text: string | null;
  value_file_path: string | null;
}

export interface SubmissionDetail {
  id: number;
  form_id: number;
  form_title: string;
  status: "pendente" | "aprovado" | "rejeitado";
  protocol: string;
  ip_address: string | null;
  user_agent: string | null;
  submitted_at: string;
  data: SubmissionDataRow[];
}

export interface PaginatedSubmissions {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FormRow {
  id: number;
  title: string;
  description: string | null;
  is_active: number;
  created_at: string;
}

export type SubmissionStatus = "pendente" | "aprovado" | "rejeitado";

// ─── Auth endpoints (no token required) ──────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string
): Promise<{ accessToken: string; admin: AdminUser }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Credenciais inválidas.");
  return json as { accessToken: string; admin: AdminUser };
}

export async function apiRefreshToken(): Promise<string | null> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json as { accessToken: string }).accessToken ?? null;
}

export async function apiLogout(token: string): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Authenticated fetch helper ───────────────────────────────────────────────

/**
 * Wraps fetch with Bearer token injection.
 * The AuthContext uses this via its own authFetch (which also handles 401 auto-refresh).
 */
export function buildAuthHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function apiListSubmissions(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    formId?: number;
    status?: SubmissionStatus;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<PaginatedSubmissions> {
  const qs = new URLSearchParams();
  if (params.page)     qs.set("page",     String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.formId)   qs.set("formId",   String(params.formId));
  if (params.status)   qs.set("status",   params.status);
  if (params.search)   qs.set("search",   params.search);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo)   qs.set("dateTo",   params.dateTo);

  const res = await fetch(`/api/admin/submissions?${qs}`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao carregar submissões.");
  return res.json() as Promise<PaginatedSubmissions>;
}

export async function apiGetSubmission(
  token: string,
  id: number
): Promise<SubmissionDetail> {
  const res = await fetch(`/api/admin/submissions/${id}`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Submissão não encontrada.");
  const json = await res.json();
  return (json as { submission: SubmissionDetail }).submission;
}

export async function apiUpdateStatus(
  token: string,
  id: number,
  status: SubmissionStatus
): Promise<void> {
  const res = await fetch(`/api/admin/submissions/${id}/status`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Erro ao atualizar status.");
}

export async function apiDeleteSubmission(
  token: string,
  id: number
): Promise<void> {
  const res = await fetch(`/api/admin/submissions/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao excluir submissão.");
}

/** Busca um arquivo com autenticação e retorna uma object URL de blob */
export async function fetchUploadAsBlob(
  token: string,
  relativePath: string
): Promise<string> {
  // relativePath vem do banco: pode ter \\ (Windows) ou /
  const normalized = relativePath.replace(/\\/g, "/");
  const res = await fetch(`/api/admin/uploads/${normalized}`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Arquivo não encontrado.");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export async function apiListForms(token: string): Promise<FormRow[]> {
  const res = await fetch("/api/admin/forms", {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao carregar formulários.");
  const json = await res.json();
  return (json as { forms: FormRow[] }).forms;
}
