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
  slug: string | null;
  display_order: number;
  card_level: string | null;
  card_turno: string | null;
  card_subtitle: string | null;
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

export async function apiCountByForm(
  token: string
): Promise<{ form_id: number; count: number }[]> {
  const res = await fetch("/api/admin/submissions/counts-by-form", {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao carregar contagens.");
  const json = await res.json();
  return (json as { counts: { form_id: number; count: number }[] }).counts;
}

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
    schoolGroupId?: number;
  } = {}
): Promise<PaginatedSubmissions> {
  const qs = new URLSearchParams();
  if (params.page)          qs.set("page",          String(params.page));
  if (params.pageSize)      qs.set("pageSize",      String(params.pageSize));
  if (params.formId)        qs.set("formId",        String(params.formId));
  if (params.status)        qs.set("status",        params.status);
  if (params.search)        qs.set("search",        params.search);
  if (params.dateFrom)      qs.set("dateFrom",      params.dateFrom);
  if (params.dateTo)        qs.set("dateTo",        params.dateTo);
  if (params.schoolGroupId) qs.set("schoolGroupId", String(params.schoolGroupId));

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

export async function apiUpdateSubmissionData(
  token: string,
  id: number,
  updates: { id: number; value_text: string }[]
): Promise<void> {
  const res = await fetch(`/api/admin/submissions/${id}/data`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error("Erro ao atualizar dados da inscrição.");
}

/** Substitui o arquivo de um campo file de uma submissão */
export async function apiReplaceSubmissionFile(
  token: string,
  submissionId: number,
  dataRowId: number,
  file: File
): Promise<void> {
  const form = new FormData();
  form.append("dataRowId", String(dataRowId));
  form.append("file", file);

  const res = await fetch(`/api/admin/submissions/${submissionId}/file`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: form,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao substituir arquivo.");
  }
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

export interface AdminField {
  id: number;
  form_id: number;
  type: string;
  label: string;
  name: string;
  placeholder: string | null;
  required: boolean;
  field_order: number;
  options: string[] | null;
}

export interface AdminFormWithFields extends FormRow {
  fields: AdminField[];
}

export async function apiListForms(token: string): Promise<FormRow[]> {
  const res = await fetch("/api/admin/forms", {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao carregar formulários.");
  const json = await res.json();
  return (json as { forms: FormRow[] }).forms;
}

export async function apiGetAdminForm(
  token: string,
  id: number
): Promise<AdminFormWithFields> {
  const res = await fetch(`/api/admin/forms/${id}`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Formulário não encontrado.");
  const json = await res.json();
  return (json as { form: AdminFormWithFields }).form;
}

export async function apiCreateForm(
  token: string,
  data: { title: string; description?: string }
): Promise<FormRow> {
  const res = await fetch("/api/admin/forms", {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Erro ao criar formulário.");
  return (json as { form: FormRow }).form;
}

export async function apiUpdateForm(
  token: string,
  id: number,
  data: { title?: string; description?: string; is_active?: boolean; card_level?: string | null; card_turno?: string | null; card_subtitle?: string | null }
): Promise<FormRow> {
  const res = await fetch(`/api/admin/forms/${id}`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Erro ao atualizar formulário.");
  return (json as { form: FormRow }).form;
}

export async function apiReorderForms(
  token: string,
  items: { id: number; display_order: number }[]
): Promise<void> {
  const res = await fetch("/api/admin/forms/reorder", {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Erro ao reordenar formulários.");
}

export async function apiCreateField(
  token: string,
  formId: number,
  data: {
    type: string;
    label: string;
    name: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
    order: number;
  }
): Promise<AdminField> {
  const res = await fetch(`/api/admin/forms/${formId}/fields`, {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Erro ao criar campo.");
  const f = (json as { field: AdminField }).field;
  return { ...f, required: Boolean(f.required), options: f.options ?? null };
}

export async function apiUpdateField(
  token: string,
  formId: number,
  fieldId: number,
  data: Partial<{
    type: string;
    label: string;
    name: string;
    placeholder: string | null;
    required: boolean;
    options: string[] | null;
    order: number;
  }>
): Promise<AdminField> {
  const res = await fetch(`/api/admin/forms/${formId}/fields/${fieldId}`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Erro ao atualizar campo.");
  const f = (json as { field: AdminField }).field;
  return { ...f, required: Boolean(f.required), options: f.options ?? null };
}

export async function apiDeleteForm(
  token: string,
  formId: number
): Promise<void> {
  const res = await fetch(`/api/admin/forms/${formId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao excluir formulário.");
}

export async function apiDeleteField(
  token: string,
  formId: number,
  fieldId: number
): Promise<void> {
  const res = await fetch(`/api/admin/forms/${formId}/fields/${fieldId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao remover campo.");
}

export async function apiReorderFields(
  token: string,
  formId: number,
  items: { id: number; order: number }[]
): Promise<void> {
  const res = await fetch(`/api/admin/forms/${formId}/fields/reorder`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Erro ao reordenar campos.");
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface SiteSettingsAdmin {
  whatsapp_number: string;
  whatsapp_message: string;
  whatsapp_floating_enabled: string;
  whatsapp_footer_enabled: string;
  instagram_handle: string;
  instagram_enabled: string;
  phone_display: string;
  phone_number: string;
  phone_enabled: string;
  enrollments_status: string;
}

export async function apiGetSettings(token: string): Promise<SiteSettingsAdmin> {
  const res = await fetch("/api/admin/settings", {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao carregar configurações.");
  return res.json();
}

export async function apiUpdateSettings(
  token: string,
  data: Partial<SiteSettingsAdmin>
): Promise<SiteSettingsAdmin> {
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erro ao salvar configurações.");
  return json as SiteSettingsAdmin;
}

export async function apiExportSubmissions(
  token: string,
  formId?: number
): Promise<Blob> {
  const url = formId
    ? `/api/admin/submissions/export?formId=${formId}`
    : `/api/admin/submissions/export`;
  const res = await fetch(url, { headers: buildAuthHeaders(token) });
  if (!res.ok) throw new Error("Erro ao exportar inscrições.");
  return res.blob();
}

// ─── Schools ──────────────────────────────────────────────────────────────────

export interface RawSchoolName {
  raw_name: string;
  count: number;
  group_id: number | null;
  canonical_name: string | null;
}

export interface SchoolGroup {
  id: number;
  canonical_name: string;
  created_at: string;
  aliases: string[];
  count: number;
}

export async function apiListRawSchoolNames(token: string): Promise<RawSchoolName[]> {
  const res = await fetch("/api/admin/schools/raw", { headers: buildAuthHeaders(token) });
  if (!res.ok) throw new Error("Erro ao carregar nomes de escolas.");
  const json = await res.json();
  return (json as { names: RawSchoolName[] }).names;
}

export async function apiListSchoolGroups(token: string): Promise<SchoolGroup[]> {
  const res = await fetch("/api/admin/schools/groups", { headers: buildAuthHeaders(token) });
  if (!res.ok) throw new Error("Erro ao carregar grupos.");
  const json = await res.json();
  return (json as { groups: SchoolGroup[] }).groups;
}

export async function apiCreateSchoolGroup(
  token: string,
  canonical_name: string,
  aliases: string[]
): Promise<SchoolGroup> {
  const res = await fetch("/api/admin/schools/groups", {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ canonical_name, aliases }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Erro ao criar grupo.");
  return (json as { group: SchoolGroup }).group;
}

export async function apiUpdateSchoolGroup(
  token: string,
  groupId: number,
  data: { canonical_name?: string; add_aliases?: string[] }
): Promise<SchoolGroup> {
  const res = await fetch(`/api/admin/schools/groups/${groupId}`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Erro ao atualizar grupo.");
  return (json as { group: SchoolGroup }).group;
}

export async function apiDeleteSchoolGroup(token: string, groupId: number): Promise<void> {
  const res = await fetch(`/api/admin/schools/groups/${groupId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Erro ao excluir grupo.");
}

export async function apiRemoveSchoolAlias(token: string, raw_name: string): Promise<void> {
  const res = await fetch("/api/admin/schools/aliases", {
    method: "DELETE",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ raw_name }),
  });
  if (!res.ok) throw new Error("Erro ao remover alias.");
}

