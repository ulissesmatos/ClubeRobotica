import { FastifyInstance, FastifyRequest } from "fastify";
import { getFormById, getFormBySlug, listActiveForms } from "../services/forms.service";

export async function formsRoutes(app: FastifyInstance) {
  /**
   * GET /api/forms
   * Rota pública — retorna lista de formulários ativos (para TurmasSection).
   */
  app.get("/forms", async (_request, reply) => {
    const forms = listActiveForms();
    return reply.status(200).send({ forms });
  });

  /**
   * GET /api/forms/:ref
   * Rota pública — aceita ID numérico OU slug de 6 chars hex.
   * Só retorna formulários ativos.
   */
  app.get(
    "/forms/:ref",
    async (request: FastifyRequest<{ Params: { ref: string } }>, reply) => {
      const { ref } = request.params;

      const form = /^\d+$/.test(ref)
        ? getFormById(Number(ref))
        : getFormBySlug(ref);

      if (!form) {
        return reply.status(404).send({ error: "Not Found", message: "Formulário não encontrado." });
      }

      if (!form.is_active) {
        return reply.status(404).send({ error: "Not Found", message: "Este formulário não está disponível." });
      }

      // Parse options_json para array antes de retornar
      const fields = form.fields.map((f) => ({
        ...f,
        options: f.options_json ? (JSON.parse(f.options_json) as string[]) : null,
        options_json: undefined,
        required: f.required === 1,
      }));

      return reply.status(200).send({
        form: {
          id: form.id,
          title: form.title,
          slug: form.slug,
          description: form.description,
          fields,
        },
      });
    }
  );
}
