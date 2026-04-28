import "dotenv/config";
import Fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import path from "path";
import fs from "fs";
import { authRoutes } from "./routes/auth.routes";
import { formsRoutes } from "./routes/forms.routes";
import { submissionsRoutes } from "./routes/submissions.routes";
import { adminRoutes } from "./routes/admin.routes";
import { schoolsRoutes } from "./routes/schools.routes";
import { turmasRoutes } from "./routes/turmas.routes";
import { publicRoutes } from "./routes/public.routes";
import { runMigrations } from "./db/migrate";
import { seedPublicResults } from "./db/seed_public_results";

// ─── Env validation ──────────────────────────────────────────────────────────
const {
  PORT = "3001",
  NODE_ENV = "development",
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  CORS_ORIGIN = "http://localhost:5173",
  UPLOAD_DIR = "/uploads",
} = process.env;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.error(
    "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment."
  );
  process.exit(1);
}

// Após a guarda acima, TypeScript ainda vê string | undefined — assertamos
const JWT_SECRET_SAFE = JWT_SECRET as string;
const JWT_REFRESH_SECRET_SAFE = JWT_REFRESH_SECRET as string;

// ─── App factory ─────────────────────────────────────────────────────────────
const app = Fastify({
  // Trust proxy headers (X-Forwarded-For / X-Real-IP) so rate limiting
  // and logging use the real client IP instead of the nginx container IP.
  trustProxy: true,
  // Logging always enabled; structured JSON in production, human-readable in dev.
  // Level "warn" in production silences noisy per-request lines while keeping
  // security events (logged at "warn" / "error" level) visible.
  logger: {
    level: NODE_ENV === "production" ? "warn" : "info",
  },
});

async function bootstrap() {
  // Garante que os diretórios de dados e uploads existam
  const uploadDir = path.resolve(UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  // Run DB migrations on startup
  runMigrations();
  seedPublicResults();

  // Backfill nome_normalizado for any public_results rows that were inserted
  // before the column existed or before the seed computed it properly.
  {
    const { getDb } = await import("./db/database");
    const { normalizeStr } = await import("./services/results-matching.service");
    const db = getDb();
    const stale = db.prepare(
      `SELECT id, nome_completo FROM public_results WHERE nome_normalizado = '' OR nome_normalizado IS NULL`
    ).all() as { id: number; nome_completo: string }[];
    if (stale.length > 0) {
      const upd = db.prepare(`UPDATE public_results SET nome_normalizado = ? WHERE id = ?`);
      db.exec("BEGIN");
      try {
        for (const row of stale) upd.run(normalizeStr(row.nome_completo), row.id);
        db.exec("COMMIT");
        console.log(`✅ Backfill nome_normalizado: ${stale.length} entradas atualizadas.`);
      } catch (err) {
        db.exec("ROLLBACK");
        console.error("❌ Erro ao backfill nome_normalizado:", err);
      }
    }
  }

  // ── Security headers ──
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: "same-site" },
  });

  // ── CORS ──
  await app.register(cors, {
    origin: NODE_ENV === "production" ? CORS_ORIGIN : true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // ── Compression ──
  await app.register(compress, { global: true });

  // ── Rate limiting (global default) ──
  await app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Muitas requisições. Tente novamente em instantes.",
    }),
  });

  // ── Multipart (file uploads) ──
  const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB ?? "100", 10);
  await app.register(multipart, {
    limits: {
      fileSize: maxFileSizeMB * 1024 * 1024,
      files: 1,
    },
  });

  // ── JWT ──
  await app.register(jwt, {
    secret: JWT_SECRET_SAFE,
  });

  // Uploads são servidos via rota autenticada em admin.routes.ts
  // (GET /api/admin/uploads/:year/:month/:uuid/:filename)

  // ── Health check ──
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // ── Routes ──
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(formsRoutes, { prefix: "/api" });
  await app.register(submissionsRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(schoolsRoutes, { prefix: "/api/admin/schools" });
  await app.register(turmasRoutes, { prefix: "/api/admin/turmas" });
  await app.register(publicRoutes, { prefix: "/api/public" });

  // ── Global error handler ──
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: "Too Many Requests",
        message: error.message,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: "Validation Error",
        message: "Dados inválidos na requisição.",
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : error.message,
      message:
        statusCode === 500
          ? "Ocorreu um erro interno. Tente novamente."
          : error.message,
    });
  });

  // ── Start ──
  const port = parseInt(PORT, 10);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`🚀 Backend rodando em http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
