import { getDb } from "../db/database";

export interface PublicResultRow {
  id: number;
  nome_completo: string;
  escola: string;
  resultado: "aprovado" | "cadastro_reserva";
  turma_name: string | null;
  turma_day: string | null;
  turma_start: string | null;
  turma_end: string | null;
}

function normalize(str: string): string {
  return str
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function onlyDigits(str: string): string {
  return str.replace(/\D/g, "");
}

function looksLikeProtocol(q: string): boolean {
  // e.g. ROBO-2026-00001 or ROB-0001
  return /^[A-Z]{2,6}-\d+/.test(q.toUpperCase());
}

function looksLikeCpf(q: string): boolean {
  const digits = onlyDigits(q);
  return digits.length >= 10;
}

function buildTurmaSelect() {
  return `
    SELECT
      pr.id,
      pr.nome_completo,
      pr.escola,
      pr.resultado,
      t.name  AS turma_name,
      t.day_of_week AS turma_day,
      t.start_time  AS turma_start,
      t.end_time    AS turma_end
    FROM public_results pr
    LEFT JOIN turma_enrollments te ON te.submission_id = pr.submission_id
    LEFT JOIN turmas t ON t.id = te.turma_id
  `;
}

export function searchPublicResults(query: string): PublicResultRow[] {
  if (!query || query.trim().length < 3) return [];

  const db = getDb();
  const q = query.trim();

  // ── 1. Search by protocol ────────────────────────────────────────────────
  if (looksLikeProtocol(q)) {
    const rows = db
      .prepare(
        `${buildTurmaSelect()}
         JOIN submissions s ON s.id = pr.submission_id
         WHERE UPPER(s.protocol) = UPPER(?)
         LIMIT 5`
      )
      .all(q) as unknown as PublicResultRow[];
    if (rows.length > 0) return rows;
  }

  // ── 2. Search by CPF ─────────────────────────────────────────────────────
  if (looksLikeCpf(q)) {
    const digits = onlyDigits(q);
    const rows = db
      .prepare(
        `${buildTurmaSelect()}
         JOIN submissions s ON s.id = pr.submission_id
         JOIN submission_data sd
           ON sd.submission_id = s.id
           AND (sd.field_name LIKE '%cpf%' OR sd.field_name LIKE '%documento%')
         WHERE REPLACE(REPLACE(REPLACE(sd.value_text, '.', ''), '-', ''), ' ', '') = ?
         LIMIT 5`
      )
      .all(digits) as unknown as PublicResultRow[];
    if (rows.length > 0) return rows;
  }

  // ── 3. Search by name (LIKE, case-insensitive via UPPER) ─────────────────
  const namePattern = `%${normalize(q)}%`;
  const rows = db
    .prepare(
      `${buildTurmaSelect()}
       WHERE UPPER(REPLACE(REPLACE(TRIM(pr.nome_completo), '  ', ' '), '  ', ' ')) LIKE ?
       ORDER BY
         CASE pr.resultado WHEN 'aprovado' THEN 0 ELSE 1 END,
         pr.nome_completo
       LIMIT 10`
    )
    .all(namePattern) as unknown as PublicResultRow[];

  return rows;
}
