import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getDb } from "../db/database";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SubmissionRow {
  id: number;
  form_id: number;
  status: "pendente" | "aprovado" | "rejeitado";
  ip_address: string | null;
  user_agent: string | null;
  submitted_at: string;
}

export interface SubmissionDataRow {
  id: number;
  submission_id: number;
  field_name: string;
  field_label: string;
  value_text: string | null;
  value_file_path: string | null;
}

export interface SubmissionField {
  name: string;
  label: string;
  value: string | null;
  filePath: string | null;
}

export type SubmissionStatus = "pendente" | "aprovado" | "rejeitado";
export const VALID_STATUSES: SubmissionStatus[] = ["pendente", "aprovado", "rejeitado"];

// ─── Upload ───────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** Valida o tipo MIME do arquivo (segurança: não confia só na extensão) */
export function isAllowedMime(mimetype: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimetype.toLowerCase());
}

/**
 * Salva um arquivo em /uploads/{ano}/{mes}/{uuid}/
 * Retorna o caminho RELATIVO ao UPLOAD_DIR (para salvar no banco).
 * Nunca usa o nome original do arquivo — usa UUID para evitar path traversal.
 */
export function saveUploadedFile(
  fileBuffer: Buffer,
  originalMime: string
): string {
  const uploadDir = process.env.UPLOAD_DIR ?? "/uploads";
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();

  // Determina extensão segura baseada no MIME (não no nome do arquivo)
  const extMap: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
  };
  const ext = extMap[originalMime.toLowerCase()] ?? ".bin";

  const relativeDir = path.join(year, month, uuid);
  const absoluteDir = path.join(uploadDir, relativeDir);
  const filename = `file${ext}`;

  fs.mkdirSync(absoluteDir, { recursive: true });
  fs.writeFileSync(path.join(absoluteDir, filename), fileBuffer);

  return path.join(relativeDir, filename);
}

/** Resolve caminho absoluto a partir do caminho relativo salvo no banco */
export function resolveUploadPath(relativePath: string): string {
  const uploadDir = process.env.UPLOAD_DIR ?? "/uploads";
  // Sanitiza: garante que não há path traversal
  const safe = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(uploadDir, safe);
}

// ─── Verificação de duplicidade ───────────────────────────────────────────────

/**
 * Verifica se já existe uma submissão para o mesmo formulário
 * com o mesmo CPF. Retorna true se houver duplicata.
 */
export function hasDuplicateCpf(formId: number, cpfValue: string): boolean {
  const db = getDb();
  const normalized = cpfValue.replace(/\D/g, "");
  if (!normalized) return false;

  const row = db.prepare(`
    SELECT 1 FROM submission_data sd
    JOIN submissions s ON s.id = sd.submission_id
    WHERE s.form_id = ?
      AND sd.field_name = 'cpf'
      AND REPLACE(REPLACE(REPLACE(sd.value_text, '.', ''), '-', ''), ' ', '') = ?
    LIMIT 1
  `).get(formId, normalized);

  return !!row;
}

// ─── Criação de submissão ─────────────────────────────────────────────────────

/** Gera um código de protocolo opaco — não sequencial, não revela a contagem de inscrições */
function generateProtocol(): string {
  return "ROB-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

export interface CreateSubmissionResult {
  submissionId: number;
  protocol: string;
}

export function createSubmission(
  formId: number,
  fields: SubmissionField[],
  ipAddress: string | null,
  userAgent: string | null
): CreateSubmissionResult {
  const db = getDb();

  // Retry em caso de colisão de protocol (improvável, mas correto)
  for (let attempt = 0; attempt < 5; attempt++) {
    const protocol = generateProtocol();
    db.exec("BEGIN");
    try {
      const result = db
        .prepare(
          `INSERT INTO submissions (form_id, ip_address, user_agent, protocol)
           VALUES (?, ?, ?, ?)`
        )
        .run(formId, ipAddress, userAgent, protocol);

      const submissionId = Number(result.lastInsertRowid);

      const stmt = db.prepare(`
        INSERT INTO submission_data (submission_id, field_name, field_label, value_text, value_file_path)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const field of fields) {
        stmt.run(
          submissionId,
          field.name,
          field.label,
          field.value ?? null,
          field.filePath ?? null
        );
      }

      db.exec("COMMIT");
      return { submissionId, protocol };
    } catch (err) {
      db.exec("ROLLBACK");
      // Se for violação de unique no protocol, tenta novamente
      const msg = err instanceof Error ? err.message : "";
      if (attempt < 4 && msg.includes("UNIQUE") && msg.includes("protocol")) continue;
      throw err;
    }
  }
  throw new Error("Não foi possível gerar um protocolo único. Tente novamente.");
}

// ─── Listagem paginada ────────────────────────────────────────────────────────

export interface ListSubmissionsOptions {
  formId?: number;
  status?: SubmissionStatus;
  search?: string;        // busca em value_text (nome/CPF)
  dateFrom?: string;      // ISO date string
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface SubmissionListItem {
  id: number;
  form_id: number;
  form_title: string;
  status: string;
  protocol: string;
  submitted_at: string;
  nome_completo: string | null;
}

export function listSubmissions(opts: ListSubmissionsOptions): {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const db = getDb();
  const { page, pageSize } = opts;
  const offset = (page - 1) * pageSize;

  // Monta WHERE dinamicamente (sem string interpolation de user input)
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.formId) {
    conditions.push("s.form_id = ?");
    params.push(opts.formId);
  }
  if (opts.status) {
    conditions.push("s.status = ?");
    params.push(opts.status);
  }
  if (opts.dateFrom) {
    conditions.push("s.submitted_at >= ?");
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push("s.submitted_at <= ?");
    params.push(opts.dateTo + " 23:59:59");
  }
  if (opts.search) {
    conditions.push(`(s.protocol LIKE ? OR EXISTS (
      SELECT 1 FROM submission_data sd
      WHERE sd.submission_id = s.id
        AND sd.value_text LIKE ?
    ))`);
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM submissions s ${where}`)
      .get(...params) as { count: number }
  ).count;

  const items = db
    .prepare(`
      SELECT
        s.id,
        s.form_id,
        f.title AS form_title,
        s.status,
        s.protocol,
        s.submitted_at,
        (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id AND sd.field_name = 'nome_completo'
         LIMIT 1) AS nome_completo
      FROM submissions s
      JOIN forms f ON f.id = s.form_id
      ${where}
      ORDER BY s.submitted_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset) as unknown as SubmissionListItem[];

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── Contagem por formulário ──────────────────────────────────────────────────

export function countSubmissionsByForm(): { form_id: number; count: number }[] {
  const db = getDb();
  return db
    .prepare("SELECT form_id, COUNT(*) as count FROM submissions GROUP BY form_id")
    .all() as unknown as { form_id: number; count: number }[];
}

// ─── Detalhe ─────────────────────────────────────────────────────────────────

export interface SubmissionDetail extends SubmissionRow {
  form_title: string;
  data: SubmissionDataRow[];
}

export function getSubmissionById(id: number): SubmissionDetail | null {
  const db = getDb();

  const submission = db
    .prepare(`
      SELECT s.*, f.title AS form_title
      FROM submissions s
      JOIN forms f ON f.id = s.form_id
      WHERE s.id = ?
    `)
    .get(id) as unknown as SubmissionDetail | undefined;

  if (!submission) return null;

  const data = db
    .prepare("SELECT * FROM submission_data WHERE submission_id = ? ORDER BY id")
    .all(id) as unknown as SubmissionDataRow[];

  return { ...submission, data };
}

// ─── Atualização de status ────────────────────────────────────────────────────

export function updateSubmissionStatus(
  id: number,
  status: SubmissionStatus
): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE submissions SET status = ? WHERE id = ?")
    .run(status, id);
  return result.changes > 0;
}

// ─── Exclusão ────────────────────────────────────────────────────────────────

export function deleteSubmission(id: number): {
  deleted: boolean;
  filePaths: string[];
} {
  const db = getDb();

  const data = db
    .prepare("SELECT value_file_path FROM submission_data WHERE submission_id = ?")
    .all(id) as unknown as { value_file_path: string | null }[];

  const filePaths = data
    .map((d) => d.value_file_path)
    .filter((p): p is string => p !== null);

  const result = db
    .prepare("DELETE FROM submissions WHERE id = ?")
    .run(id);

  if (result.changes === 0) return { deleted: false, filePaths: [] };

  // Remove arquivos do disco
  for (const rel of filePaths) {
    try {
      const abs = resolveUploadPath(rel);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
      // Remove o diretório do UUID se vazio
      const dir = path.dirname(abs);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch {
      // Log mas não falha — arquivo pode já ter sido removido
    }
  }

  return { deleted: true, filePaths };
}
