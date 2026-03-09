// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiFormField {
  id: number;
  form_id: number;
  type:
    | "text"
    | "date"
    | "cpf"
    | "tel"
    | "email"
    | "number"
    | "textarea"
    | "radio"
    | "select"
    | "file";
  label: string;
  name: string;
  placeholder: string | null;
  required: boolean;
  field_order: number;
  options: string[] | null;
}

export interface ApiForm {
  id: number;
  title: string;
  slug: string | null;
  description: string | null;
  fields: ApiFormField[];
}

export interface ActiveForm {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  card_level: string | null;
  card_turno: string | null;
  card_subtitle: string | null;
}

export interface SubmitResult {
  submissionId: number;
  protocol: string;
  message: string;
}

// ─── Fetch form definition ────────────────────────────────────────────────────

export async function fetchForm(formId: string | number): Promise<ApiForm> {
  const res = await fetch(`/api/forms/${formId}`);
  if (!res.ok) {
    if (res.status === 404)
      throw new Error("Formulário não encontrado ou inativo.");
    throw new Error("Não foi possível carregar o formulário. Tente novamente.");
  }
  const json = await res.json();
  return json.form as ApiForm;
}

export async function fetchActiveForms(): Promise<ActiveForm[]> {
  const res = await fetch("/api/forms");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.forms ?? []) as ActiveForm[];
}

// ─── Submit via XHR (for upload progress events) ─────────────────────────────

export function submitFormData(
  formId: number,
  body: FormData,
  onProgress: (pct: number) => void
): Promise<SubmitResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as SubmitResult);
        } catch {
          reject(new Error("Resposta inválida do servidor."));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as {
            message?: string;
            fields?: string[];
          };
          const msg = err.fields
            ? err.fields.join("\n")
            : (err.message ?? "Erro ao enviar o formulário.");
          reject(new Error(msg));
        } catch {
          reject(new Error("Erro ao enviar o formulário."));
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Erro de rede. Verifique sua conexão e tente novamente."))
    );
    xhr.addEventListener("timeout", () =>
      reject(new Error("Tempo limite excedido. Tente novamente."))
    );

    xhr.open("POST", `/api/forms/${formId}/submit`);
    xhr.timeout = 120_000; // 2 min for large uploads
    xhr.send(body);
  });
}
