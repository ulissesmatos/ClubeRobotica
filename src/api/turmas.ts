import { buildAuthHeaders } from "./admin";

export interface TurmaRow {
  id: number;
  name: string;
  form_id: number | null;
  form_title: string | null;
  school_name: string | null;
  responsavel: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  max_capacity: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  enrolled_count: number;
}

export interface TurmaStudentRow {
  submission_id: number;
  protocol: string;
  status: "pendente" | "aprovado" | "rejeitado";
  submitted_at: string;
  nome_completo: string | null;
  escola: string | null;
  escola_canonical: string | null;
  turno: string | null;
  notes: string | null;
  enrolled_at: string;
}

export interface TurmaDetail extends TurmaRow {
  students: TurmaStudentRow[];
}

export interface UnassignedApprovedStudent {
  submission_id: number;
  protocol: string;
  form_id: number;
  form_title: string;
  status: "pendente" | "aprovado" | "rejeitado";
  submitted_at: string;
  nome_completo: string | null;
  escola: string | null;
  escola_canonical: string | null;
  turno: string | null;
}

export async function apiListTurmas(
  token: string,
  params?: { formId?: number; isActive?: boolean }
): Promise<TurmaRow[]> {
  const qs = new URLSearchParams();
  if (params?.formId) qs.set("formId", String(params.formId));
  if (typeof params?.isActive === "boolean") qs.set("isActive", String(params.isActive));

  const res = await fetch(`/api/admin/turmas?${qs.toString()}`, {
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) throw new Error("Erro ao carregar turmas.");
  const json = await res.json();
  return (json as { turmas: TurmaRow[] }).turmas;
}

export async function apiGetTurma(token: string, id: number): Promise<TurmaDetail> {
  const res = await fetch(`/api/admin/turmas/${id}`, {
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) throw new Error("Turma não encontrada.");
  const json = await res.json();
  return (json as { turma: TurmaDetail }).turma;
}

export async function apiCreateTurma(
  token: string,
  data: {
    name: string;
    form_id?: number | null;
    school_name?: string | null;
    responsavel?: string | null;
    day_of_week?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    max_capacity?: number;
    is_active?: boolean;
  }
): Promise<TurmaRow> {
  const res = await fetch("/api/admin/turmas", {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? "Erro ao criar turma.");
  return (json as { turma: TurmaRow }).turma;
}

export async function apiUpdateTurma(
  token: string,
  id: number,
  data: Partial<{
    name: string;
    form_id: number | null;
    school_name: string | null;
    responsavel: string | null;
    day_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    max_capacity: number;
    is_active: boolean;
  }>
): Promise<TurmaRow> {
  const res = await fetch(`/api/admin/turmas/${id}`, {
    method: "PUT",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? "Erro ao atualizar turma.");
  return (json as { turma: TurmaRow }).turma;
}

export async function apiDeleteTurma(token: string, id: number, force = false): Promise<void> {
  const res = await fetch(`/api/admin/turmas/${id}?force=${force ? "true" : "false"}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao excluir turma.");
  }
}

export async function apiListUnassignedApproved(
  token: string,
  formId?: number
): Promise<UnassignedApprovedStudent[]> {
  const qs = new URLSearchParams();
  if (formId) qs.set("formId", String(formId));

  const res = await fetch(`/api/admin/turmas/unassigned?${qs.toString()}`, {
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) throw new Error("Erro ao carregar alunos aprovados sem turma.");
  const json = await res.json();
  return (json as { students: UnassignedApprovedStudent[] }).students;
}

export async function apiEnrollStudentsBulk(
  token: string,
  turmaId: number,
  submissionIds: number[]
): Promise<{ enrolled: number; errors: { submissionId: number; message: string }[] }> {
  const res = await fetch(`/api/admin/turmas/${turmaId}/enroll-bulk`, {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ submissionIds }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao alocar alunos em massa.");
  }
  return res.json() as Promise<{ enrolled: number; errors: { submissionId: number; message: string }[] }>;
}

export async function apiEnrollStudent(
  token: string,
  turmaId: number,
  submissionId: number,
  notes?: string
): Promise<void> {
  const res = await fetch(`/api/admin/turmas/${turmaId}/enroll`, {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, notes }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao alocar aluno na turma.");
  }
}

export async function apiRemoveStudent(
  token: string,
  turmaId: number,
  submissionId: number
): Promise<void> {
  const res = await fetch(`/api/admin/turmas/${turmaId}/enroll/${submissionId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao remover aluno da turma.");
  }
}

export async function apiTransferStudent(
  token: string,
  fromTurmaId: number,
  submissionId: number,
  toTurmaId: number,
  notes?: string
): Promise<void> {
  const res = await fetch(`/api/admin/turmas/${fromTurmaId}/transfer`, {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, toTurmaId, notes }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao transferir aluno.");
  }
}

export async function apiListSchools(
  token: string,
  formId?: number
): Promise<string[]> {
  const qs = new URLSearchParams();
  if (formId) qs.set("formId", String(formId));

  const res = await fetch(`/api/admin/turmas/schools?${qs.toString()}`, {
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) throw new Error("Erro ao carregar escolas.");
  const json = await res.json();
  return (json as { schools: string[] }).schools;
}

export async function apiEnrollBySchool(
  token: string,
  turmaId: number,
  schoolName: string,
  formId?: number
): Promise<{ enrolled: number; errors: { submissionId: number; message: string }[] }> {
  const res = await fetch(`/api/admin/turmas/${turmaId}/enroll-by-school`, {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ schoolName, formId }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao alocar alunos da escola.");
  }
  return res.json() as Promise<{ enrolled: number; errors: { submissionId: number; message: string }[] }>;
}

export async function apiEnrollByProtocols(
  token: string,
  turmaId: number,
  protocols: string[]
): Promise<{ enrolled: number; errors: { protocol: string; message: string }[] }> {
  const res = await fetch(`/api/admin/turmas/${turmaId}/enroll-by-protocols`, {
    method: "POST",
    headers: { ...buildAuthHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ protocols }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Erro ao alocar alunos por protocolo.");
  }
  return res.json() as Promise<{ enrolled: number; errors: { protocol: string; message: string }[] }>;
}
