import { getDb } from "../db/database";

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

export function listTurmas(filters?: { formId?: number; isActive?: boolean }): TurmaRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<number> = [];

  if (filters?.formId) {
    conditions.push("t.form_id = ?");
    params.push(filters.formId);
  }

  if (typeof filters?.isActive === "boolean") {
    conditions.push("t.is_active = ?");
    params.push(filters.isActive ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return db
    .prepare(
      `SELECT
         t.id,
         t.name,
         t.form_id,
         f.title AS form_title,
         t.school_name,
         t.responsavel,
         t.day_of_week,
         t.start_time,
         t.end_time,
         t.max_capacity,
         t.is_active,
         t.created_at,
         t.updated_at,
         COUNT(te.id) AS enrolled_count
       FROM turmas t
       LEFT JOIN forms f ON f.id = t.form_id
       LEFT JOIN turma_enrollments te ON te.turma_id = t.id
       ${where}
       GROUP BY t.id
       ORDER BY t.is_active DESC, t.name ASC`
    )
    .all(...params) as unknown as TurmaRow[];
}

export function getTurmaById(id: number): TurmaDetail | null {
  const db = getDb();
  const turma = db
    .prepare(
      `SELECT
         t.id,
         t.name,
         t.form_id,
         f.title AS form_title,
         t.school_name,
         t.responsavel,
         t.day_of_week,
         t.start_time,
         t.end_time,
         t.max_capacity,
         t.is_active,
         t.created_at,
         t.updated_at,
         COUNT(te.id) AS enrolled_count
       FROM turmas t
       LEFT JOIN forms f ON f.id = t.form_id
       LEFT JOIN turma_enrollments te ON te.turma_id = t.id
       WHERE t.id = ?
       GROUP BY t.id`
    )
    .get(id) as TurmaRow | undefined;

  if (!turma) return null;

  const students = db
    .prepare(
      `SELECT
         s.id AS submission_id,
         s.protocol,
         s.status,
         s.submitted_at,
         te.notes,
         te.enrolled_at,
         (SELECT sd.value_text
          FROM submission_data sd
          WHERE sd.submission_id = s.id
            AND (sd.field_name = 'nome_completo' OR sd.field_name = 'nome')
          ORDER BY CASE WHEN sd.field_name = 'nome_completo' THEN 0 ELSE 1 END, sd.id
          LIMIT 1) AS nome_completo,
         (SELECT sd.value_text
          FROM submission_data sd
          WHERE sd.submission_id = s.id
            AND sd.field_name LIKE '%escola%'
          ORDER BY sd.id
          LIMIT 1) AS escola,
         (SELECT sg.canonical_name
          FROM submission_data sd
          JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
          JOIN school_groups sg ON sg.id = sa.group_id
          WHERE sd.submission_id = s.id
            AND sd.field_name LIKE '%escola%'
          ORDER BY sd.id
          LIMIT 1) AS escola_canonical,
         (SELECT sd.value_text
          FROM submission_data sd
          WHERE sd.submission_id = s.id
            AND (sd.field_name LIKE '%turno%' OR sd.field_name LIKE '%periodo%' OR sd.field_name LIKE '%período%')
          ORDER BY sd.id
          LIMIT 1) AS turno
       FROM turma_enrollments te
       JOIN submissions s ON s.id = te.submission_id
       WHERE te.turma_id = ?
       ORDER BY nome_completo COLLATE NOCASE ASC, s.submitted_at ASC`
    )
    .all(id) as unknown as TurmaStudentRow[];

  return { ...turma, students };
}

export function createTurma(input: {
  name: string;
  form_id?: number | null;
  school_name?: string | null;
  responsavel?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  max_capacity?: number;
  is_active?: boolean;
}): TurmaRow {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO turmas (
        name,
        form_id,
        school_name,
        responsavel,
        day_of_week,
        start_time,
        end_time,
        max_capacity,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      input.form_id ?? null,
      input.school_name?.trim() || null,
      input.responsavel?.trim() || null,
      input.day_of_week?.trim() || null,
      input.start_time?.trim() || null,
      input.end_time?.trim() || null,
      input.max_capacity ?? 20,
      input.is_active === false ? 0 : 1
    );

  const turma = getTurmaById(Number(result.lastInsertRowid));
  if (!turma) throw new Error("Falha ao criar turma.");
  return turma;
}

export function updateTurma(
  id: number,
  input: Partial<{
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
): TurmaRow | null {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM turmas WHERE id = ?").get(id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (input.name !== undefined) {
    updates.push("name = ?");
    params.push(input.name.trim());
  }
  if (input.form_id !== undefined) {
    updates.push("form_id = ?");
    params.push(input.form_id);
  }
  if (input.school_name !== undefined) {
    updates.push("school_name = ?");
    params.push(input.school_name?.trim() || null);
  }
  if (input.responsavel !== undefined) {
    updates.push("responsavel = ?");
    params.push(input.responsavel?.trim() || null);
  }
  if (input.day_of_week !== undefined) {
    updates.push("day_of_week = ?");
    params.push(input.day_of_week?.trim() || null);
  }
  if (input.start_time !== undefined) {
    updates.push("start_time = ?");
    params.push(input.start_time?.trim() || null);
  }
  if (input.end_time !== undefined) {
    updates.push("end_time = ?");
    params.push(input.end_time?.trim() || null);
  }
  if (input.max_capacity !== undefined) {
    updates.push("max_capacity = ?");
    params.push(input.max_capacity);
  }
  if (input.is_active !== undefined) {
    updates.push("is_active = ?");
    params.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    const turma = getTurmaById(id);
    return turma;
  }

  updates.push("updated_at = datetime('now')");

  db.prepare(`UPDATE turmas SET ${updates.join(", ")} WHERE id = ?`).run(...params, id);

  const turma = getTurmaById(id);
  return turma;
}

export function deleteTurma(id: number, force = false): { deleted: boolean; hasStudents: boolean } {
  const db = getDb();
  const enrollmentCount = db
    .prepare("SELECT COUNT(*) AS total FROM turma_enrollments WHERE turma_id = ?")
    .get(id) as { total: number };

  if (!force && enrollmentCount.total > 0) {
    return { deleted: false, hasStudents: true };
  }

  const result = db.prepare("DELETE FROM turmas WHERE id = ?").run(id);
  return { deleted: result.changes > 0, hasStudents: enrollmentCount.total > 0 };
}

export function enrollStudent(turmaId: number, submissionId: number, notes?: string): void {
  const db = getDb();

  const turma = db.prepare("SELECT id FROM turmas WHERE id = ?").get(turmaId);
  if (!turma) throw new Error("Turma não encontrada.");

  const submission = db
    .prepare("SELECT id, status FROM submissions WHERE id = ?")
    .get(submissionId) as { id: number; status: string } | undefined;

  if (!submission) throw new Error("Inscrição não encontrada.");

  db.prepare(
    `INSERT INTO turma_enrollments (turma_id, submission_id, notes)
     VALUES (?, ?, ?)
     ON CONFLICT(submission_id)
     DO UPDATE SET
       turma_id = excluded.turma_id,
       notes = excluded.notes,
       enrolled_at = datetime('now')`
  ).run(turmaId, submissionId, notes?.trim() || null);
}

export function removeStudent(turmaId: number, submissionId: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM turma_enrollments WHERE turma_id = ? AND submission_id = ?")
    .run(turmaId, submissionId);
  return result.changes > 0;
}

export function enrollStudentsBulk(
  turmaId: number,
  submissionIds: number[]
): { enrolled: number; errors: { submissionId: number; message: string }[] } {
  const db = getDb();

  const turma = db.prepare("SELECT id FROM turmas WHERE id = ?").get(turmaId);
  if (!turma) throw new Error("Turma não encontrada.");

  let enrolled = 0;
  const errors: { submissionId: number; message: string }[] = [];

  const stmt = db.prepare(
    `INSERT INTO turma_enrollments (turma_id, submission_id, notes)
     VALUES (?, ?, NULL)
     ON CONFLICT(submission_id)
     DO UPDATE SET
       turma_id = excluded.turma_id,
       enrolled_at = datetime('now')`
  );

  db.exec("BEGIN");
  try {
    for (const submissionId of submissionIds) {
      const sub = db
        .prepare("SELECT id FROM submissions WHERE id = ?")
        .get(submissionId) as { id: number } | undefined;

      if (!sub) {
        errors.push({ submissionId, message: "Inscrição não encontrada." });
        continue;
      }
      stmt.run(turmaId, submissionId);
      enrolled++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { enrolled, errors };
}

export function transferStudent(submissionId: number, toTurmaId: number, notes?: string): void {
  enrollStudent(toTurmaId, submissionId, notes);
}

export function getUnassignedStudents(formId?: number): UnassignedApprovedStudent[] {
  const db = getDb();
  const conditions = ["te.id IS NULL"];
  const params: number[] = [];

  if (formId) {
    conditions.push("s.form_id = ?");
    params.push(formId);
  }

  return db
    .prepare(
      `SELECT
         s.id AS submission_id,
         s.protocol,
         s.form_id,
         s.status,
         f.title AS form_title,
         s.submitted_at,
         (SELECT sd.value_text
          FROM submission_data sd
          WHERE sd.submission_id = s.id
            AND (sd.field_name = 'nome_completo' OR sd.field_name = 'nome')
          ORDER BY CASE WHEN sd.field_name = 'nome_completo' THEN 0 ELSE 1 END, sd.id
          LIMIT 1) AS nome_completo,
         (SELECT sd.value_text
          FROM submission_data sd
          WHERE sd.submission_id = s.id
            AND sd.field_name LIKE '%escola%'
          ORDER BY sd.id
          LIMIT 1) AS escola,
         (SELECT sg.canonical_name
          FROM submission_data sd
          JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
          JOIN school_groups sg ON sg.id = sa.group_id
          WHERE sd.submission_id = s.id
            AND sd.field_name LIKE '%escola%'
          ORDER BY sd.id
          LIMIT 1) AS escola_canonical,
         (SELECT sd.value_text
          FROM submission_data sd
          WHERE sd.submission_id = s.id
            AND (sd.field_name LIKE '%turno%' OR sd.field_name LIKE '%periodo%' OR sd.field_name LIKE '%período%')
          ORDER BY sd.id
          LIMIT 1) AS turno
       FROM submissions s
       JOIN forms f ON f.id = s.form_id
       LEFT JOIN turma_enrollments te ON te.submission_id = s.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY nome_completo COLLATE NOCASE ASC, s.submitted_at ASC`
    )
    .all(...params) as unknown as UnassignedApprovedStudent[];
}

/**
 * Returns canonical school names (from school_groups) that have unassigned submissions.
 * Falls back to raw distinct names for submissions not yet mapped to any group.
 */
export function listSchoolsWithUnassigned(formId?: number): string[] {
  const db = getDb();

  const formFilter = formId ? "AND s.form_id = ?" : "";
  const params: number[] = formId ? [formId] : [];

  // Canonical names from school_groups that have at least one unassigned submission
  const canonical = db
    .prepare(
      `SELECT DISTINCT sg.canonical_name AS escola
       FROM submissions s
       LEFT JOIN turma_enrollments te ON te.submission_id = s.id
       JOIN submission_data sd ON sd.submission_id = s.id AND sd.field_name LIKE '%escola%'
       JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
       JOIN school_groups sg ON sg.id = sa.group_id
       WHERE te.id IS NULL ${formFilter}
       ORDER BY sg.canonical_name COLLATE NOCASE ASC`
    )
    .all(...params) as { escola: string }[];

  return canonical.map((r) => r.escola);
}

/**
 * Enroll all unassigned submissions whose school maps to the given canonical name.
 * Uses school_aliases to match all spelling variations.
 * Optionally scoped to a specific form.
 */
export function enrollStudentsBySchool(
  turmaId: number,
  schoolName: string,
  formId?: number
): { enrolled: number; errors: { submissionId: number; message: string }[] } {
  const db = getDb();

  const turma = db.prepare("SELECT id FROM turmas WHERE id = ?").get(turmaId);
  if (!turma) throw new Error("Turma não encontrada.");

  const formFilter = formId ? "AND s.form_id = ?" : "";
  const params: Array<string | number> = [schoolName];
  if (formId) params.push(formId);

  // Match via school_groups → school_aliases so all spelling variations are covered
  const rows = db
    .prepare(
      `SELECT DISTINCT s.id AS submission_id
       FROM submissions s
       LEFT JOIN turma_enrollments te ON te.submission_id = s.id
       JOIN submission_data sd ON sd.submission_id = s.id AND sd.field_name LIKE '%escola%'
       JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
       JOIN school_groups sg ON sg.id = sa.group_id
       WHERE te.id IS NULL
         AND LOWER(sg.canonical_name) = LOWER(?) ${formFilter}`
    )
    .all(...params) as { submission_id: number }[];

  const submissionIds = rows.map((r) => r.submission_id);
  return enrollStudentsBulk(turmaId, submissionIds);
}

export function enrollStudentsByProtocols(
  turmaId: number,
  protocols: string[]
): { enrolled: number; errors: { protocol: string; message: string }[] } {
  const db = getDb();

  const turma = db.prepare("SELECT id FROM turmas WHERE id = ?").get(turmaId);
  if (!turma) throw new Error("Turma não encontrada.");

  let enrolled = 0;
  const errors: { protocol: string; message: string }[] = [];

  const stmt = db.prepare(
    `INSERT INTO turma_enrollments (turma_id, submission_id, notes)
     VALUES (?, ?, NULL)
     ON CONFLICT(submission_id)
     DO UPDATE SET
       turma_id = excluded.turma_id,
       enrolled_at = datetime('now')`
  );

  db.exec("BEGIN");
  try {
    for (const protocol of protocols) {
      const trimmed = protocol.trim();
      if (!trimmed) continue;
      const sub = db
        .prepare("SELECT id FROM submissions WHERE protocol = ?")
        .get(trimmed) as { id: number } | undefined;

      if (!sub) {
        errors.push({ protocol: trimmed, message: "Protocolo não encontrado." });
        continue;
      }
      stmt.run(turmaId, sub.id);
      enrolled++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { enrolled, errors };
}
