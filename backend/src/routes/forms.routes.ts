import { FastifyInstance, FastifyRequest } from "fastify";
import { getFormById } from "../services/forms.service";

export async function formsRoutes(app: FastifyInstance) {
  /**
   * GET /api/forms/:id
   * Rota pública — usada pelo frontend para renderizar o formulário.
   * Só retorna formulários ativos.
   */
  app.get(
    "/forms/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });
      }

      const form = getFormById(id);

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
          description: form.description,
          fields,
        },
      });
    }
  );
}
