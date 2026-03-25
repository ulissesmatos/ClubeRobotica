import { getDb } from "../db/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchoolGroup {
  id: number;
  canonical_name: string;
  created_at: string;
  aliases: string[];
  count: number; // total de submissões cujo raw_name está neste grupo
}

export interface RawSchoolName {
  raw_name: string;
  count: number;
  group_id: number | null;
  canonical_name: string | null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Retorna todos os nomes únicos de escola encontrados nas submissões,
 * junto com a contagem de ocorrências e o grupo ao qual estão mapeados (se houver).
 * Busca em todos os campos que contenham "escola" no field_name.
 */
export function listRawSchoolNames(): RawSchoolName[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         TRIM(sd.value_text)           AS raw_name,
         COUNT(*)                     AS count,
         sa.group_id                  AS group_id,
         sg.canonical_name            AS canonical_name
       FROM submission_data sd
       LEFT JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
       LEFT JOIN school_groups  sg ON sg.id = sa.group_id
       WHERE sd.field_name LIKE '%escola%'
         AND sd.value_text IS NOT NULL
         AND TRIM(sd.value_text) != ''
       GROUP BY LOWER(TRIM(sd.value_text))
       ORDER BY count DESC`
    )
    .all() as unknown as RawSchoolName[];
}

/**
 * Retorna todos os grupos com seus aliases e contagem total de submissões.
 */
export function listSchoolGroups(): SchoolGroup[] {
  const db = getDb();

  const groups = db
    .prepare(
      `SELECT id, canonical_name, created_at FROM school_groups ORDER BY canonical_name`
    )
    .all() as { id: number; canonical_name: string; created_at: string }[];

  const aliasesStmt = db.prepare(
    `SELECT raw_name FROM school_aliases WHERE group_id = ? ORDER BY raw_name`
  );

  const countStmt = db.prepare(
    `SELECT COUNT(*) AS total
     FROM submission_data sd
     JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
     WHERE sa.group_id = ?
       AND sd.field_name LIKE '%escola%'`
  );

  return groups.map((g) => {
    const aliases = (aliasesStmt.all(g.id) as { raw_name: string }[]).map(
      (a) => a.raw_name
    );
    const { total } = countStmt.get(g.id) as { total: number };
    return { ...g, aliases, count: total };
  });
}

/**
 * Cria um novo grupo com nome canônico e lista de aliases iniciais.
 * Aliases que já pertencem a outro grupo são ignorados (não lança erro).
 */
export function createSchoolGroup(
  canonicalName: string,
  aliases: string[]
): SchoolGroup {
  const db = getDb();
  const insertGroup = db.prepare(
    `INSERT INTO school_groups (canonical_name) VALUES (?)`
  );
  const insertAlias = db.prepare(
    `INSERT OR IGNORE INTO school_aliases (group_id, raw_name) VALUES (?, ?)`
  );

  let groupId: number;
  db.exec("BEGIN");
  try {
    const info = insertGroup.run(canonicalName.trim());
    groupId = info.lastInsertRowid as number;
    // Sempre incluir o nome canônico como alias (garante contagem correta)
    insertAlias.run(groupId, canonicalName.trim());
    for (const alias of aliases) {
      const trimmed = alias.trim();
      if (trimmed) insertAlias.run(groupId, trimmed);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const group = db
    .prepare(`SELECT id, canonical_name, created_at FROM school_groups WHERE id = ?`)
    .get(groupId) as { id: number; canonical_name: string; created_at: string };

  const aliasesList = (
    db
      .prepare(`SELECT raw_name FROM school_aliases WHERE group_id = ?`)
      .all(groupId) as { raw_name: string }[]
  ).map((a) => a.raw_name);

  const { total } = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM submission_data sd
       JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
       WHERE sa.group_id = ?
         AND sd.field_name LIKE '%escola%'`
    )
    .get(groupId) as { total: number };

  return { ...group, aliases: aliasesList, count: total };
}

/**
 * Atualiza o nome canônico e/ou adiciona novos aliases a um grupo existente.
 */
export function updateSchoolGroup(
  groupId: number,
  canonicalName: string | undefined,
  addAliases: string[]
): SchoolGroup | null {
  const db = getDb();

  const existing = db
    .prepare(`SELECT id FROM school_groups WHERE id = ?`)
    .get(groupId);
  if (!existing) return null;

  db.exec("BEGIN");
  try {
    if (canonicalName?.trim()) {
      db.prepare(`UPDATE school_groups SET canonical_name = ? WHERE id = ?`).run(
        canonicalName.trim(),
        groupId
      );
    }
    const insertAlias = db.prepare(
      `INSERT OR IGNORE INTO school_aliases (group_id, raw_name) VALUES (?, ?)`
    );
    for (const alias of addAliases) {
      const trimmed = alias.trim();
      if (trimmed) insertAlias.run(groupId, trimmed);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const group = db
    .prepare(`SELECT id, canonical_name, created_at FROM school_groups WHERE id = ?`)
    .get(groupId) as { id: number; canonical_name: string; created_at: string };

  const aliases = (
    db
      .prepare(`SELECT raw_name FROM school_aliases WHERE group_id = ?`)
      .all(groupId) as { raw_name: string }[]
  ).map((a) => a.raw_name);

  const { total } = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM submission_data sd
       JOIN school_aliases sa ON LOWER(TRIM(sa.raw_name)) = LOWER(TRIM(sd.value_text))
       WHERE sa.group_id = ?
         AND sd.field_name LIKE '%escola%'`
    )
    .get(groupId) as { total: number };

  return { ...group, aliases, count: total };
}

/**
 * Remove um alias específico de qualquer grupo.
 */
export function removeAlias(rawName: string): boolean {
  const db = getDb();
  const info = db
    .prepare(`DELETE FROM school_aliases WHERE raw_name = ? COLLATE NOCASE`)
    .run(rawName);
  return info.changes > 0;
}

/**
 * Exclui um grupo e todos os seus aliases (cascade).
 */
export function deleteSchoolGroup(groupId: number): boolean {
  const db = getDb();
  const info = db
    .prepare(`DELETE FROM school_groups WHERE id = ?`)
    .run(groupId);
  return info.changes > 0;
}
