import { getDb } from "../db/database";

export interface SiteSettings {
  whatsapp_number: string;
  whatsapp_message: string;
  whatsapp_floating_enabled: string;
  whatsapp_footer_enabled: string;
  instagram_handle: string;
  instagram_enabled: string;
  phone_display: string;
  phone_number: string;
  phone_enabled: string;
  enrollments_status: string;
  enrollments_date_start: string;
  enrollments_date_end: string;
}

const ALLOWED_KEYS = new Set<string>([
  "whatsapp_number",
  "whatsapp_message",
  "whatsapp_floating_enabled",
  "whatsapp_footer_enabled",
  "instagram_handle",
  "instagram_enabled",
  "phone_display",
  "phone_number",
  "phone_enabled",
  "enrollments_status",
  "enrollments_date_start",
  "enrollments_date_end",
]);

export function getSettings(): SiteSettings {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM settings")
    .all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map as unknown as SiteSettings;
}

export function updateSettings(updates: Partial<Record<string, string>>): void {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_KEYS.has(key) && value !== undefined) {
      stmt.run(key, String(value));
    }
  }
}
