import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { verifyJWT } from "../middleware/auth.middleware";
import {
  listTurmas,
  getTurmaById,
  createTurma,
  updateTurma,
  deleteTurma,
  enrollStudent,
  enrollStudentsBulk,
  enrollStudentsBySchool,
  enrollStudentsByProtocols,
  removeStudent,
  transferStudent,
  getUnassignedStudents,
  listSchoolsWithUnassigned,
} from "../services/turmas.service";

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

const createTurmaSchema = z.object({
  name: z.string().min(1).max(200),
  form_id: z.number().int().positive().nullable().optional(),
  school_name: z.string().max(200).nullable().optional(),
  responsavel: z.string().max(200).nullable().optional(),
  day_of_week: z.string().max(100).nullable().optional(),
  start_time: z.string().max(5).nullable().optional(),
  end_time: z.string().max(5).nullable().optional(),
  max_capacity: z.number().int().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
});

const updateTurmaSchema = createTurmaSchema.partial();

export async function turmasRoutes(app: FastifyInstance) {
  app.addHook("onRequest", verifyJWT);

  app.get(
    "/",
    async (request: FastifyRequest<{ Querystring: { formId?: string; isActive?: string } }>, reply) => {
      const formId = request.query.formId ? parseInt(request.query.formId, 10) : undefined;
      const isActive =
        request.query.isActive === undefined
          ? undefined
          : request.query.isActive === "true"
            ? true
            : request.query.isActive === "false"
              ? false
              : undefined;

      if (request.query.formId && (formId === undefined || isNaN(formId))) {
        return reply.status(400).send({ error: "Bad Request", message: "formId inválido." });
      }

      const turmas = listTurmas({ formId, isActive });
      return reply.send({ turmas });
    }
  );

  app.get(
    "/unassigned",
    async (request: FastifyRequest<{ Querystring: { formId?: string } }>, reply) => {
      const formId = request.query.formId ? parseInt(request.query.formId, 10) : undefined;
      if (request.query.formId && (formId === undefined || isNaN(formId))) {
        return reply.status(400).send({ error: "Bad Request", message: "formId inválido." });
      }

      const students = getUnassignedStudents(formId);
      return reply.send({ students });
    }
  );

  app.get(
    "/schools",
    async (request: FastifyRequest<{ Querystring: { formId?: string } }>, reply) => {
      const formId = request.query.formId ? parseInt(request.query.formId, 10) : undefined;
      if (request.query.formId && (formId === undefined || isNaN(formId))) {
        return reply.status(400).send({ error: "Bad Request", message: "formId inválido." });
      }

      const schools = listSchoolsWithUnassigned(formId);
      return reply.send({ schools });
    }
  );

  app.post("/", async (request: FastifyRequest, reply) => {
    const parsed = createTurmaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
    }

    const turma = createTurma(parsed.data);
    return reply.status(201).send({ turma });
  });

  app.get(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const turma = getTurmaById(id);
      if (!turma) return reply.status(404).send({ error: "Not Found", message: "Turma não encontrada." });

      return reply.send({ turma });
    }
  );

  app.put(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = updateTurmaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const turma = updateTurma(id, parsed.data);
      if (!turma) return reply.status(404).send({ error: "Not Found", message: "Turma não encontrada." });

      return reply.send({ turma });
    }
  );

  app.delete(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { force?: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const force = request.query.force === "true";
      const result = deleteTurma(id, force);

      if (!result.deleted && result.hasStudents) {
        return reply.status(409).send({
          error: "Conflict",
          message: "A turma possui alunos. Remova/realoque os alunos ou use force=true.",
        });
      }

      if (!result.deleted) {
        return reply.status(404).send({ error: "Not Found", message: "Turma não encontrada." });
      }

      return reply.send({ message: "Turma excluída com sucesso." });
    }
  );

  app.post(
    "/:id/enroll-bulk",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const turmaId = parseId(request.params.id);
      if (!turmaId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = z
        .object({ submissionIds: z.array(z.number().int().positive()).min(1).max(500) })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      try {
        const result = enrollStudentsBulk(turmaId, parsed.data.submissionIds);
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível alocar os alunos.";
        return reply.status(400).send({ error: "Bad Request", message });
      }
    }
  );

  app.post(
    "/:id/enroll-by-protocols",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const turmaId = parseId(request.params.id);
      if (!turmaId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = z
        .object({ protocols: z.array(z.string().min(1)).min(1).max(500) })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      try {
        const result = enrollStudentsByProtocols(turmaId, parsed.data.protocols);
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível alocar os alunos.";
        return reply.status(400).send({ error: "Bad Request", message });
      }
    }
  );

  app.post(
    "/:id/enroll-by-school",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const turmaId = parseId(request.params.id);
      if (!turmaId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = z
        .object({
          schoolName: z.string().min(1).max(200),
          formId: z.number().int().positive().optional(),
        })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      try {
        const result = enrollStudentsBySchool(turmaId, parsed.data.schoolName, parsed.data.formId);
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível alocar os alunos.";
        return reply.status(400).send({ error: "Bad Request", message });
      }
    }
  );

  app.post(
    "/:id/enroll",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const turmaId = parseId(request.params.id);
      if (!turmaId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = z
        .object({
          submissionId: z.number().int().positive(),
          notes: z.string().max(500).optional(),
        })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      try {
        enrollStudent(turmaId, parsed.data.submissionId, parsed.data.notes);
        return reply.send({ message: "Aluno alocado na turma com sucesso." });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível alocar o aluno.";
        return reply.status(400).send({ error: "Bad Request", message });
      }
    }
  );

  app.delete(
    "/:id/enroll/:submissionId",
    async (request: FastifyRequest<{ Params: { id: string; submissionId: string } }>, reply) => {
      const turmaId = parseId(request.params.id);
      const submissionId = parseId(request.params.submissionId);

      if (!turmaId || !submissionId) {
        return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });
      }

      const removed = removeStudent(turmaId, submissionId);
      if (!removed) {
        return reply.status(404).send({ error: "Not Found", message: "Aluno não está nesta turma." });
      }

      return reply.send({ message: "Aluno removido da turma." });
    }
  );

  app.post(
    "/:id/transfer",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const fromTurmaId = parseId(request.params.id);
      if (!fromTurmaId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = z
        .object({
          submissionId: z.number().int().positive(),
          toTurmaId: z.number().int().positive(),
          notes: z.string().max(500).optional(),
        })
        .safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      if (parsed.data.toTurmaId === fromTurmaId) {
        return reply.status(400).send({ error: "Bad Request", message: "Selecione uma turma de destino diferente." });
      }

      const existsInOrigin = removeStudent(fromTurmaId, parsed.data.submissionId);
      if (!existsInOrigin) {
        return reply.status(404).send({ error: "Not Found", message: "Aluno não está na turma de origem." });
      }

      try {
        transferStudent(parsed.data.submissionId, parsed.data.toTurmaId, parsed.data.notes);
        return reply.send({ message: "Aluno transferido com sucesso." });
      } catch (err) {
        // Reverte a remoção da origem caso a transferência falhe
        try {
          enrollStudent(fromTurmaId, parsed.data.submissionId);
        } catch {
          // noop
        }
        const message = err instanceof Error ? err.message : "Não foi possível transferir o aluno.";
        return reply.status(400).send({ error: "Bad Request", message });
      }
    }
  );
}
