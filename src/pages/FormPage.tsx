import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, AlertCircle, Upload, X, ChevronLeft, RefreshCw } from "lucide-react";
import {
  fetchForm,
  submitFormData,
  type ApiForm,
  type ApiFormField,
  type SubmitResult,
} from "@/api/forms";
import { useFormAutoSave, type SavedValues } from "@/hooks/useFormAutoSave";

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskTel(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldValues = Record<string, string>;
type FileEntry = { name: string; file: File; preview: string | null };

// ─── Client-side validation ───────────────────────────────────────────────────

function validateField(
  field: ApiFormField,
  values: FieldValues,
  fileEntry: FileEntry | null
): string {
  if (field.type === "file") {
    if (field.required && fileEntry?.name !== field.name)
      return "Este campo é obrigatório.";
    return "";
  }
  const val = (values[field.name] ?? "").trim();
  if (field.required && val === "") return "Este campo é obrigatório.";
  if (field.type === "cpf" && val !== "") {
    const digits = val.replace(/\D/g, "");
    if (digits.length !== 11) return "CPF inválido — deve ter 11 dígitos.";
  }
  return "";
}

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

// ─── FieldCard ────────────────────────────────────────────────────────────────

interface FieldCardProps {
  field: ApiFormField;
  value: string;
  fileEntry: FileEntry | null;
  error: string;
  onChange: (raw: string) => void;
  onBlur: () => void;
  onFileChange: (files: FileList | null) => void;
  onFileClear: () => void;
}

function FieldCard({
  field,
  value,
  fileEntry,
  error,
  onChange,
  onBlur,
  onFileChange,
  onFileClear,
}: FieldCardProps) {
  const inputId = `field-${field.name}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseInput =
    `w-full px-4 py-2.5 border rounded-lg text-sm bg-background outline-none ` +
    `transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ` +
    (error ? "border-destructive" : "border-border");

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border transition-colors duration-200 overflow-hidden ${
        error ? "border-destructive/50" : "border-border"
      }`}
    >
      <div className="p-6 space-y-3">
        {/* Label */}
        <label
          htmlFor={field.type !== "radio" ? inputId : undefined}
          className="block font-medium text-foreground text-sm"
        >
          {field.label}
          {field.required && (
            <span className="text-destructive ml-1" aria-label="obrigatório">
              *
            </span>
          )}
        </label>

        {/* ── text / date / tel / email / number ── */}
        {(field.type === "text" ||
          field.type === "date" ||
          field.type === "tel" ||
          field.type === "email" ||
          field.type === "number") && (
          <input
            id={inputId}
            type={
              field.type === "email"
                ? "email"
                : field.type === "date"
                ? "date"
                : field.type === "number"
                ? "number"
                : field.type === "tel"
                ? "tel"
                : "text"
            }
            value={value}
            placeholder={field.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={baseInput}
          />
        )}

        {/* ── cpf ── */}
        {field.type === "cpf" && (
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            value={value}
            placeholder={field.placeholder ?? "000.000.000-00"}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={baseInput}
          />
        )}

        {/* ── textarea ── */}
        {field.type === "textarea" && (
          <textarea
            id={inputId}
            value={value}
            placeholder={field.placeholder ?? ""}
            rows={4}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={`${baseInput} resize-none`}
          />
        )}

        {/* ── select ── */}
        {field.type === "select" && (
          <select
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={`${baseInput} ${!value ? "text-muted-foreground" : ""}`}
          >
            <option value="">Selecione uma opção</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {/* ── radio ── */}
        {field.type === "radio" && (
          <div className="space-y-2" role="radiogroup" aria-label={field.label}>
            {(field.options ?? []).map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  value === opt
                    ? "border-primary bg-[hsl(var(--sky))]"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  onBlur={onBlur}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{opt}</span>
              </label>
            ))}
          </div>
        )}

        {/* ── file ── */}
        {field.type === "file" && (
          <div className="space-y-3">
            {!fileEntry ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer ${
                  error ? "border-destructive/50" : "border-border"
                }`}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF ou imagem (JPG, PNG, WebP) — máx. 100 MB
                </p>
              </button>
            ) : (
              <div className="border border-border rounded-xl p-4 space-y-3">
                {fileEntry.preview ? (
                  <img
                    src={fileEntry.preview}
                    alt="Pré-visualização"
                    className="w-full max-h-48 object-contain rounded-lg bg-muted"
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-red-600">PDF</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {fileEntry.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileEntry.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onFileClear}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Remover arquivo
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.avif"
              onChange={(e) => onFileChange(e.target.files)}
            />
          </div>
        )}

        {/* Inline error */}
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── FormPage ─────────────────────────────────────────────────────────────────

export default function FormPage() {
  const { slug } = useParams<{ slug: string }>();

  // Form definition state
  const [form, setForm] = useState<ApiForm | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    "loading"
  );
  const [loadError, setLoadError] = useState("");

  // Field values
  const [values, setValues] = useState<FieldValues>({});
  const [fileEntry, setFileEntry] = useState<FileEntry | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Submit state
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Auto-save
  const parsedFormId = form?.id ?? null;
  const { savedValues, hasSavedData, save, clearSave, dismissBanner } =
    useFormAutoSave(parsedFormId);
  const [bannerVisible, setBannerVisible] = useState(false);

  // Load form definition
  useEffect(() => {
    if (!slug) return;
    setLoadState("loading");
    fetchForm(slug)
      .then((f) => {
        setForm(f);
        setLoadState("ready");
      })
      .catch((e: Error) => {
        setLoadError(e.message);
        setLoadState("error");
      });
  }, [slug]);

  // Show restore banner once saved data is detected
  useEffect(() => {
    if (hasSavedData) setBannerVisible(true);
  }, [hasSavedData]);

  // Auto-save whenever values change
  useEffect(() => {
    if (parsedFormId != null && Object.keys(values).length > 0) save(values);
  }, [values, parsedFormId, save]);

  // Cleanup object URL when file changes
  const prevPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    const cur = fileEntry?.preview ?? null;
    if (prevPreviewRef.current && prevPreviewRef.current !== cur) {
      URL.revokeObjectURL(prevPreviewRef.current);
    }
    prevPreviewRef.current = cur;
    return () => {
      if (prevPreviewRef.current) URL.revokeObjectURL(prevPreviewRef.current);
    };
  }, [fileEntry]);

  // Validate all fields (called on submit)
  const validateAll = useCallback((): boolean => {
    if (!form) return false;
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    let valid = true;
    for (const field of form.fields) {
      newTouched[field.name] = true;
      const err = validateField(field, values, fileEntry);
      newErrors[field.name] = err;
      if (err) valid = false;
    }
    setErrors(newErrors);
    setTouched(newTouched);
    return valid;
  }, [form, values, fileEntry]);

  // Handle text/select/radio change with masks applied
  const handleChange = useCallback(
    (name: string, raw: string, type: ApiFormField["type"]) => {
      let processed = raw;
      if (type === "cpf") processed = maskCpf(raw);
      if (type === "tel") processed = maskTel(raw);

      setValues((prev) => {
        const next = { ...prev, [name]: processed };
        // Live re-validate only if field was already touched
        if (touched[name] && form) {
          const field = form.fields.find((f) => f.name === name);
          if (field) {
            const err = validateField(field, next, fileEntry);
            setErrors((prev) => ({ ...prev, [name]: err }));
          }
        }
        return next;
      });
    },
    [touched, fileEntry, form]
  );

  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      if (form) {
        const field = form.fields.find((f) => f.name === name);
        if (field) {
          const err = validateField(field, values, fileEntry);
          setErrors((prev) => ({ ...prev, [name]: err }));
        }
      }
    },
    [form, values, fileEntry]
  );

  // Handle file selection with client-side validation
  const handleFileChange = useCallback(
    (name: string, files: FileList | null) => {
      if (!files || files.length === 0) {
        setFileEntry(null);
        return;
      }
      const file = files[0];
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          [name]: "Tipo não permitido. Use PDF ou imagem (JPG, PNG, WebP).",
        }));
        setFileEntry(null);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrors((prev) => ({
          ...prev,
          [name]: "Arquivo muito grande. Máximo: 100 MB.",
        }));
        setFileEntry(null);
        return;
      }
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      setFileEntry({ name, file, preview });
      setErrors((prev) => ({ ...prev, [name]: "" }));
    },
    []
  );

  const handleFileClear = useCallback(
    (name: string) => {
      setFileEntry(null);
      setTouched((prev) => ({ ...prev, [name]: true }));
      if (form) {
        const field = form.fields.find((f) => f.name === name);
        if (field) {
          const err = validateField(field, values, null);
          setErrors((prev) => ({ ...prev, [name]: err }));
        }
      }
    },
    [form, values]
  );

  // Restore saved values from localStorage
  const handleRestore = useCallback(() => {
    setValues(savedValues as SavedValues);
    setBannerVisible(false);
  }, [savedValues]);

  const handleDismissBanner = useCallback(() => {
    setBannerVisible(false);
    dismissBanner();
  }, [dismissBanner]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!form) return;
    if (!validateAll()) {
      // Scroll to first error
      setTimeout(() => {
        document
          .querySelector("[data-error='true']")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setSubmitState("submitting");
    setUploadProgress(0);

    const fd = new FormData();
    for (const field of form.fields) {
      if (field.type === "file") {
        if (fileEntry?.name === field.name) {
          fd.append(field.name, fileEntry.file, fileEntry.file.name);
        }
      } else {
        fd.append(field.name, values[field.name] ?? "");
      }
    }

    try {
      const result = await submitFormData(form.id, fd, setUploadProgress);
      clearSave();
      setSubmitResult(result);
      setSubmitState("success");
    } catch (e: unknown) {
      setSubmitError(
        e instanceof Error ? e.message : "Erro desconhecido ao enviar."
      );
      setSubmitState("error");
    }
  }, [form, values, fileEntry, validateAll, clearSave]);

  // Progress indicator: % of required fields filled
  const progress = (() => {
    if (!form) return 0;
    const required = form.fields.filter((f) => f.required);
    if (required.length === 0) return 100;
    const filled = required.filter((f) =>
      f.type === "file"
        ? fileEntry?.name === f.name
        : (values[f.name] ?? "").trim() !== ""
    ).length;
    return Math.round((filled / required.length) * 100);
  })();

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">
            Carregando formulário...
          </p>
        </div>
      </div>
    );
  }

  // ── Load error state ───────────────────────────────────────────────────────
  if (loadState === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">
            Formulário indisponível
          </h2>
          <p className="text-muted-foreground text-sm">{loadError}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitState === "success" && submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-primary p-8 text-center">
            <CheckCircle className="w-16 h-16 text-white mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-white">
              Inscrição Realizada!
            </h2>
            <p className="text-white/80 text-sm mt-1">
              Sua inscrição foi recebida com sucesso.
            </p>
          </div>
          <div className="p-8 text-center space-y-5">
            <div className="bg-[hsl(var(--sky))] border border-primary/20 rounded-xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Número de protocolo
              </p>
              <p className="text-4xl font-extrabold text-primary">
                {submitResult.protocol}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Guarde este número para acompanhar o status da sua inscrição.
            </p>
            <Link
              to="/"
              className="inline-block bg-primary text-white px-8 py-2.5 rounded-xl font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header with progress bar */}
      <header className="bg-primary text-white py-4 px-4 shadow-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            to="/"
            className="hover:opacity-80 transition-opacity"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold text-sm opacity-90 truncate">
            Programa de Robótica
          </span>
        </div>
        <div className="max-w-2xl mx-auto mt-3">
          <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
            <span>Campos obrigatórios</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Restore banner */}
        {bannerVisible && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 text-lg" aria-hidden>
              💾
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                Você tem dados salvos
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Detectamos um preenchimento anterior. Deseja continuar de onde
                parou?
              </p>
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={handleRestore}
                  className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors font-medium"
                >
                  Sim, continuar
                </button>
                <button
                  onClick={handleDismissBanner}
                  className="text-xs text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Não, começar do zero
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="h-2 bg-primary" />
          <div className="p-6">
            <h1 className="text-2xl font-bold text-foreground leading-snug">
              {form.title}
            </h1>
            {form.description && (
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {form.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Campos marcados com{" "}
              <span className="text-destructive font-semibold">*</span> são
              obrigatórios.
            </p>
          </div>
        </div>

        {/* Dynamic field cards */}
        {form.fields.map((field) => (
          <div
            key={field.id}
            data-error={
              touched[field.name] && !!errors[field.name] ? "true" : undefined
            }
          >
            <FieldCard
              field={field}
              value={values[field.name] ?? ""}
              fileEntry={
                fileEntry?.name === field.name ? fileEntry : null
              }
              error={touched[field.name] ? (errors[field.name] ?? "") : ""}
              onChange={(raw) => handleChange(field.name, raw, field.type)}
              onBlur={() => handleBlur(field.name)}
              onFileChange={(files) => handleFileChange(field.name, files)}
              onFileClear={() => handleFileClear(field.name)}
            />
          </div>
        ))}

        {/* Submit card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          {/* Server error alert */}
          {submitState === "error" && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Erro ao enviar
                </p>
                <p className="text-xs text-red-700 mt-0.5 whitespace-pre-line">
                  {submitError}
                </p>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {submitState === "submitting" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium">Enviando inscrição...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Aguarde, não feche esta página.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={
                submitState === "error"
                  ? () => {
                      setSubmitState("idle");
                      handleSubmit();
                    }
                  : handleSubmit
              }
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-base hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {submitState === "error" ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </>
              ) : (
                "Enviar inscrição"
              )}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Programa de Robótica — seus dados são protegidos e utilizados
          exclusivamente para fins de inscrição.
        </p>
      </main>
    </div>
  );
}
