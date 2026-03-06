import "dotenv/config";
import { createHash } from "crypto";
import { hashSync } from "bcryptjs";
import { getDb } from "./database";
import { runMigrations } from "./migrate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gera slug de 6 chars hex deterministico a partir do título do formulário */
function formSlug(title: string): string {
  return createHash("sha256").update(title).digest("hex").slice(0, 6);
}

function insertFormField(
  formId: number,
  order: number,
  type: string,
  label: string,
  name: string,
  required: boolean,
  options?: string[],
  placeholder?: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO form_fields (form_id, type, label, name, placeholder, required, options_json, field_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    formId,
    type,
    label,
    name,
    placeholder ?? null,
    required ? 1 : 0,
    options ? JSON.stringify(options) : null,
    order
  );
}

/** Cria um formulário se não existir, retorna ID e slug (novo ou existente) */
function upsertForm(title: string, description: string): { id: number; slug: string } {
  const db = getDb();
  const slug = formSlug(title);
  const existing = db
    .prepare("SELECT id, slug FROM forms WHERE title = ?")
    .get(title) as { id: number; slug: string | null } | undefined;
  if (existing) {
    if (!existing.slug) {
      db.prepare("UPDATE forms SET slug = ? WHERE id = ?").run(slug, existing.id);
      console.log(`↻  Slug definido para o formulário ID ${existing.id}: ${slug}`);
    }
    console.log(`ℹ️  Formulário "${title}" já existe (ID ${existing.id}) — pulando.`);
    return { id: existing.id, slug: existing.slug ?? slug };
  }
  const res = db.prepare(`
    INSERT INTO forms (title, description, is_active, slug) VALUES (?, ?, 1, ?)
  `).run(title, description, slug);
  const id = Number(res.lastInsertRowid);
  console.log(`✅ Formulário criado: "${title}" (ID ${id}, slug: ${slug})`);
  return { id, slug };
}

/** Insere os 8 campos padrão de inscrição, parametrizando apenas as opções de série */
function seedFormFields(formId: number, serieOptions: string[]) {
  const db = getDb();
  const already = db
    .prepare("SELECT COUNT(*) as n FROM form_fields WHERE form_id = ?")
    .get(formId) as { n: number };
  if (already.n > 0) {
    console.log(`   ℹ️  Campos já existem para o formulário ID ${formId} — pulando.`);
    return;
  }

  insertFormField(formId, 1, "text",   "Nome Completo do Aluno",            "nome_completo",  true,  undefined,       "Digite o nome completo do aluno");
  insertFormField(formId, 2, "date",   "Data de Nascimento",                "data_nascimento", true);
  insertFormField(formId, 3, "cpf",    "CPF do Aluno",                      "cpf",            false, undefined,       "000.000.000-00");
  insertFormField(formId, 4, "text",   "Nome da Escola",                    "nome_escola",    true,  undefined,       "Digite o nome completo da escola");
  insertFormField(formId, 5, "radio",  "Turno que estuda no Ensino Regular","turno",          true,  ["Matutino", "Vespertino"]);
  insertFormField(formId, 6, "select", "Ano/Série",                         "ano_serie",      true,  serieOptions);
  insertFormField(formId, 7, "tel",    "Telefone",                          "telefone",       true,  undefined,       "Somente números");
  insertFormField(formId, 8, "file",   "Boletim Escolar",                   "boletim",        true,  undefined,       "PDF ou imagem — máx. 100 MB");

  console.log(`   ✅ 8 campos inseridos para o formulário ID ${formId}`);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

function seed() {
  // Garante que as tabelas existem antes do seed
  runMigrations();

  console.log("🌱 Iniciando seed...\n");

  // ── Admin padrão ──────────────────────────────────────────────────────────
  const db = getDb();
  const adminEmail    = process.env.ADMIN_EMAIL    ?? "admin@robotica.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@1234!";

  const existingAdmin = db
    .prepare("SELECT id FROM admin_users WHERE email = ? OR username = 'admin'")
    .get(adminEmail);

  if (!existingAdmin) {
    const passwordHash = hashSync(adminPassword, 12);
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)
    `).run("admin", adminEmail, passwordHash);
    console.log(`✅ Admin criado: ${adminEmail}`);
    console.log("   ⚠️  Troque a senha padrão no primeiro acesso ao painel!\n");
  } else {
    console.log(`ℹ️  Admin já existe (email ou username 'admin' já cadastrado)\n`);
  }

  // ── Formulários de inscrição ──────────────────────────────────────────────
  //
  //  ID esperado  │ Título
  //  ─────────────┼──────────────────────────────────────────────────────────
  //       1       │ Fundamental II — 6º ao 9º Ano (Manhã)    ← já existia
  //       2       │ Fundamental I  — 3º ao 5º Ano (Manhã)
  //       3       │ Fundamental I  — 3º ao 5º Ano (Tarde)
  //       4       │ Fundamental II — 6º ao 9º Ano (Tarde Avançada)
  //
  const seriesFI  = ["3º Ano", "4º Ano", "5º Ano"];
  const seriesFII = ["6º Ano", "7º Ano", "8º Ano", "9º Ano"];

  console.log("─".repeat(55));

  // Form 1 – Fundamental II Manhã (já existia, mantém ID 1)
  const { id: id1, slug: slug1 } = upsertForm(
    "Inscrição Fundamental II — 6º ao 9º Ano (Manhã)",
    "Formulário de inscrição para o programa de robótica — turma Fundamental II, 6º ao 9º ano, período matutino."
  );
  seedFormFields(id1, seriesFII);

  console.log("─".repeat(55));

  // Form 2 – Fundamental I Manhã
  const { id: id2, slug: slug2 } = upsertForm(
    "Inscrição Fundamental I — 3º ao 5º Ano (Manhã)",
    "Formulário de inscrição para o programa de robótica — turma Fundamental I, 3º ao 5º ano, período matutino."
  );
  seedFormFields(id2, seriesFI);

  console.log("─".repeat(55));

  // Form 3 – Fundamental I Tarde
  const { id: id3, slug: slug3 } = upsertForm(
    "Inscrição Fundamental I — 3º ao 5º Ano (Tarde)",
    "Formulário de inscrição para o programa de robótica — turma Fundamental I, 3º ao 5º ano, período vespertino."
  );
  seedFormFields(id3, seriesFI);

  console.log("─".repeat(55));

  // Form 4 – Fundamental II Tarde Avançada
  const { id: id4, slug: slug4 } = upsertForm(
    "Inscrição Fundamental II — 6º ao 9º Ano (Tarde Avançada)",
    "Formulário de inscrição para o programa de robótica — turma Fundamental II, 6º ao 9º ano, período vespertino avançado."
  );
  seedFormFields(id4, seriesFII);

  console.log("─".repeat(55));
  console.log("\n📋 Endpoints dos formulários:");
  console.log(`   GET /api/forms/${slug1}  → Fundamental II Manhã`);
  console.log(`   GET /api/forms/${slug2}  → Fundamental I  Manhã`);
  console.log(`   GET /api/forms/${slug3}  → Fundamental I  Tarde`);
  console.log(`   GET /api/forms/${slug4}  → Fundamental II Tarde Avançada`);
  console.log("\n✅ Seed concluído com sucesso!");
}

seed();