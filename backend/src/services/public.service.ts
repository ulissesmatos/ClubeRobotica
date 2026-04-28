import { getDb } from "../db/database";

export interface PublicResultRow {
  id: number;           // submission id
  nome_completo: string;
  escola: string;
  resultado: "aprovado" | "reserva";
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
  return /^[A-Z]{2,6}-\d+/.test(q.toUpperCase());
}

function looksLikeCpf(q: string): boolean {
  return onlyDigits(q).length >= 10;
}

/**
 * Base SELECT that reads directly from submissions (status = 'aprovado' | 'reserva').
 * The `resultado` column is derived from the submission status.
 * Turma info is joined when available.
 */
function baseSelect() {
  return `
    SELECT
      s.id,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id AND sd.field_name = 'nome_completo' LIMIT 1
      ) AS nome_completo,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id AND sd.field_name = 'nome_escola' LIMIT 1
      ) AS escola,
      s.status AS resultado,
      t.name        AS turma_name,
      t.day_of_week AS turma_day,
      t.start_time  AS turma_start,
      t.end_time    AS turma_end
    FROM submissions s
    LEFT JOIN turma_enrollments te ON te.submission_id = s.id
    LEFT JOIN turmas t ON t.id = te.turma_id
    WHERE s.status IN ('aprovado', 'reserva')
  `;
}

export function searchPublicResults(query: string): PublicResultRow[] {
  if (!query || query.trim().length < 3) return [];

  const db = getDb();
  const q = query.trim();

  // ── 1. Search by protocol ────────────────────────────────────────────────
  if (looksLikeProtocol(q)) {
    const rows = db
      .prepare(`${baseSelect()} AND UPPER(s.protocol) = UPPER(?) LIMIT 5`)
      .all(q) as unknown as PublicResultRow[];
    if (rows.length > 0) return rows;
  }

  // ── 2. Search by CPF ─────────────────────────────────────────────────────
  if (looksLikeCpf(q)) {
    const digits = onlyDigits(q);
    const rows = db
      .prepare(`
        ${baseSelect()}
        AND EXISTS (
          SELECT 1 FROM submission_data sd2
          WHERE sd2.submission_id = s.id
            AND (sd2.field_name LIKE '%cpf%' OR sd2.field_name LIKE '%documento%')
            AND REPLACE(REPLACE(REPLACE(sd2.value_text, '.', ''), '-', ''), ' ', '') = ?
        )
        LIMIT 5
      `)
      .all(digits) as unknown as PublicResultRow[];
    if (rows.length > 0) return rows;
  }

  // ── 3. Search by name (accent-insensitive) ───────────────────────────────
  const namePattern = `%${normalize(q)}%`;
  const rows = db
    .prepare(`
      ${baseSelect()}
      AND EXISTS (
        SELECT 1 FROM submission_data sd3
        WHERE sd3.submission_id = s.id
          AND sd3.field_name = 'nome_completo'
          AND UPPER(
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
              sd3.value_text COLLATE NOCASE,
              'á','A'),'à','A'),'ã','A'),'â','A'),'é','E'),
              'ê','E'),'í','I'),'ó','O'),'ô','O'),'õ','O'),
              'ú','U'),'ç','C')
          ) LIKE UPPER(?)
      )
      ORDER BY CASE s.status WHEN 'aprovado' THEN 0 ELSE 1 END, s.id
      LIMIT 20
    `)
    .all(namePattern) as unknown as PublicResultRow[];

  return rows;
}
