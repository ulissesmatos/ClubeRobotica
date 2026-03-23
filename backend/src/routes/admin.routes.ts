import fs from "fs";
import path from "path";
import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { verifyJWT } from "../middleware/auth.middleware";
import {
  listForms,
  getFormById,
  createForm,
  createField,
  updateForm,
  updateField,
  reorderFields,
  reorderForms,
  deactivateForm,
  deleteForm,
  deleteField,
  ALLOWED_FIELD_TYPES,
  FormFieldRow,
} from "../services/forms.service";
import {
  listSubmissions,
  countSubmissionsByForm,
  getSubmissionById,
  updateSubmissionStatus,
  updateSubmissionData,
  updateSubmissionFile,
  deleteSubmission,
  resolveUploadPath,
  isAllowedMime,
  validateFileContent,
  saveUploadedFile,
  VALID_STATUSES,
  SubmissionStatus,
} from "../services/submissions.service";
import { getSettings, updateSettings } from "../services/settings.service";

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const createFormSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(1000).optional(),
  card_level: z.string().max(100).optional(),
  card_turno: z.string().max(100).optional(),
  card_subtitle: z.string().max(200).optional(),
});

const updateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  is_active: z.boolean().optional(),
  card_level: z.string().max(100).nullable().optional(),
  card_turno: z.string().max(100).nullable().optional(),
  card_subtitle: z.string().max(200).nullable().optional(),
});

const fieldSchema = z.object({
  type: z.enum(ALLOWED_FIELD_TYPES as unknown as [string, ...string[]]),
  label: z.string().min(1).max(200),
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "Somente letras minúsculas, números e _"),
  placeholder: z.string().max(200).optional(),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).optional(),
  order: z.number().int().min(0),
});

const updateFieldSchema = fieldSchema.partial();

const reorderFormsSchema = z.object({
  items: z.array(
    z.object({ id: z.number().int().positive(), display_order: z.number().int().min(0) })
  ).min(1),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({ id: z.number().int().positive(), order: z.number().int().min(0) })
  ).min(1),
});

// ─── Helper: parse de ID de rota ─────────────────────────────────────────────

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

// ─── Helper: formata campo para resposta ─────────────────────────────────────

function formatField(f: FormFieldRow) {
  return {
    ...f,
    required: f.required === 1,
    options: f.options_json ? (JSON.parse(f.options_json) as string[]) : null,
    options_json: undefined,
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", verifyJWT);

  // ══════════════════════════════════════════════════════════════════════════
  // FORMS
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/admin/forms — lista todos os formulários */
  app.get("/forms", async (_request, reply) => {
    const forms = listForms();
    return reply.status(200).send({ forms });
  });

  /** GET /api/admin/forms/:id — detalhe do formulário com campos */
  app.get(
    "/forms/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const form = getFormById(id);
      if (!form) return reply.status(404).send({ error: "Not Found", message: "Formulário não encontrado." });

      return reply.status(200).send({
        form: { ...form, fields: form.fields.map(formatField) },
      });
    }
  );

  /** POST /api/admin/forms — cria novo formulário */
  app.post("/forms", async (request: FastifyRequest, reply) => {
    const parsed = createFormSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
    }
    const form = createForm(parsed.data.title, parsed.data.description, {
      card_level: parsed.data.card_level,
      card_turno: parsed.data.card_turno,
      card_subtitle: parsed.data.card_subtitle,
    });
    return reply.status(201).send({ form });
  });

  /** PUT /api/admin/forms/reorder — reordena cards da landing page */
  app.put("/forms/reorder", async (request: FastifyRequest, reply) => {
    const parsed = reorderFormsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
    }
    reorderForms(parsed.data.items);
    return reply.status(200).send({ message: "Ordem atualizada com sucesso." });
  });

  /** PUT /api/admin/forms/:id — edita título/descrição/status */
  app.put(
    "/forms/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = updateFormSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const form = updateForm(id, parsed.data);
      if (!form) return reply.status(404).send({ error: "Not Found", message: "Formulário não encontrado." });

      return reply.status(200).send({ form });
    }
  );

  /** DELETE /api/admin/forms/:id — exclui formulário e dados associados */
  app.delete(
    "/forms/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const ok = deleteForm(id);
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Formulário não encontrado." });

      return reply.status(200).send({ message: "Formulário excluído com sucesso." });
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // FIELDS
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /api/admin/forms/:id/fields — adiciona campo */
  app.post(
    "/forms/:id/fields",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const formId = parseId(request.params.id);
      if (!formId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = fieldSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      try {
        const field = createField(formId, {
          ...parsed.data,
          type: parsed.data.type as (typeof ALLOWED_FIELD_TYPES)[number],
        });
        return reply.status(201).send({ field: formatField(field) });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao criar campo.";
        return reply.status(404).send({ error: "Not Found", message: msg });
      }
    }
  );

  /** PUT /api/admin/forms/:id/fields/:fieldId — edita campo */
  app.put(
    "/forms/:id/fields/:fieldId",
    async (
      request: FastifyRequest<{ Params: { id: string; fieldId: string } }>,
      reply
    ) => {
      const formId = parseId(request.params.id);
      const fieldId = parseId(request.params.fieldId);
      if (!formId || !fieldId) {
        return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });
      }

      const parsed = updateFieldSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const field = updateField(fieldId, formId, {
        ...parsed.data,
        type: parsed.data.type as (typeof ALLOWED_FIELD_TYPES)[number] | undefined,
      });
      if (!field) return reply.status(404).send({ error: "Not Found", message: "Campo não encontrado." });

      return reply.status(200).send({ field: formatField(field) });
    }
  );

  /** DELETE /api/admin/forms/:id/fields/:fieldId — remove campo */
  app.delete(
    "/forms/:id/fields/:fieldId",
    async (
      request: FastifyRequest<{ Params: { id: string; fieldId: string } }>,
      reply
    ) => {
      const formId = parseId(request.params.id);
      const fieldId = parseId(request.params.fieldId);
      if (!formId || !fieldId) {
        return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });
      }

      const ok = deleteField(fieldId, formId);
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Campo não encontrado." });

      return reply.status(200).send({ message: "Campo removido com sucesso." });
    }
  );

  /** PUT /api/admin/forms/:id/fields/reorder — reordena campos */
  app.put(
    "/forms/:id/fields/reorder",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const formId = parseId(request.params.id);
      if (!formId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = reorderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      reorderFields(formId, parsed.data.items);
      return reply.status(200).send({ message: "Campos reordenados com sucesso." });
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SUBMISSIONS
  // ══════════════════════════════════════════════════════════════════════════

  const listSubmissionsQuerySchema = z.object({
    formId:   z.coerce.number().int().positive().optional(),
    status:   z.enum(["pendente", "aprovado", "rejeitado"]).optional(),
    search:   z.string().max(200).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page:     z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });

  /** GET /api/admin/submissions/counts-by-form */
  app.get(
    "/submissions/counts-by-form",
    async (_request, reply) => {
      const counts = countSubmissionsByForm();
      return reply.send({ counts });
    }
  );

  /** GET /api/admin/submissions?formId=&status=&search=&page=&pageSize= */
  app.get(
    "/submissions",
    async (request: FastifyRequest<{ Querystring: Record<string, string> }>, reply) => {
      const parsed = listSubmissionsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }
      const result = listSubmissions({
        ...parsed.data,
        status: parsed.data.status as SubmissionStatus | undefined,
      });
      return reply.send(result);
    }
  );

  /** GET /api/admin/submissions/:id */
  app.get(
    "/submissions/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const submission = getSubmissionById(id);
      if (!submission) return reply.status(404).send({ error: "Not Found", message: "Submissão não encontrada." });

      return reply.send({ submission });
    }
  );

  const updateStatusSchema = z.object({
    status: z.enum(["pendente", "aprovado", "rejeitado"]),
  });

  /** PUT /api/admin/submissions/:id/status */
  app.put(
    "/submissions/:id/status",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = updateStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const ok = updateSubmissionStatus(id, parsed.data.status as SubmissionStatus);
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Submissão não encontrada." });

      return reply.send({ message: "Status atualizado com sucesso." });
    }
  );

  const updateSubmissionDataSchema = z.object({
    updates: z.array(
      z.object({
        id: z.number().int().positive(),
        value_text: z.string().max(10_000),
      })
    ).min(1).max(50),
  });

  /** PUT /api/admin/submissions/:id/data — edita dados de campos da inscrição */
  app.put(
    "/submissions/:id/data",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = updateSubmissionDataSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const ok = updateSubmissionData(id, parsed.data.updates);
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Submissão não encontrada." });

      return reply.send({ message: "Dados atualizados com sucesso." });
    }
  );

  /**
   * PUT /api/admin/submissions/:id/file
   * Substitui o arquivo de um campo file da submissão (multipart/form-data).
   * Espera: campo "dataRowId" (número) e campo file com o novo arquivo.
   */
  app.put(
    "/submissions/:id/file",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const submissionId = parseId(request.params.id);
      if (!submissionId) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      let dataRowId: number | null = null;
      let uploadedFile: { buffer: Buffer; mimetype: string } | null = null;

      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === "file") {
            const filePart = part as import("@fastify/multipart").MultipartFile;
            if (!isAllowedMime(filePart.mimetype)) {
              await filePart.toBuffer().catch(() => null);
              return reply.status(400).send({ error: "Bad Request", message: "Tipo de arquivo não permitido." });
            }
            const buffer = await filePart.toBuffer();
            if (!validateFileContent(buffer, filePart.mimetype)) {
              return reply.status(400).send({ error: "Bad Request", message: "Arquivo corrompido ou inválido." });
            }
            uploadedFile = { buffer, mimetype: filePart.mimetype };
          } else {
            if (part.fieldname === "dataRowId") {
              const val = (part as { value: string }).value;
              dataRowId = parseInt(val, 10);
            }
          }
        }
      } catch {
        return reply.status(400).send({ error: "Bad Request", message: "Erro ao processar o envio." });
      }

      if (!dataRowId || isNaN(dataRowId)) {
        return reply.status(400).send({ error: "Bad Request", message: "dataRowId é obrigatório." });
      }
      if (!uploadedFile) {
        return reply.status(400).send({ error: "Bad Request", message: "Nenhum arquivo enviado." });
      }

      const ok = updateSubmissionFile(submissionId, dataRowId, uploadedFile.buffer, uploadedFile.mimetype);
      if (!ok) {
        return reply.status(404).send({ error: "Not Found", message: "Campo de arquivo não encontrado." });
      }

      return reply.send({ message: "Arquivo atualizado com sucesso." });
    }
  );

  /** DELETE /api/admin/submissions/:id */
  app.delete(
    "/submissions/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const { deleted } = deleteSubmission(id);
      if (!deleted) return reply.status(404).send({ error: "Not Found", message: "Submissão não encontrada." });

      return reply.status(200).send({ message: "Submissão excluída com sucesso." });
    }
  );

  /**
   * GET /api/admin/uploads/:year/:month/:uuid/:filename
   * Serve o arquivo de upload com autenticação (somente admin logado).
   * O path completo é substituído por parâmetros para evitar path traversal.
   */
  app.get(
    "/uploads/:year/:month/:uuid/:filename",
    async (
      request: FastifyRequest<{
        Params: { year: string; month: string; uuid: string; filename: string };
      }>,
      reply
    ) => {
      const { year, month, uuid, filename } = request.params;

      // Valida cada segmento individualmente (sem confiar em sanitização posterior)
      if (!/^\d{4}$/.test(year)) return reply.status(400).send({ error: "Bad Request" });
      if (!/^\d{2}$/.test(month)) return reply.status(400).send({ error: "Bad Request" });
      if (!/^[0-9a-f-]{36}$/.test(uuid)) return reply.status(400).send({ error: "Bad Request" });
      if (!/^[\w.-]{1,100}$/.test(filename) || filename.includes("..")) {
        return reply.status(400).send({ error: "Bad Request" });
      }

      const relativePath = path.join(year, month, uuid, filename);
      const absolutePath = resolveUploadPath(relativePath);

      if (!fs.existsSync(absolutePath)) {
        return reply.status(404).send({ error: "Not Found", message: "Arquivo não encontrado." });
      }

      // Content-Type baseado na extensão (seguro pois validamos acima)
      const ext = path.extname(filename).toLowerCase();
      const mime: Record<string, string> = {
        ".pdf":  "application/pdf",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".webp": "image/webp",
        ".gif":  "image/gif",
        ".avif": "image/avif",
      };
      const contentType = mime[ext] ?? "application/octet-stream";

      const stream = fs.createReadStream(absolutePath);
      return reply
        .header("Content-Type", contentType)
        .header("Content-Disposition", `inline; filename="${filename}"`)
        .send(stream);
    }
  );

  // Mantido para compatibilidade com referências antigas no banco (:submissionId/:filename)
  // VALID_STATUSES exportado apenas para garantir que seja importado sem tree-shake warning
  void VALID_STATUSES;

  // ─── Settings ────────────────────────────────────────────────────────────────

  /** GET /api/admin/settings — retorna todas as configurações do site */
  app.get("/settings", async () => {
    return getSettings();
  });

  const settingsUpdateSchema = z.object({
    whatsapp_number:           z.string().max(20).optional(),
    whatsapp_message:          z.string().max(500).optional(),
    whatsapp_floating_enabled: z.enum(["0", "1"]).optional(),
    whatsapp_footer_enabled:   z.enum(["0", "1"]).optional(),
    instagram_handle:          z.string().max(100).optional(),
    instagram_enabled:         z.enum(["0", "1"]).optional(),
    phone_display:             z.string().max(30).optional(),
    phone_number:              z.string().max(20).optional(),
    phone_enabled:             z.enum(["0", "1"]).optional(),
  });

  /** PUT /api/admin/settings — atualiza configurações do site */
  app.put("/settings", async (request, reply) => {
    const result = settingsUpdateSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Dados inválidos.", details: result.error.flatten() });
    }
    updateSettings(result.data as Record<string, string>);
    return getSettings();
  });
}
