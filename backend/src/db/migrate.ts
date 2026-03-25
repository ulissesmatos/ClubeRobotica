import { getDb } from "./database";

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_initial",
    sql: `
      -- Tabela de controle de migrations
      CREATE TABLE IF NOT EXISTS migrations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        name      TEXT    NOT NULL UNIQUE,
        run_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Formulários dinâmicos
      CREATE TABLE IF NOT EXISTS forms (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT    NOT NULL,
        description TEXT,
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Campos de cada formulário
      CREATE TABLE IF NOT EXISTS form_fields (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id        INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        type           TEXT    NOT NULL, -- text | date | tel | radio | select | file | cpf
        label          TEXT    NOT NULL,
        name           TEXT    NOT NULL,
        placeholder    TEXT,
        required       INTEGER NOT NULL DEFAULT 1,
        options_json   TEXT,             -- JSON array de strings para radio/select
        field_order    INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Submissões (cabeçalho de cada resposta)
      CREATE TABLE IF NOT EXISTS submissions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id      INTEGER NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
        status       TEXT    NOT NULL DEFAULT 'pendente', -- pendente | aprovado | rejeitado
        ip_address   TEXT,
        user_agent   TEXT,
        submitted_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Dados de cada campo de uma submissão
      CREATE TABLE IF NOT EXISTS submission_data (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id   INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        field_name      TEXT    NOT NULL,
        field_label     TEXT    NOT NULL,
        value_text      TEXT,
        value_file_path TEXT    -- caminho relativo ao UPLOAD_DIR
      );

      -- Admins
      CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        email         TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Refresh tokens (httpOnly cookie)
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id   INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        token_hash TEXT    NOT NULL UNIQUE,
        expires_at TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Índices para queries comuns
      CREATE INDEX IF NOT EXISTS idx_submissions_form_id    ON submissions(form_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_status     ON submissions(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_submitted  ON submissions(submitted_at);
      CREATE INDEX IF NOT EXISTS idx_sub_data_submission_id ON submission_data(submission_id);
      CREATE INDEX IF NOT EXISTS idx_form_fields_form_id    ON form_fields(form_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash);
    `,
  },
  {
    // Adiciona coluna protocol à tabela submissions.
    // Gerado pela aplicação (ROB-XXXXXXXX) — não sequencial, não revela contagem.
    name: "002_add_protocol",
    sql: `
      ALTER TABLE submissions ADD COLUMN protocol TEXT NOT NULL DEFAULT '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_protocol ON submissions(protocol)
        WHERE protocol != '';
    `,
  },
  {
    // Adiciona coluna slug curto (6 chars hex) à tabela forms.
    // Gerado deterministicamente via SHA-256 do título — não expõe IDs sequenciais.
    name: "003_add_form_slug",
    sql: `
      ALTER TABLE forms ADD COLUMN slug TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
    `,
  },
  {
    // Adiciona coluna display_order à tabela forms.
    // Controla a ordem em que os cards aparecem na landing page.
    name: "004_add_form_display_order",
    sql: `
      ALTER TABLE forms ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
      UPDATE forms SET display_order = id;
    `,
  },
  {
    // Adiciona colunas de texto do card na landing page.
    // Permite editar individualmente: nível, turno e subtítulo sem depender heurísticas do título.
    name: "005_add_card_display_fields",
    sql: `
      ALTER TABLE forms ADD COLUMN card_level    TEXT;
      ALTER TABLE forms ADD COLUMN card_turno    TEXT;
      ALTER TABLE forms ADD COLUMN card_subtitle TEXT;
    `,
  },
  {
    // Tabela de grupos de escolas para normalização de nomes livres.
    // school_groups: nome canônico definido pelo admin.
    // school_aliases: cada variação do nome (raw_name) mapeada a um grupo.
    name: "007_school_groups",
    sql: `
      CREATE TABLE IF NOT EXISTS school_groups (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_name TEXT    NOT NULL UNIQUE,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS school_aliases (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id   INTEGER NOT NULL REFERENCES school_groups(id) ON DELETE CASCADE,
        raw_name   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_school_aliases_group ON school_aliases(group_id);
      CREATE INDEX IF NOT EXISTS idx_school_aliases_raw   ON school_aliases(raw_name COLLATE NOCASE);
    `,
  },
  {
    // Tabela de configurações do site (chave-valor).
    // Armazena dados de contato e redes sociais editáveis pelo admin.
    name: "006_add_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('whatsapp_number',          '559998881234'),
        ('whatsapp_message',         'Olá! Tenho interesse no Clubinho de Robótica de Codó. Pode me dar mais informações?'),
        ('whatsapp_floating_enabled','1'),
        ('whatsapp_footer_enabled',  '1'),
        ('instagram_handle',         'clubinhorobotica_codo'),
        ('instagram_enabled',        '1'),
        ('phone_display',            '(99) 98888-1234'),
        ('phone_number',             '559998881234'),
        ('phone_enabled',            '1');
    `,
  },
];

export function runMigrations(): void {
  const db = getDb();

  // Cria tabela de controle se não existir
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT    NOT NULL UNIQUE,
      run_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT name FROM migrations")
      .all()
      .map((r: unknown) => (r as { name: string }).name)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;

    console.log(`📦 Rodando migration: ${migration.name}`);
    db.exec(migration.sql);
    db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
    console.log(`✅ Migration concluída: ${migration.name}`);
  }
}
