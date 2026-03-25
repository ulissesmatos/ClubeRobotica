import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { verifyJWT } from "../middleware/auth.middleware";
import {
  listRawSchoolNames,
  listSchoolGroups,
  createSchoolGroup,
  updateSchoolGroup,
  removeAlias,
  deleteSchoolGroup,
} from "../services/schools.service";

const createGroupSchema = z.object({
  canonical_name: z.string().min(1).max(300),
  aliases: z.array(z.string().min(1).max(300)).optional().default([]),
});

const updateGroupSchema = z.object({
  canonical_name: z.string().min(1).max(300).optional(),
  add_aliases: z.array(z.string().min(1).max(300)).optional().default([]),
});

const removeAliasSchema = z.object({
  raw_name: z.string().min(1).max(300),
});

export async function schoolsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", verifyJWT);

  /** GET /api/admin/schools/raw — nomes únicos de escola nas submissões */
  app.get("/raw", async (_req, reply) => {
    return reply.status(200).send({ names: listRawSchoolNames() });
  });

  /** GET /api/admin/schools/groups — grupos salvos */
  app.get("/groups", async (_req, reply) => {
    return reply.status(200).send({ groups: listSchoolGroups() });
  });

  /** POST /api/admin/schools/groups — criar grupo */
  app.post("/groups", async (req: FastifyRequest, reply) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
    }
    const group = createSchoolGroup(parsed.data.canonical_name, parsed.data.aliases);
    return reply.status(201).send({ group });
  });

  /** PUT /api/admin/schools/groups/:id — renomear / adicionar aliases */
  app.put(
    "/groups/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = updateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const group = updateSchoolGroup(groupId, parsed.data.canonical_name, parsed.data.add_aliases ?? []);
      if (!group) return reply.status(404).send({ error: "Not Found", message: "Grupo não encontrado." });

      return reply.status(200).send({ group });
    }
  );

  /** DELETE /api/admin/schools/groups/:id — excluir grupo */
  app.delete(
    "/groups/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const ok = deleteSchoolGroup(groupId);
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Grupo não encontrado." });

      return reply.status(200).send({ message: "Grupo excluído com sucesso." });
    }
  );

  /** DELETE /api/admin/schools/aliases — remover alias específico */
  app.delete("/aliases", async (req: FastifyRequest, reply) => {
    const parsed = removeAliasSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
    }

    const ok = removeAlias(parsed.data.raw_name);
    if (!ok) return reply.status(404).send({ error: "Not Found", message: "Alias não encontrado." });

    return reply.status(200).send({ message: "Alias removido." });
  });
}
