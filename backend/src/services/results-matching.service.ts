import { getDb } from "../db/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchStatus = "pending" | "confirmed" | "rejected" | "manual";

export interface PublicResultRow {
  id: number;
  nome_completo: string;
  nome_normalizado: string;
  escola: string;
  resultado: "aprovado" | "cadastro_reserva";
  submission_id: number | null;
  match_status: MatchStatus;
  created_at: string;
}

export interface SubmissionCandidate {
  submission_id: number;
  protocol: string;
  nome_inscricao: string;
  escola_inscricao: string | null;
  status: string;
  score: number; // 0–100
}

export interface PublicResultWithCandidates extends PublicResultRow {
  candidates: SubmissionCandidate[];
  linked_protocol: string | null;
  linked_nome: string | null;
}

// ─── String normalization ─────────────────────────────────────────────────────

export function normalizeStr(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// ─── LCS-based similarity score ──────────────────────────────────────────────
// Returns 0–100. Two identical strings → 100.

function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use two-row DP for memory efficiency
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[n];
}

export function matchScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (na === nb) return 100;
  const lcs = lcsLength(na, nb);
  return Math.round((lcs / Math.max(na.length, nb.length)) * 100);
}

// ─── Main matching query ──────────────────────────────────────────────────────

export function getResultsWithCandidates(filters?: {
  escola?: string;
  match_status?: MatchStatus | "";
  resultado?: "" | "aprovado" | "cadastro_reserva";
}): PublicResultWithCandidates[] {
  const db = getDb();

  // 1. Load all public_results (with linked info when confirmed)
  let query = `
    SELECT
      pr.*,
      s.protocol AS linked_protocol,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = pr.submission_id
           AND sd.field_name = 'nome_completo'
         LIMIT 1) AS linked_nome
    FROM public_results pr
    LEFT JOIN submissions s ON s.id = pr.submission_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.escola) {
    query += " AND pr.escola = ?";
    params.push(filters.escola);
  }
  if (filters?.match_status) {
    query += " AND pr.match_status = ?";
    params.push(filters.match_status);
  }
  if (filters?.resultado) {
    query += " AND pr.resultado = ?";
    params.push(filters.resultado);
  }

  query += " ORDER BY pr.escola, pr.nome_completo";

  const rows = db.prepare(query).all(...(params as (string | number | null | Buffer)[])) as unknown as (PublicResultRow & {
    linked_protocol: string | null;
    linked_nome: string | null;
  })[];

  // 2. Load all submission candidates once (avoid N+1)
  const allCandidates = db.prepare(`
    SELECT
      s.id        AS submission_id,
      s.protocol,
      s.status,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id
           AND sd.field_name = 'nome_completo'
         LIMIT 1) AS nome_inscricao,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id
           AND sd.field_name = 'nome_escola'
         LIMIT 1) AS escola_inscricao
    FROM submissions s
    WHERE EXISTS (
      SELECT 1 FROM submission_data sd
      WHERE sd.submission_id = s.id
        AND sd.field_name = 'nome_completo'
        AND sd.value_text IS NOT NULL
        AND sd.value_text != ''
    )
  `).all() as unknown as {
    submission_id: number;
    protocol: string;
    status: string;
    nome_inscricao: string;
    escola_inscricao: string | null;
  }[];

  // 3. For each public_result, compute top-3 candidates
  return rows.map((pr) => {
    // Already confirmed — no need to recompute candidates
    if (pr.match_status === "confirmed" && pr.submission_id) {
      return {
        ...pr,
        candidates: [],
      };
    }

    const scored = allCandidates
      .map((c) => ({
        ...c,
        score: matchScore(pr.nome_normalizado || pr.nome_completo, c.nome_inscricao),
      }))
      .filter((c) => c.score >= 60)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      ...pr,
      candidates: scored,
    };
  });
}

// ─── Duplicates detection ─────────────────────────────────────────────────────

export interface DuplicateGroup {
  key: string; // nome_normalizado + escola
  entries: PublicResultRow[];
}

export function getDuplicates(): DuplicateGroup[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT *
    FROM public_results
    WHERE (nome_normalizado, escola) IN (
      SELECT nome_normalizado, escola
      FROM public_results
      GROUP BY nome_normalizado, escola
      HAVING COUNT(*) > 1
    )
    ORDER BY escola, nome_normalizado, id
  `).all() as unknown as PublicResultRow[];

  // Group by key
  const map = new Map<string, PublicResultRow[]>();
  for (const row of rows) {
    const key = `${row.nome_normalizado}||${row.escola}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }

  return Array.from(map.entries()).map(([key, entries]) => ({ key, entries }));
}

// ─── Missing: inscriptions with no match in PDF ───────────────────────────────

export interface MissingEntry {
  submission_id: number;
  protocol: string;
  nome_inscricao: string;
  escola_inscricao: string | null;
  status: string;
}

export function getMissing(): MissingEntry[] {
  const db = getDb();

  // All public_results normalized names (all schools combined for quick lookup)
  const pdfAll = db.prepare(`SELECT nome_normalizado FROM public_results`)
    .all() as unknown as { nome_normalizado: string }[];
  const pdfNormSet = new Set(pdfAll.map((r) => r.nome_normalizado));

  if (pdfNormSet.size === 0) return [];

  // All submissions (any status) with their nome_completo and nome_escola
  // Using exact field names defined in the form seed
  const all = db.prepare(`
    SELECT
      s.id AS submission_id,
      s.protocol,
      s.status,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id
           AND sd.field_name = 'nome_completo'
         LIMIT 1) AS nome_inscricao,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id
           AND sd.field_name = 'nome_escola'
         LIMIT 1) AS escola_inscricao
    FROM submissions s
    WHERE EXISTS (
      SELECT 1 FROM submission_data sd
      WHERE sd.submission_id = s.id
        AND sd.field_name = 'nome_completo'
        AND sd.value_text IS NOT NULL
        AND sd.value_text != ''
    )
  `).all() as unknown as MissingEntry[];

  // Return submissions whose normalized name has no match (>=80%) in any PDF entry
  return all.filter((sub) => {
    if (!sub.nome_inscricao) return false;
    const normInscricao = normalizeStr(sub.nome_inscricao);
    // Check for any high-score match across all PDF names
    for (const pdfName of pdfNormSet) {
      if (matchScore(normInscricao, pdfName) >= 80) return false;
    }
    return true;
  });
}

// ─── Auto-link all pending entries to their best candidate ────────────────────

export interface AutoLinkResult {
  linked: number;   // entries that were linked
  skipped: number;  // entries with no candidate above threshold
}

/**
 * For every pending/rejected public_result, find the best scoring submission
 * candidate. If above `minScore` (default 80), confirm the link.
 * Already-confirmed entries are never touched.
 */
export function autoLinkAll(minScore = 80): AutoLinkResult {
  const db = getDb();

  const pending = db.prepare(`
    SELECT * FROM public_results
    WHERE match_status != 'confirmed'
  `).all() as unknown as PublicResultRow[];

  if (pending.length === 0) return { linked: 0, skipped: 0 };

  const allCandidates = db.prepare(`
    SELECT
      s.id AS submission_id,
      (SELECT sd.value_text FROM submission_data sd
         WHERE sd.submission_id = s.id
           AND sd.field_name = 'nome_completo'
         LIMIT 1) AS nome_inscricao
    FROM submissions s
    WHERE EXISTS (
      SELECT 1 FROM submission_data sd
      WHERE sd.submission_id = s.id
        AND sd.field_name = 'nome_completo'
        AND sd.value_text IS NOT NULL
        AND sd.value_text != ''
    )
  `).all() as unknown as { submission_id: number; nome_inscricao: string }[];

  const update = db.prepare(`
    UPDATE public_results
    SET submission_id = ?, match_status = 'confirmed'
    WHERE id = ?
  `);

  const toLink: { id: number; sub: number }[] = [];

  for (const row of pending) {
    const pdfNorm = row.nome_normalizado || normalizeStr(row.nome_completo);
    let bestScore = 0;
    let bestSubId: number | null = null;
    for (const c of allCandidates) {
      const s = matchScore(pdfNorm, c.nome_inscricao);
      if (s > bestScore) {
        bestScore = s;
        bestSubId = c.submission_id;
      }
    }
    if (bestScore >= minScore && bestSubId !== null) {
      toLink.push({ id: row.id, sub: bestSubId });
    }
  }

  db.exec("BEGIN");
  try {
    for (const item of toLink) update.run(item.sub, item.id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { linked: toLink.length, skipped: pending.length - toLink.length };
}

// ─── Bulk approve submissions from confirmed PDF results ──────────────────────

export interface BulkApproveResult {
  approved: number;      // submissions set to 'aprovado'
  reserved: number;      // submissions set to 'reserva'
  alreadyDone: number;   // already had the correct status
}

/**
 * For every confirmed public_result:
 *   - resultado='aprovado'        → submission status = 'aprovado'
 *   - resultado='cadastro_reserva' → submission status = 'reserva'
 */
export function bulkApproveFromPdf(reviewedById: number | null = null): BulkApproveResult {
  const db = getDb();

  const confirmed = db.prepare(`
    SELECT submission_id, resultado
    FROM public_results
    WHERE match_status = 'confirmed'
      AND submission_id IS NOT NULL
      AND resultado IN ('aprovado', 'cadastro_reserva')
  `).all() as unknown as { submission_id: number; resultado: string }[];

  if (confirmed.length === 0) return { approved: 0, reserved: 0, alreadyDone: 0 };

  const ids = confirmed.map((r) => r.submission_id);
  const resultadoMap = new Map(confirmed.map((r) => [r.submission_id, r.resultado]));
  const placeholders = ids.map(() => "?").join(",");

  const existing = db.prepare(`
    SELECT id, status FROM submissions WHERE id IN (${placeholders})
  `).all(...(ids as number[])) as unknown as { id: number; status: string }[];

  const updateAprovado = db.prepare(`
    UPDATE submissions
    SET status = 'aprovado', rejection_reason = NULL,
        reviewed_at = datetime('now'), reviewed_by = ?
    WHERE id = ?
  `);
  const updateReserva = db.prepare(`
    UPDATE submissions
    SET status = 'reserva', rejection_reason = NULL,
        reviewed_at = datetime('now'), reviewed_by = ?
    WHERE id = ?
  `);

  const toAprovado: number[] = [];
  const toReserva: number[] = [];
  let alreadyDone = 0;

  for (const row of existing) {
    const targetStatus = resultadoMap.get(row.id) === "aprovado" ? "aprovado" : "reserva";
    if (row.status === targetStatus) {
      alreadyDone++;
    } else if (targetStatus === "aprovado") {
      toAprovado.push(row.id);
    } else {
      toReserva.push(row.id);
    }
  }

  if (toAprovado.length > 0 || toReserva.length > 0) {
    db.exec("BEGIN");
    try {
      for (const id of toAprovado) updateAprovado.run(reviewedById, id);
      for (const id of toReserva)  updateReserva.run(reviewedById, id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  return { approved: toAprovado.length, reserved: toReserva.length, alreadyDone };
}

// ─── Unmatched PDF entries (inverse of getMissing) ────────────────────────────
// PDF entries whose exact normalized name doesn't exist in any submission.
// These are students the coordinator added to the PDF outside the system.

export function getUnmatched(): PublicResultRow[] {
  const db = getDb();
  const allPdf = db.prepare(`
    SELECT * FROM public_results
    WHERE match_status != 'confirmed'
  `).all() as unknown as PublicResultRow[];

  if (allPdf.length === 0) return [];

  // All unique normalized submission names (exact, no score)
  const allSubs = db.prepare(`
    SELECT DISTINCT sd.value_text AS nome_inscricao
    FROM submission_data sd
    WHERE sd.field_name = 'nome_completo'
      AND sd.value_text IS NOT NULL
      AND sd.value_text != ''
  `).all() as unknown as { nome_inscricao: string }[];

  const subNormSet = new Set(allSubs.map((s) => normalizeStr(s.nome_inscricao)));

  // Return PDF entries whose exact normalized name has NO submission counterpart
  return allPdf.filter((row) => {
    const pdfNorm = row.nome_normalizado || normalizeStr(row.nome_completo);
    return !subNormSet.has(pdfNorm);
  });
}
