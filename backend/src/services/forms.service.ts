import { createHash } from "crypto";
import { getDb } from "../db/database";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  updated_at: string;
}

export interface FormFieldRow {
  id: number;
  form_id: number;
  type: string;
  label: string;
  name: string;
  placeholder: string | null;
  required: number;
  options_json: string | null;
  field_order: number;
  created_at: string;
}

export interface FormWithFields extends FormRow {
  fields: FormFieldRow[];
}

// Tipos de campo permitidos
export const ALLOWED_FIELD_TYPES = [
  "text",
  "date",
  "tel",
  "radio",
  "select",
  "file",
  "cpf",
  "email",
  "textarea",
  "number",
] as const;
export type FieldType = (typeof ALLOWED_FIELD_TYPES)[number];

// ─── Leitura ─────────────────────────────────────────────────────────────────

export function getFormById(id: number): FormWithFields | null {
  const db = getDb();
  const form = db
    .prepare("SELECT * FROM forms WHERE id = ?")
    .get(id) as unknown as FormRow | undefined;

  if (!form) return null;

  const fields = db
    .prepare(
      "SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order ASC"
    )
    .all(id) as unknown as FormFieldRow[];

  return { ...form, fields };
}

export function listForms(): FormRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM forms ORDER BY created_at DESC")
    .all() as unknown as FormRow[];
}

export function listActiveForms(): Pick<FormRow, "id" | "title" | "slug" | "description" | "card_level" | "card_turno" | "card_subtitle">[] {
  const db = getDb();
  return db
    .prepare("SELECT id, title, slug, description, card_level, card_turno, card_subtitle FROM forms WHERE is_active = 1 AND slug IS NOT NULL ORDER BY display_order ASC")
    .all() as unknown as Pick<FormRow, "id" | "title" | "slug" | "description" | "card_level" | "card_turno" | "card_subtitle">[];
}

export function getFormBySlug(slug: string): FormWithFields | null {
  const db = getDb();
  const form = db
    .prepare("SELECT * FROM forms WHERE slug = ?")
    .get(slug) as unknown as FormRow | undefined;
  if (!form) return null;
  const fields = db
    .prepare("SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order ASC")
    .all(form.id) as unknown as FormFieldRow[];
  return { ...form, fields };
}

// ─── Criação ─────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return createHash("sha256").update(title).digest("hex").slice(0, 6);
}

export function createForm(
  title: string,
  description?: string,
  cardFields?: { card_level?: string; card_turno?: string; card_subtitle?: string }
): FormRow {
  const db = getDb();
  const slug = generateSlug(title + Date.now());
  const maxOrder = (db
    .prepare("SELECT COALESCE(MAX(display_order), 0) as m FROM forms")
    .get() as { m: number }).m;
  const result = db
    .prepare("INSERT INTO forms (title, description, display_order, slug, card_level, card_turno, card_subtitle) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(title, description ?? null, maxOrder + 1, slug, cardFields?.card_level ?? null, cardFields?.card_turno ?? null, cardFields?.card_subtitle ?? null);

  return db
    .prepare("SELECT * FROM forms WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as FormRow;
}

export function reorderForms(items: { id: number; display_order: number }[]): void {
  const db = getDb();
  const update = db.prepare("UPDATE forms SET display_order = ? WHERE id = ?");
  // node:sqlite não tem .transaction() nativo — usa BEGIN/COMMIT manual
  db.exec("BEGIN");
  try {
    for (const item of items) {
      update.run(item.display_order, item.id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function createField(
  formId: number,
  data: {
    type: FieldType;
    label: string;
    name: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
    order: number;
  }
): FormFieldRow {
  const db = getDb();

  // Garante que o form existe
  const form = db.prepare("SELECT id FROM forms WHERE id = ?").get(formId);
  if (!form) throw new Error("Formulário não encontrado.");

  const result = db
    .prepare(`
      INSERT INTO form_fields
        (form_id, type, label, name, placeholder, required, options_json, field_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      formId,
      data.type,
      data.label,
      data.name,
      data.placeholder ?? null,
      data.required ? 1 : 0,
      data.options ? JSON.stringify(data.options) : null,
      data.order
    );

  return db
    .prepare("SELECT * FROM form_fields WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as FormFieldRow;
}

// ─── Atualização ─────────────────────────────────────────────────────────────

export function updateForm(
  id: number,
  data: { title?: string; description?: string; is_active?: boolean; card_level?: string | null; card_turno?: string | null; card_subtitle?: string | null }
): FormRow | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM forms WHERE id = ?")
    .get(id) as FormRow | undefined;

  if (!existing) return null;

  const title = data.title ?? existing.title;
  const description =
    data.description !== undefined ? data.description : existing.description;
  const is_active =
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;
  const card_level = data.card_level !== undefined ? data.card_level : existing.card_level;
  const card_turno = data.card_turno !== undefined ? data.card_turno : existing.card_turno;
  const card_subtitle = data.card_subtitle !== undefined ? data.card_subtitle : existing.card_subtitle;

  db.prepare(`
    UPDATE forms
    SET title = ?, description = ?, is_active = ?, card_level = ?, card_turno = ?, card_subtitle = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, is_active, card_level, card_turno, card_subtitle, id);

  return db.prepare("SELECT * FROM forms WHERE id = ?").get(id) as unknown as FormRow;
}

export function updateField(
  fieldId: number,
  formId: number,
  data: {
    type?: FieldType;
    label?: string;
    name?: string;
    placeholder?: string | null;
    required?: boolean;
    options?: string[] | null;
    order?: number;
  }
): FormFieldRow | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM form_fields WHERE id = ? AND form_id = ?")
    .get(fieldId, formId) as FormFieldRow | undefined;

  if (!existing) return null;

  const type = data.type ?? existing.type;
  const label = data.label ?? existing.label;
  const name = data.name ?? existing.name;
  const placeholder =
    data.placeholder !== undefined ? data.placeholder : existing.placeholder;
  const required =
    data.required !== undefined ? (data.required ? 1 : 0) : existing.required;
  const options_json =
    data.options !== undefined
      ? data.options
        ? JSON.stringify(data.options)
        : null
      : existing.options_json;
  const field_order = data.order ?? existing.field_order;

  db.prepare(`
    UPDATE form_fields
    SET type = ?, label = ?, name = ?, placeholder = ?,
        required = ?, options_json = ?, field_order = ?
    WHERE id = ? AND form_id = ?
  `).run(type, label, name, placeholder, required, options_json, field_order, fieldId, formId);

  return db
    .prepare("SELECT * FROM form_fields WHERE id = ?")
    .get(fieldId) as unknown as FormFieldRow;
}

/** Reordena múltiplos campos de uma vez: recebe array de {id, order} */
export function reorderFields(
  formId: number,
  items: { id: number; order: number }[]
): void {
  const db = getDb();
  // node:sqlite não tem .transaction() nativo — usa BEGIN/COMMIT manual
  db.exec("BEGIN");
  try {
    const stmt = db.prepare(
      "UPDATE form_fields SET field_order = ? WHERE id = ? AND form_id = ?"
    );
    for (const item of items) {
      stmt.run(item.order, item.id, formId);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ─── Exclusão ────────────────────────────────────────────────────────────────

/** Soft delete: marca como inativo, não apaga os dados */
export function deactivateForm(id: number): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE forms SET is_active = 0, updated_at = datetime('now') WHERE id = ?"
    )
    .run(id);
  return result.changes > 0;
}

/** Hard delete: apaga formulário, campos e submissões/dados associados */
export function deleteForm(id: number): boolean {
  const db = getDb();
  const form = db.prepare("SELECT id FROM forms WHERE id = ?").get(id) as { id: number } | undefined;
  if (!form) return false;
  db.exec("BEGIN");
  try {
    // submission_data referencia submissions — apagar primeiro
    db.prepare(
      "DELETE FROM submission_data WHERE submission_id IN (SELECT id FROM submissions WHERE form_id = ?)"
    ).run(id);
    db.prepare("DELETE FROM submissions WHERE form_id = ?").run(id);
    db.prepare("DELETE FROM form_fields WHERE form_id = ?").run(id);
    db.prepare("DELETE FROM forms WHERE id = ?").run(id);
    db.exec("COMMIT");
    return true;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function deleteField(fieldId: number, formId: number): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM form_fields WHERE id = ? AND form_id = ?")
    .run(fieldId, formId);
  return result.changes > 0;
}
