import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  verifyAdminCredentials,
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  pruneExpiredTokens,
  getAdminById,
  ACCESS_TOKEN_TTL,
} from "../services/auth.service";
import { verifyJWT } from "../middleware/auth.middleware";

// ─── Schemas de validação ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

// Nome do cookie httpOnly que transporta o refresh token
const REFRESH_COOKIE = "rt";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 60 * 60 * 24 * 7, // 7 dias em segundos
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.setCookie(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 0,
  });
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // Registra o plugin de cookie (necessário para httpOnly cookie)
  await app.register(import("@fastify/cookie"));

  /**
   * POST /api/auth/login
   * Rate limit rígido: 5 tentativas por IP em 15 minutos
   */
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            message:
              "Muitas tentativas de login. Tente novamente em 15 minutos.",
          }),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Valida body
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: parsed.error.errors[0].message,
        });
      }

      const { email, password } = parsed.data;
      const admin = verifyAdminCredentials(email, password);

      if (!admin) {
        // Log de segurança — não loga a senha, nunca
        request.log.warn({ ip: request.ip, email }, "Admin login failed");
        // Resposta genérica — não revela se e-mail existe ou não
        return reply.status(401).send({
          error: "Unauthorized",
          message: "E-mail ou senha inválidos.",
        });
      }

      // Limpa tokens expirados do admin antes de criar novo
      pruneExpiredTokens(admin.id);

      // Gera tokens
      const accessToken = app.jwt.sign(
        { adminId: admin.id, email: admin.email },
        { expiresIn: ACCESS_TOKEN_TTL }
      );
      const refreshTokenRaw = createRefreshToken(admin.id);

      // Refresh token vai em httpOnly cookie; access token no body
      setRefreshCookie(reply, refreshTokenRaw);

      request.log.warn({ ip: request.ip, adminId: admin.id }, "Admin login success");

      return reply.status(200).send({
        accessToken,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
        },
      });
    }
  );

  /**
   * POST /api/auth/refresh
   * Lê o refresh token do cookie httpOnly e emite novo access token
   */
  app.post("/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    const raw = (request.cookies as Record<string, string>)[REFRESH_COOKIE];

    if (!raw) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Refresh token ausente.",
      });
    }

    const adminId = verifyRefreshToken(raw);
    if (!adminId) {
      clearRefreshCookie(reply);
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Refresh token inválido ou expirado. Faça login novamente.",
      });
    }

    const admin = getAdminById(adminId);
    if (!admin) {
      clearRefreshCookie(reply);
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Usuário não encontrado.",
      });
    }

    const accessToken = app.jwt.sign(
      { adminId: admin.id, email: admin.email },
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    return reply.status(200).send({ accessToken });
  });

  /**
   * POST /api/auth/logout
   * Invalida o refresh token no banco e limpa o cookie
   */
  app.post(
    "/logout",
    { onRequest: [verifyJWT] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const raw = (request.cookies as Record<string, string>)[REFRESH_COOKIE];
      if (raw) revokeRefreshToken(raw);
      clearRefreshCookie(reply);
      const payload = request.user as { adminId: number };
      request.log.warn({ ip: request.ip, adminId: payload?.adminId }, "Admin logout");
      return reply.status(200).send({ message: "Logout realizado com sucesso." });
    }
  );

  /**
   * GET /api/auth/me
   * Retorna dados do admin autenticado
   */
  app.get(
    "/me",
    { onRequest: [verifyJWT] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = request.user as { adminId: number; email: string };
      const admin = getAdminById(payload.adminId);

      if (!admin) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Admin não encontrado.",
        });
      }

      return reply.status(200).send({ admin });
    }
  );
}

