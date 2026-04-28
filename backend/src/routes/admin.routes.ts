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
  moveSubmissionToForm,
  resolveShiftConflicts,
  updateSubmissionData,
  updateSubmissionFile,
  deleteSubmission,
  resolveUploadPath,
  isAllowedMime,
  validateFileContent,
  saveUploadedFile,
  getSubmissionsExportData,
  VALID_STATUSES,
  SubmissionStatus,
} from "../services/submissions.service";
import { getSettings, updateSettings } from "../services/settings.service";
import { getDb, DB_PATH, closeDb } from "../db/database";
import {
  getResultsWithCandidates,
  getDuplicates,
  getMissing,
  getUnmatched,
  autoLinkAll,
  bulkApproveFromPdf,
  normalizeStr,
  type MatchStatus,
} from "../services/results-matching.service";

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

// ─── Schemas Resultados ────────────────────────────────────────────────────────

const linkResultadoSchema = z.object({
  submissionId: z.number().int().positive(),
});

const addResultadoSchema = z.object({
  nome_completo: z.string().min(1).max(300),
  escola: z.string().min(1).max(300),
  resultado: z.enum(["aprovado", "cadastro_reserva"]),
});

const updateResultadoSchema = z.object({
  nome_completo: z.string().min(1).max(300).optional(),
  escola: z.string().min(1).max(300).optional(),
  resultado: z.enum(["aprovado", "cadastro_reserva"]).optional(),
  match_status: z.enum(["pending", "confirmed", "rejected", "manual"]).optional(),
});

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
    formId:        z.coerce.number().int().positive().optional(),
    status:        z.enum(["pendente", "aprovado", "rejeitado", "reserva"]).optional(),
    search:        z.string().max(200).optional(),
    dateFrom:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    schoolGroupId: z.coerce.number().int().positive().optional(),
    shiftConflict: z.coerce.boolean().optional(),
    page:          z.coerce.number().int().positive().default(1),
    pageSize:      z.coerce.number().int().min(1).max(100).default(20),
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
        shiftConflict: parsed.data.shiftConflict,
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
    status: z.enum(["pendente", "aprovado", "rejeitado", "reserva"]),
    rejection_reason: z.string().max(1000).optional(),
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

      if (parsed.data.status === "rejeitado" && !parsed.data.rejection_reason?.trim()) {
        return reply.status(400).send({
          error: "Validation Error",
          message: "Motivo do indeferimento é obrigatório.",
        });
      }

      const ok = updateSubmissionStatus(
        id,
        parsed.data.status as SubmissionStatus,
        request.user.adminId,
        parsed.data.rejection_reason
      );
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Submissão não encontrada." });

      return reply.send({ message: "Status atualizado com sucesso." });
    }
  );

  /** PUT /api/admin/submissions/:id/form — move para outro formulário */
  app.put(
    "/submissions/:id/form",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });

      const parsed = z.object({ formId: z.number().int().positive() }).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", message: parsed.error.errors[0].message });
      }

      const ok = moveSubmissionToForm(id, parsed.data.formId);
      if (!ok) return reply.status(404).send({ error: "Not Found", message: "Inscrição ou formulário não encontrado." });

      return reply.send({ message: "Inscrição movida com sucesso." });
    }
  );

  /** POST /api/admin/submissions/resolve-conflicts
   *  dryRun=true  → retorna preview sem alterar dados
   *  dryRun=false → executa a movimentacão em massa
   */
  app.post(
    "/submissions/resolve-conflicts",
    async (request: FastifyRequest<{ Querystring: { dryRun?: string } }>, reply) => {
      const dryRun = (request.query as { dryRun?: string }).dryRun !== "false";
      const result = resolveShiftConflicts(dryRun);
      return reply.send({ ...result, dryRun });
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

  // ─── Export Excel ─────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/submissions/export[?formId=N]
   * Gera e retorna um arquivo .xlsx com todas as inscrições (ou só de um formulário).
   * Cada formulário vira uma aba separada na planilha.
   */
  app.get(
    "/submissions/export",
    async (request: FastifyRequest<{ Querystring: { formId?: string } }>, reply) => {
      const XLSX = await import("xlsx");

      const formId = request.query.formId ? parseInt(request.query.formId, 10) : undefined;
      if (formId !== undefined && isNaN(formId)) {
        return reply.status(400).send({ error: "Bad Request", message: "formId inválido." });
      }

      const proto = request.headers["x-forwarded-proto"] ?? request.protocol;
      const host = request.headers["x-forwarded-host"] ?? request.hostname;
      const baseUrl = `${proto}://${host}`;

      const sheets = getSubmissionsExportData(formId, baseUrl);

      const wb = XLSX.utils.book_new();

      if (sheets.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["Nenhuma inscrição encontrada."]]);
        XLSX.utils.book_append_sheet(wb, ws, "Inscrições");
      } else {
        for (const { sheetName, headers, rows } of sheets) {
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          // Largura automática das colunas baseada no conteúdo
          const colWidths = headers.map((h, i) => ({
            wch: Math.max(
              h.length,
              ...rows.map((r) => (r[i] ?? "").length),
              10
            ),
          }));
          ws["!cols"] = colWidths;
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      }

      const buffer = Buffer.from(
        XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array
      );
      const date = new Date().toISOString().split("T")[0];
      const filename = `inscricoes_${date}.xlsx`;

      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    }
  );

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
    enrollments_status:        z.enum(["open", "extended", "closed"]).optional(),
    enrollments_date_start:    z.string().max(10).optional(),
    enrollments_date_end:      z.string().max(10).optional(),
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

  // ─── Backup completo (DB + uploads) ───────────────────────────────────────────

  /**
   * GET /api/admin/backup
   * Cria um arquivo ZIP contendo:
   *   - db.sqlite  → cópia atômica via VACUUM INTO
   *   - uploads/   → todos os arquivos enviados (PDFs, imagens)
   * Gera o ZIP em temp primeiro para poder enviar Content-Length (barra de progresso).
   */
  app.get(
    "/backup",
    { config: { rateLimit: { max: 2, timeWindow: "1 minute" } } },
    async (_request, reply) => {
      const os = await import("os");
      const archiver = (await import("archiver")).default;

      const ts = Date.now();
      const backupDbPath = path.join(os.tmpdir(), `backup_db_${ts}.sqlite`);
      const backupZipPath = path.join(os.tmpdir(), `backup_${ts}.zip`);
      const uploadDir = process.env.UPLOAD_DIR ?? "/uploads";

      try {
        // 1. Backup atômico do banco via VACUUM INTO
        const db = getDb();
        db.exec(`VACUUM INTO '${backupDbPath.replace(/'/g, "''")}'`);

        const dbStat = fs.statSync(backupDbPath);
        if (dbStat.size === 0) throw new Error("Backup do banco gerou arquivo vazio.");

        // 2. Cria ZIP em arquivo temporário (para saber o tamanho exato)
        const archive = archiver("zip", { zlib: { level: 5 } });
        const zipWriteStream = fs.createWriteStream(backupZipPath);

        archive.on("error", (err: Error) => { throw err; });

        archive.file(backupDbPath, { name: "db.sqlite" });
        if (fs.existsSync(uploadDir)) {
          archive.directory(uploadDir, "uploads");
        }

        archive.pipe(zipWriteStream);
        await archive.finalize();
        // Espera o stream de escrita terminar
        await new Promise<void>((resolve, reject) => {
          zipWriteStream.on("close", resolve);
          zipWriteStream.on("error", reject);
        });

        // 3. Lê o tamanho real do ZIP e envia com Content-Length
        const zipStat = fs.statSync(backupZipPath);
        const date = new Date().toISOString().replace(/[:.]/g, "-").split("T");
        const filename = `backup_${date[0]}_${date[1].substring(0, 8)}.zip`;

        const stream = fs.createReadStream(backupZipPath);
        stream.on("close", () => {
          fs.unlink(backupDbPath, () => {});
          fs.unlink(backupZipPath, () => {});
        });

        return reply
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .header("Content-Length", zipStat.size)
          .send(stream);
      } catch (err) {
        for (const f of [backupDbPath, backupZipPath]) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
        const message = err instanceof Error ? err.message : "Erro desconhecido ao criar backup.";
        return reply.status(500).send({ error: "Backup falhou", message });
      }
    }
  );

  // ─── Restauração de backup (DB + uploads) ────────────────────────────────────

  /**
   * POST /api/admin/restore
   * Recebe um arquivo ZIP (gerado pelo endpoint de backup) e restaura:
   *   - db.sqlite  → substitui o banco atual (com backup do antigo em .bak)
   *   - uploads/   → substitui a pasta de uploads (com backup da antiga em .bak)
   */
  app.post("/restore", async (request, reply) => {
    const os = await import("os");
    const unzipper = await import("unzipper");
    const { pipeline } = await import("stream/promises");

    const uploadDir = process.env.UPLOAD_DIR ?? "/uploads";

    // Recebe o arquivo com limite estendido (backups podem ter > 100MB)
    const file = await request.file({ limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB
    if (!file) {
      return reply.status(400).send({ error: "Nenhum arquivo enviado." });
    }

    const isSqlite = file.filename.endsWith(".sqlite") || file.filename.endsWith(".db");
    const isZip = file.filename.endsWith(".zip");

    if (!isZip && !isSqlite) {
      return reply.status(400).send({ error: "O arquivo deve ser um .zip (backup completo) ou um .sqlite (somente banco de dados)." });
    }

    const ts = Date.now();
    const tmpFile = path.join(os.tmpdir(), `restore_${ts}${isZip ? ".zip" : ".sqlite"}`);
    const tmpExtract = path.join(os.tmpdir(), `restore_${ts}`);

    try {
      // 1. Stream direto para disco (evita carregar tudo em memória)
      await pipeline(file.file, fs.createWriteStream(tmpFile));
      const size = fs.statSync(tmpFile).size;
      console.log(`[restore] arquivo salvo: ${tmpFile} (${size} bytes)`);

      let extractedDbPath: string;

      if (isSqlite) {
        extractedDbPath = tmpFile;
      } else {
        // 2. Extrai com unzipper.Open.file (lê o diretório central do ZIP no final do arquivo)
        fs.mkdirSync(tmpExtract, { recursive: true });
        const directory = await unzipper.Open.file(tmpFile);
        await directory.extract({ path: tmpExtract });
        extractedDbPath = path.join(tmpExtract, "db.sqlite");
      }

      // 3. Valida conteúdo — deve existir e ser um banco SQLite
      if (!fs.existsSync(extractedDbPath)) {
        return reply.status(400).send({
          error: "ZIP inválido: arquivo db.sqlite não encontrado.",
        });
      }

      // Valida que o arquivo é um banco SQLite real (magic bytes)
      const header = Buffer.alloc(16);
      const fd = fs.openSync(extractedDbPath, "r");
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      if (header.toString("utf8", 0, 15) !== "SQLite format 3") {
        return reply.status(400).send({
          error: "Arquivo inválido: não é um banco SQLite válido.",
        });
      }

      const timestamp = Date.now();

      // 4. Fecha a conexão atual com o banco
      closeDb();

      // 5. Faz backup do banco atual → .bak (segurança)
      const dbBak = `${DB_PATH}.${timestamp}.bak`;
      if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, dbBak);
      // Remove WAL e SHM do banco antigo (serão recriados)
      for (const ext of ["-wal", "-shm"]) {
        const f = DB_PATH + ext;
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }

      // 6. Substitui o banco
      fs.copyFileSync(extractedDbPath, DB_PATH);

      // 7. Restaura uploads (se existirem no ZIP)
      const extractedUploads = path.join(tmpExtract, "uploads");
      if (fs.existsSync(extractedUploads)) {
        // Backup da pasta de uploads atual em /tmp
        const uploadsBak = path.join(os.tmpdir(), `uploads_bak_${timestamp}`);
        if (fs.existsSync(uploadDir)) {
          fs.cpSync(uploadDir, uploadsBak, { recursive: true });
          // Limpa o CONTEÚDO do diretório sem removê-lo
          // (rmSync no ponto de montagem Docker falha com EACCES)
          for (const entry of fs.readdirSync(uploadDir)) {
            fs.rmSync(path.join(uploadDir, entry), { recursive: true, force: true });
          }
        }
        // Copia uploads do backup
        fs.cpSync(extractedUploads, uploadDir, { recursive: true });
      }

      // 8. Reabre a conexão com o novo banco
      getDb();

      return { success: true, message: "Backup restaurado com sucesso." };
    } catch (err) {
      // Tenta reabrir o banco mesmo em caso de erro
      try { getDb(); } catch { /* ignore */ }
      console.error("[restore] ERRO:", err);
      const message = err instanceof Error ? err.message : "Erro desconhecido ao restaurar.";
      const stack = err instanceof Error ? err.stack : undefined;
      return reply.status(500).send({ error: "Restauração falhou", message, stack });
    } finally {
      // Limpa arquivos temporários
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      if (fs.existsSync(tmpExtract)) fs.rmSync(tmpExtract, { recursive: true, force: true });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RESULTADOS PDF — matching / vinculação
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/admin/resultados — todos os resultados com candidatos, duplicatas e ausentes */
  app.get("/resultados", async (request, reply) => {
    const q = request.query as {
      escola?: string;
      match_status?: string;
      resultado?: string;
    };
    const validStatuses: MatchStatus[] = ["pending", "confirmed", "rejected", "manual"];
    const match_status = validStatuses.includes(q.match_status as MatchStatus)
      ? (q.match_status as MatchStatus)
      : undefined;
    const resultado =
      q.resultado === "aprovado" || q.resultado === "cadastro_reserva"
        ? q.resultado
        : undefined;

    const results = getResultsWithCandidates({
      escola: q.escola || undefined,
      match_status: match_status || "",
      resultado,
    });
    const duplicates = getDuplicates();
    const missing = getMissing();
    const unmatched = getUnmatched();
    return reply.send({ results, duplicates, missing, unmatched });
  });

  /** POST /api/admin/resultados/:id/link — confirmar vinculação */
  app.post<{ Params: { id: string } }>(
    "/resultados/:id/link",
    async (request, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "ID inválido" });

      const parsed = linkResultadoSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const db = getDb();
      const exists = db.prepare("SELECT id FROM public_results WHERE id = ?").get(id) as { id: number } | undefined;
      if (!exists) return reply.status(404).send({ error: "Resultado não encontrado" });

      db.prepare(`
        UPDATE public_results
        SET submission_id = ?, match_status = 'confirmed'
        WHERE id = ?
      `).run(parsed.data.submissionId, id);

      return reply.send({ ok: true });
    }
  );

  /** DELETE /api/admin/resultados/:id/link — remover vinculação */
  app.delete<{ Params: { id: string } }>(
    "/resultados/:id/link",
    async (request, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "ID inválido" });

      const db = getDb();
      const exists = db.prepare("SELECT id FROM public_results WHERE id = ?").get(id) as { id: number } | undefined;
      if (!exists) return reply.status(404).send({ error: "Resultado não encontrado" });

      db.prepare(`
        UPDATE public_results
        SET submission_id = NULL, match_status = 'rejected'
        WHERE id = ?
      `).run(id);

      return reply.send({ ok: true });
    }
  );

  /** POST /api/admin/resultados/bulk-approve — defere em massa as inscrições vinculadas como aprovado no PDF */
  app.post("/resultados/bulk-approve", async (request, reply) => {
    const result = bulkApproveFromPdf(request.user?.adminId ?? null);
    return reply.send(result);
  });

  /** POST /api/admin/resultados/auto-link — vincula em massa pelo melhor score */
  app.post("/resultados/auto-link", async (request, reply) => {
    const body = (request.body ?? {}) as { minScore?: number };
    const minScore = typeof body.minScore === "number" ? Math.min(Math.max(body.minScore, 50), 100) : 80;
    const result = autoLinkAll(minScore);
    return reply.send(result);
  });

  /** DELETE /api/admin/resultados/:id — remover entrada do PDF */
  app.delete<{ Params: { id: string } }>(
    "/resultados/:id",
    async (request, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "ID inválido" });

      const db = getDb();
      const exists = db.prepare("SELECT id FROM public_results WHERE id = ?").get(id) as { id: number } | undefined;
      if (!exists) return reply.status(404).send({ error: "Resultado não encontrado" });

      db.prepare("DELETE FROM public_results WHERE id = ?").run(id);
      return reply.send({ ok: true });
    }
  );

  /** POST /api/admin/resultados — adicionar nova entrada manualmente */
  app.post("/resultados", async (request, reply) => {
    const parsed = addResultadoSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const db = getDb();
    const { nome_completo, escola, resultado } = parsed.data;
    const nome_normalizado = normalizeStr(nome_completo);

    const row = db.prepare(`
      INSERT INTO public_results (nome_completo, nome_normalizado, escola, resultado, match_status)
      VALUES (?, ?, ?, ?, 'manual')
      RETURNING *
    `).get(nome_completo, nome_normalizado, escola, resultado) as Record<string, unknown>;

    return reply.status(201).send({ result: row });
  });

  /** PUT /api/admin/resultados/:id — editar entrada */
  app.put<{ Params: { id: string } }>(
    "/resultados/:id",
    async (request, reply) => {
      const id = parseId(request.params.id);
      if (!id) return reply.status(400).send({ error: "ID inválido" });

      const parsed = updateResultadoSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const db = getDb();
      const existing = db.prepare("SELECT * FROM public_results WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      if (!existing) return reply.status(404).send({ error: "Resultado não encontrado" });

      const fields = parsed.data;
      const setClauses: string[] = [];
      const values: unknown[] = [];

      if (fields.nome_completo !== undefined) {
        setClauses.push("nome_completo = ?", "nome_normalizado = ?");
        values.push(fields.nome_completo, normalizeStr(fields.nome_completo));
      }
      if (fields.escola !== undefined) { setClauses.push("escola = ?"); values.push(fields.escola); }
      if (fields.resultado !== undefined) { setClauses.push("resultado = ?"); values.push(fields.resultado); }
      if (fields.match_status !== undefined) { setClauses.push("match_status = ?"); values.push(fields.match_status); }

      if (setClauses.length === 0) return reply.status(400).send({ error: "Nenhum campo para atualizar" });

      values.push(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.prepare(`UPDATE public_results SET ${setClauses.join(", ")} WHERE id = ?`).run(...(values as any[]));

      const updated = db.prepare("SELECT * FROM public_results WHERE id = ?").get(id) as Record<string, unknown>;
      return reply.send({ result: updated });
    }
  );
}
