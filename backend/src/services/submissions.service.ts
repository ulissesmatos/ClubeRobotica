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
 * Valida o conteúdo do arquivo pelos magic bytes.
 * Garante que um arquivo declarado como PDF realmente começa com %PDF-.
 * Isso evita que arquivos corrompidos ou renomeados sejam salvos e exibidos com erro.
 */
export function validateFileContent(buffer: Buffer, mimetype: string): boolean {
  if (mimetype.toLowerCase() === "application/pdf") {
    // PDFs válidos sempre começam com os bytes %PDF-
    return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  return true;
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

// ─── Validação de CPF (algoritmo BR) ──────────────────────────────────────────

/** Valida CPF usando os dois dígitos verificadores (padrão Receita Federal). */
export function isValidCpf(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) {
      sum += Number(digits[i]) * (t + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    const check = remainder === 10 ? 0 : remainder;
    if (Number(digits[t]) !== check) return false;
  }
  return true;
}

// ─── Verificação de duplicidade ───────────────────────────────────────────────

/**
 * Verifica se já existe uma submissão com o mesmo CPF
 * em qualquer formulário. Retorna true se houver duplicata.
 */
export function hasDuplicateCpf(formId: number, cpfValue: string): boolean {
  const db = getDb();
  const normalized = cpfValue.replace(/\D/g, "");
  if (!normalized) return false;

  const row = db.prepare(`
    SELECT 1 FROM submission_data sd
    JOIN submissions s ON s.id = sd.submission_id
    WHERE sd.field_name = 'cpf'
      AND REPLACE(REPLACE(REPLACE(sd.value_text, '.', ''), '-', ''), ' ', '') = ?
    LIMIT 1
  `).get(normalized);

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
  schoolGroupId?: number; // filtra pelo grupo de escola mapeado
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
  if (opts.schoolGroupId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM submission_data sd2
      JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd2.value_text))
      WHERE sd2.submission_id = s.id
        AND sd2.field_name LIKE '%escola%'
        AND sa.group_id = ?
    )`);
    params.push(opts.schoolGroupId);
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

// ─── Atualização de dados da submissão ────────────────────────────────────────

export function updateSubmissionData(
  submissionId: number,
  updates: { id: number; value_text: string }[]
): boolean {
  const db = getDb();

  // Verifica se a submissão existe
  const submission = db.prepare("SELECT id FROM submissions WHERE id = ?").get(submissionId);
  if (!submission) return false;

  const stmt = db.prepare(
    "UPDATE submission_data SET value_text = ? WHERE id = ? AND submission_id = ?"
  );

  db.exec("BEGIN");
  try {
    for (const u of updates) {
      stmt.run(u.value_text, u.id, submissionId);
    }
    db.exec("COMMIT");
    return true;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Substitui o arquivo de um campo file de uma submissão.
 * Salva o novo arquivo, atualiza o banco e remove o antigo do disco.
 */
export function updateSubmissionFile(
  submissionId: number,
  dataRowId: number,
  fileBuffer: Buffer,
  mimetype: string
): boolean {
  const db = getDb();

  const row = db.prepare(
    "SELECT id, value_file_path FROM submission_data WHERE id = ? AND submission_id = ?"
  ).get(dataRowId, submissionId) as { id: number; value_file_path: string | null } | undefined;

  if (!row || row.value_file_path === null) return false;

  const oldRelativePath = row.value_file_path;
  const newRelativePath = saveUploadedFile(fileBuffer, mimetype);

  db.prepare(
    "UPDATE submission_data SET value_file_path = ? WHERE id = ? AND submission_id = ?"
  ).run(newRelativePath, dataRowId, submissionId);

  // Remove arquivo antigo do disco
  try {
    const oldAbsolute = resolveUploadPath(oldRelativePath);
    if (fs.existsSync(oldAbsolute)) {
      fs.unlinkSync(oldAbsolute);
      // Tenta remover o diretório UUID se ficou vazio
      const parentDir = path.dirname(oldAbsolute);
      const remaining = fs.readdirSync(parentDir);
      if (remaining.length === 0) fs.rmdirSync(parentDir);
    }
  } catch { /* best-effort cleanup */ }

  return true;
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

// ─── Exportação para Excel ────────────────────────────────────────────────────

export interface ExportSheetData {
  sheetName: string;
  headers: string[];
  rows: string[][];
}

export function getSubmissionsExportData(formId?: number): ExportSheetData[] {
  const db = getDb();

  const formRows = formId
    ? (db.prepare("SELECT id, title FROM forms WHERE id = ?").all(formId) as { id: number; title: string }[])
    : (db.prepare("SELECT id, title FROM forms ORDER BY display_order, id").all() as { id: number; title: string }[]);

  const statusLabel: Record<string, string> = {
    pendente: "Pendente",
    aprovado: "Deferido",
    rejeitado: "Indeferido",
  };

  const result: ExportSheetData[] = [];

  for (const form of formRows) {
    const submissions = db
      .prepare(`
        SELECT id, protocol, status, submitted_at
        FROM submissions
        WHERE form_id = ?
        ORDER BY submitted_at ASC
      `)
      .all(form.id) as { id: number; protocol: string; status: string; submitted_at: string }[];

    if (submissions.length === 0) continue;

    // Colunas dos campos na ordem do formulário
    const fields = db
      .prepare(`
        SELECT name, label FROM form_fields
        WHERE form_id = ?
        ORDER BY field_order, id
      `)
      .all(form.id) as { name: string; label: string }[];

    // Fallback: se form_fields estiver vazio, coleta labels únicos dos dados
    const fieldList =
      fields.length > 0
        ? fields
        : (db
            .prepare(`
              SELECT DISTINCT field_name AS name, field_label AS label
              FROM submission_data
              WHERE submission_id IN (
                SELECT id FROM submissions WHERE form_id = ?
              )
              ORDER BY id
            `)
            .all(form.id) as { name: string; label: string }[]);

    const headers = [
      "Protocolo",
      "Status",
      "Data/Hora",
      ...fieldList.map((f) => f.label),
    ];

    const rows: string[][] = [];

    for (const sub of submissions) {
      const dataRows = db
        .prepare(`
          SELECT field_name, value_text, value_file_path
          FROM submission_data
          WHERE submission_id = ?
        `)
        .all(sub.id) as {
          field_name: string;
          value_text: string | null;
          value_file_path: string | null;
        }[];

      const dataMap: Record<string, string> = {};
      for (const row of dataRows) {
        if (row.value_file_path) {
          // Normaliza path e pega só o nome do arquivo
          const normalised = row.value_file_path.replace(/\\/g, "/");
          const parts = normalised.split("/").filter(Boolean);
          // Inclui uuid/filename para identificar o arquivo de forma única
          dataMap[row.field_name] =
            parts.length >= 2 ? parts.slice(-2).join("/") : normalised;
        } else {
          dataMap[row.field_name] = row.value_text ?? "";
        }
      }

      rows.push([
        sub.protocol,
        statusLabel[sub.status] ?? sub.status,
        sub.submitted_at,
        ...fieldList.map((f) => dataMap[f.name] ?? ""),
      ]);
    }

    // Nome da aba limitado a 31 chars (limite do Excel)
    const sheetName = form.title.substring(0, 31);
    result.push({ sheetName, headers, rows });
  }

  return result;
}
