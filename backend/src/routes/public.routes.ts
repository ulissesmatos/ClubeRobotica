import { FastifyInstance, FastifyRequest } from "fastify";
import { searchPublicResults } from "../services/public.service";

export async function publicRoutes(app: FastifyInstance) {
  /**
   * GET /api/public/resultado?q=<busca>
   *
   * Busca pública de resultados do Clube de Robótica.
   * Aceita: nome do aluno, número de protocolo, ou CPF (apenas dígitos exibidos).
   * Retorna apenas campos não-sensíveis.
   */
  app.get(
    "/resultado",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (
      request: FastifyRequest<{ Querystring: { q?: string } }>,
      reply
    ) => {
      const q = (request.query.q ?? "").trim();

      if (q.length < 3) {
        return reply.send({ results: [], message: "Digite pelo menos 3 caracteres para buscar." });
      }

      if (q.length > 200) {
        return reply.status(400).send({ error: "Bad Request", message: "Busca muito longa." });
      }

      const results = searchPublicResults(q);
      return reply.send({ results });
    }
  );
}
