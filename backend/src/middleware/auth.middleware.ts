import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Hook de autenticação JWT para rotas protegidas.
 * Verifica o header Authorization: Bearer <token>
 */
export async function verifyJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Token inválido ou expirado. Faça login novamente.",
    });
  }
}
