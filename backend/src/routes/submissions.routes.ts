import { FastifyInstance, FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { getFormById } from "../services/forms.service";
import {
  createSubmission,
  saveUploadedFile,
  isAllowedMime,
  hasDuplicateCpf,
  SubmissionField,
} from "../services/submissions.service";

// Limite de rate para submissões: 3 por IP por hora
const SUBMIT_RATE_LIMIT = { max: 3, timeWindow: "1 hour" };

export async function submissionsRoutes(app: FastifyInstance) {
  /**
   * POST /api/forms/:id/submit
   * Recebe multipart/form-data com todos os campos + arquivo.
   * Rate limit: 3 submissões por IP por hora.
   */
  app.post(
    "/forms/:id/submit",
    { config: { rateLimit: SUBMIT_RATE_LIMIT } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const formId = parseInt(request.params.id, 10);
      if (isNaN(formId)) {
        return reply.status(400).send({ error: "Bad Request", message: "ID inválido." });
      }

      // Carrega o formulário para saber quais campos existem e quais são obrigatórios
      const form = getFormById(formId);
      if (!form || !form.is_active) {
        return reply.status(404).send({ error: "Not Found", message: "Formulário não encontrado." });
      }

      // Lê todas as partes do multipart
      const textFields: Record<string, string> = {};
      let uploadedFile: { buffer: Buffer; mimetype: string } | null = null;

      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === "file") {
            const filePart = part as MultipartFile;

            // Valida MIME type antes de ler o buffer
            if (!isAllowedMime(filePart.mimetype)) {
              // Drena o stream para não deixar conexao pendente
              await filePart.toBuffer().catch(() => null);
              return reply.status(400).send({
                error: "Bad Request",
                message: "Tipo de arquivo não permitido. Envie PDF ou imagem.",
              });
            }

            const buffer = await filePart.toBuffer();
            uploadedFile = { buffer, mimetype: filePart.mimetype };
          } else {
            // Campo de texto — sanitiza o nome do campo (nunca usa raw)
            const fieldName = part.fieldname.replace(/[^a-z0-9_]/gi, "").toLowerCase();
            const rawValue = (part as { value: string }).value ?? "";
            // Rejeita campos de texto acima de 10 000 caracteres (proteção contra payloads gigantes)
            if (rawValue.length > 10_000) {
              return reply.status(400).send({
                error: "Bad Request",
                message: "Um dos campos excede o tamanho máximo permitido (10 000 caracteres).",
              });
            }
            textFields[fieldName] = rawValue;
          }
        }
      } catch {
        return reply.status(400).send({ error: "Bad Request", message: "Erro ao processar o formulário." });
      }

      // Valida campos obrigatórios
      const validationErrors: string[] = [];
      for (const field of form.fields) {
        if (!field.required) continue;

        if (field.type === "file") {
          if (!uploadedFile) validationErrors.push(`O campo "${field.label}" é obrigatório.`);
        } else {
          const val = textFields[field.name];
          if (!val || val.trim() === "") {
            validationErrors.push(`O campo "${field.label}" é obrigatório.`);
          }
        }
      }

      if (validationErrors.length > 0) {
        return reply.status(422).send({
          error: "Unprocessable Entity",
          message: "Campos obrigatórios não preenchidos.",
          fields: validationErrors,
        });
      }

      // Verifica duplicidade de CPF para este formulário
      const cpfField = form.fields.find((f) => f.type === "cpf");
      if (cpfField) {
        const cpfValue = textFields[cpfField.name];
        if (cpfValue && hasDuplicateCpf(formId, cpfValue)) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Já existe uma inscrição com este CPF para esta turma.",
          });
        }
      }

      // Salva arquivo no disco
      let filePath: string | null = null;
      if (uploadedFile) {
        filePath = saveUploadedFile(uploadedFile.buffer, uploadedFile.mimetype);
      }

      // Monta array de campos para gravar no banco
      const submissionFields: SubmissionField[] = form.fields.map((f) => ({
        name: f.name,
        label: f.label,
        value: f.type === "file" ? null : (textFields[f.name] ?? null),
        filePath: f.type === "file" ? filePath : null,
      }));

      // IP e User-Agent para auditoria
      const ipAddress = (request.headers["x-forwarded-for"] as string)?.split(",")[0].trim()
        ?? request.ip
        ?? null;
      const userAgent = (request.headers["user-agent"] as string | undefined) ?? null;

      const { submissionId, protocol } = createSubmission(formId, submissionFields, ipAddress, userAgent);

      request.log.warn(
        { formId, submissionId, protocol, ip: ipAddress, hasFile: !!uploadedFile },
        "Form submission created",
      );

      return reply.status(201).send({
        message: "Inscrição realizada com sucesso!",
        submissionId,
        protocol,
      });
    }
  );
}
