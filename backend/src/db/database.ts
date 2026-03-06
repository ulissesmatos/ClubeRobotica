// Usa o módulo SQLite nativo do Node.js 22+ (sem dependências nativas/compilação)
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH ?? path.resolve("data", "db.sqlite");

// Garante que o diretório do banco existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Singleton — conexão reutilizada em toda a aplicação
let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    // Habilita WAL para melhor performance de leitura concorrente
    _db.exec("PRAGMA journal_mode = WAL");
    // Habilita foreign keys
    _db.exec("PRAGMA foreign_keys = ON");
  }
  return _db;
}
