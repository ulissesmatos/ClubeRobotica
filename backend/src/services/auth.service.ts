import { compareSync, hashSync } from "bcryptjs";
import crypto from "crypto";
import { getDb } from "../db/database";

const ACCESS_TOKEN_TTL = "15m";   // access token expira em 15 minutos
const REFRESH_TOKEN_TTL_DAYS = 7; // refresh token expira em 7 dias

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AdminRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface LoginResult {
  accessToken: string;
  refreshTokenRaw: string;
  admin: { id: number; username: string; email: string };
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Gera o ISO string de expiração N dias a partir de agora */
function expiresAt(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Hash do refresh token para armazenar no banco (não guardamos o valor raw) */
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ─── Exportações públicas ─────────────────────────────────────────────────────

/** Verifica credenciais e retorna o admin se válido, ou null */
export function verifyAdminCredentials(
  email: string,
  password: string
): AdminRow | null {
  const db = getDb();
  const admin = db
    .prepare("SELECT * FROM admin_users WHERE email = ?")
    .get(email.toLowerCase().trim()) as AdminRow | undefined;

  if (!admin) return null;
  if (!compareSync(password, admin.password_hash)) return null;
  return admin;
}

/** Salva refresh token no banco e retorna o valor raw (para enviar ao cliente) */
export function createRefreshToken(adminId: number): string {
  const db = getDb();
  const raw = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(raw);

  db.prepare(`
    INSERT INTO refresh_tokens (admin_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(adminId, tokenHash, expiresAt(REFRESH_TOKEN_TTL_DAYS));

  return raw;
}

/** Valida refresh token raw → retorna admin_id se válido, ou null */
export function verifyRefreshToken(raw: string): number | null {
  const db = getDb();
  const tokenHash = hashToken(raw);

  const row = db
    .prepare(`
      SELECT admin_id, expires_at
      FROM refresh_tokens
      WHERE token_hash = ?
    `)
    .get(tokenHash) as { admin_id: number; expires_at: string } | undefined;

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    // Expirado — limpa do banco
    db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
    return null;
  }

  return row.admin_id;
}

/** Invalida um refresh token (logout) */
export function revokeRefreshToken(raw: string): void {
  const db = getDb();
  const tokenHash = hashToken(raw);
  db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
}

/** Limpa todos os tokens expirados de um admin */
export function pruneExpiredTokens(adminId: number): void {
  const db = getDb();
  db.prepare(`
    DELETE FROM refresh_tokens
    WHERE admin_id = ? AND expires_at < datetime('now')
  `).run(adminId);
}

/** Busca admin por ID (para /me) */
export function getAdminById(
  adminId: number
): Omit<AdminRow, "password_hash"> | null {
  const db = getDb();
  const admin = db
    .prepare(
      "SELECT id, username, email, created_at FROM admin_users WHERE id = ?"
    )
    .get(adminId) as Omit<AdminRow, "password_hash"> | undefined;

  return admin ?? null;
}

/** TTL do access token (exportado para o JWT sign) */
export { ACCESS_TOKEN_TTL };
