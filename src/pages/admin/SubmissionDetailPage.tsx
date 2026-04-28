import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  Pencil,
  Save,
  X,
  Upload,
  ZoomIn,
  Maximize2,
  ArrowRightLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiGetSubmission,
  apiUpdateStatus,
  apiDeleteSubmission,
  apiMoveSubmission,
  apiUpdateSubmissionData,
  apiReplaceSubmissionFile,
  apiListForms,
  fetchUploadAsBlob,
  type SubmissionDetail,
  type SubmissionDataRow,
  type SubmissionStatus,
  type FormRow,
} from "@/api/admin";

import { AdminLayout } from "./AdminLayout";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente:  "bg-amber-100 text-amber-800 border-amber-200",
    aprovado:  "bg-green-100 text-green-800 border-green-200",
    rejeitado: "bg-red-100 text-red-800 border-red-200",
    reserva:   "bg-blue-100 text-blue-800 border-blue-200",
  };
  const icons: Record<string, React.ReactNode> = {
    pendente:  <Clock className="w-3 h-3" />,
    aprovado:  <CheckCircle className="w-3 h-3" />,
    rejeitado: <XCircle className="w-3 h-3" />,
    reserva:   <Clock className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    pendente: "Pendente", aprovado: "Deferido", rejeitado: "Indeferido", reserva: "Reserva",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full border ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {icons[status]}
      {labels[status] ?? status}
    </span>
  );
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────

function ImageLightbox({
  src,
  filename,
  onClose,
}: {
  src: string;
  filename: string;
  onClose: () => void;
}) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const containerRef = useRef<HTMLDivElement>(null);
  const didDrag = useRef(false);
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 8;

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Non-passive wheel: zoom toward cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // cursor relative to container center
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;
      setTransform((prev) => {
        const factor = e.deltaY > 0 ? 0.88 : 1.14;
        const newScale = Math.min(Math.max(prev.scale * factor, MIN_SCALE), MAX_SCALE);
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          x: cursorX - (cursorX - prev.x) * ratio,
          y: cursorY - (cursorY - prev.y) * ratio,
        };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Click-and-drag pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    didDrag.current = false;
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const { x: ox, y: oy } = transformRef.current;

    const onMove = (me: MouseEvent) => {
      didDrag.current = true;
      setTransform((prev) => ({
        ...prev,
        x: ox + (me.clientX - startX),
        y: oy + (me.clientY - startY),
      }));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const { scale, x, y } = transform;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center">
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <span className="text-white/60 text-xs tabular-nums mr-1">
          {Math.round(scale * 100)}%
        </span>
        <a
          href={src}
          download={filename}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors"
          title="Baixar"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors"
          title="Fechar (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Full-overlay drag/zoom surface */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onClick={() => { if (!didDrag.current) onClose(); }}
      >
        <img
          src={src}
          alt={filename}
          draggable={false}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`,
            transformOrigin: "center",
            maxWidth: "88vw",
            maxHeight: "88vh",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none">
        Scroll para zoom · Arraste para mover · Clique fora para fechar
      </p>
    </div>
  );
}

// ─── PDF Lightbox ─────────────────────────────────────────────────────────────

function PdfLightbox({
  src,
  filename,
  onClose,
}: {
  src: string;
  filename: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/88 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-black/60 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/80 text-sm font-mono truncate max-w-[60vw]">
          {filename}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={src}
            download={filename}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF */}
      <div
        className="flex-1 p-3 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={src}
          title={filename}
          className="w-full h-full rounded-lg bg-white"
        />
      </div>
    </div>
  );
}

// ─── File viewer ──────────────────────────────────────────────────────────────

const ALLOWED_EDIT_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
];

interface FileViewerProps {
  token: string;
  filePath: string;
  editing?: boolean;
  onFileReplace?: (file: File) => void;
  pendingFile?: File | null;
}

function FileViewer({ token, filePath, editing, onFileReplace, pendingFile }: FileViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const filename = filePath.replace(/\\/g, "/").split("/").pop() ?? "arquivo";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  const isPdf   = ext === "pdf";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchUploadAsBlob(token, filePath)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlRef.current = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [token, filePath]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando arquivo...
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className="flex items-center gap-2 py-4 text-destructive text-sm">
        <AlertCircle className="w-4 h-4" />
        Não foi possível carregar o arquivo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Preview do arquivo pendente (novo arquivo selecionado para troca) */}
      {editing && pendingFile && (
        <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Novo arquivo selecionado:</p>
          {pendingFile.type.startsWith("image/") ? (
            <img
              src={URL.createObjectURL(pendingFile)}
              alt="Preview"
              className="max-w-full max-h-48 rounded-lg object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="w-4 h-4" />
              <span className="font-mono">{pendingFile.name}</span>
              <span className="text-muted-foreground">({(pendingFile.size / 1024 / 1024).toFixed(1)} MB)</span>
            </div>
          )}
        </div>
      )}

      {/* Arquivo atual */}
      {isImage && (
        <>
          {lightboxOpen && objectUrl && (
            <ImageLightbox
              src={objectUrl}
              filename={filename}
              onClose={() => setLightboxOpen(false)}
            />
          )}
          <div
            className="relative group inline-block cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
            title="Clique para expandir"
          >
            <img
              src={objectUrl}
              alt={filename}
              className="max-w-full max-h-80 rounded-lg border border-border object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
              <div className="bg-black/60 rounded-full p-2">
                <ZoomIn className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </>
      )}
      {isPdf && (
        <>
          {lightboxOpen && objectUrl && (
            <PdfLightbox
              src={objectUrl}
              filename={filename}
              onClose={() => setLightboxOpen(false)}
            />
          )}
          <div className="space-y-2">
            <iframe
              src={objectUrl}
              title={filename}
              className="w-full h-96 rounded-lg border border-border"
            />
            <button
              onClick={() => setLightboxOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Expandir PDF
            </button>
          </div>
        </>
      )}
      {!isImage && !isPdf && (
        <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
          <FileText className="w-4 h-4" />
          <span className="font-mono">{filename}</span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <a
          href={objectUrl}
          download={filename}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Download className="w-4 h-4" />
          Baixar arquivo
        </a>

        {editing && onFileReplace && (
          <label className="inline-flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
            <Upload className="w-4 h-4" />
            {pendingFile ? "Trocar novamente" : "Substituir arquivo"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.avif"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!ALLOWED_EDIT_TYPES.includes(f.type)) {
                  alert("Tipo não permitido. Use PDF ou imagem.");
                  return;
                }
                onFileReplace(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Move form modal ───────────────────────────────────────────────────────────

function MoveFormModal({
  forms,
  currentFormId,
  onConfirm,
  onCancel,
  moving,
}: {
  forms: FormRow[];
  currentFormId: number;
  onConfirm: (formId: number) => void;
  onCancel: () => void;
  moving: boolean;
}) {
  const [selected, setSelected] = useState<number>(currentFormId);
  const others = forms.filter((f) => f.id !== currentFormId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-foreground">Mover para outro formulário</h3>
        </div>

        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-5">Não há outros formulários disponíveis.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione o formulário de destino:
            </p>
            <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
              {others.map((f) => (
                <label
                  key={f.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected === f.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="targetForm"
                    value={f.id}
                    checked={selected === f.id}
                    onChange={() => setSelected(f.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground">{f.title}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={moving}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          {others.length > 0 && (
            <button
              onClick={() => onConfirm(selected)}
              disabled={moving || selected === currentFormId}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {moving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Mover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-bold text-foreground">Excluir inscrição?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Esta ação é permanente. Todos os dados e arquivos desta inscrição serão removidos.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectionReasonModal({
  initialValue,
  saving,
  onCancel,
  onConfirm,
}: {
  initialValue: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(initialValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
        <h3 className="font-bold text-foreground mb-2">Motivo do indeferimento</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Informe de forma clara por que esta inscrição foi indeferida.
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Ex: documentação incompleta, divergência de dados, turma incompatível..."
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={saving || !reason.trim()}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Confirmar indeferimento
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SubmissionDetailPage ─────────────────────────────────────────────────────

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const [status,         setStatus]         = useState<SubmissionStatus>("pendente");
  const [statusSaving,   setStatusSaving]   = useState(false);
  const [statusSaved,    setStatusSaved]    = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // Move form state
  const [showMove,  setShowMove]  = useState(false);
  const [moving,    setMoving]    = useState(false);
  const [forms,     setForms]     = useState<FormRow[]>([]);

  // Editing state
  const [editing,     setEditing]     = useState(false);
  const [editValues,  setEditValues]  = useState<Record<number, string>>({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [editSaved,   setEditSaved]   = useState(false);
  const [pendingFile, setPendingFile]  = useState<File | null>(null);

  const load = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError("");
    apiGetSubmission(accessToken, Number(id))
      .then((s) => {
        setSubmission(s);
        setStatus(s.status as SubmissionStatus);
        setRejectionReason(s.rejection_reason ?? "");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => { load(); }, [load]);

  // Load forms list for the move modal (once)
  useEffect(() => {
    if (!accessToken) return;
    apiListForms(accessToken).then(setForms).catch(() => {});
  }, [accessToken]);

  async function persistStatus(newStatus: SubmissionStatus, reason?: string) {
    if (!accessToken || !id) return;
    setStatus(newStatus);
    setStatusSaving(true);
    setStatusSaved(false);
    try {
      await apiUpdateStatus(accessToken, Number(id), newStatus, reason);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 2000);
      await load();
    } catch {
      // revert
      setStatus(submission?.status as SubmissionStatus ?? "pendente");
    } finally {
      setStatusSaving(false);
    }
  }

  function handleStatusChange(newStatus: SubmissionStatus) {
    if (newStatus === "rejeitado") {
      setShowRejectReasonModal(true);
      return;
    }
    void persistStatus(newStatus);
  }

  function handleConfirmRejection(reason: string) {
    setShowRejectReasonModal(false);
    setRejectionReason(reason);
    void persistStatus("rejeitado", reason);
  }

  async function handleDelete() {
    if (!accessToken || !id) return;
    setDeleting(true);
    try {
      await apiDeleteSubmission(accessToken, Number(id));
      navigate("/admin/dashboard", { replace: true });
    } catch {
      setDeleting(false);
      setShowDelete(false);
    }
  }

  async function handleMove(targetFormId: number) {
    if (!accessToken || !id) return;
    setMoving(true);
    try {
      await apiMoveSubmission(accessToken, Number(id), targetFormId);
      setShowMove(false);
      load(); // recarrega para atualizar o título do formulário
    } catch {
      // keep modal open on error
    } finally {
      setMoving(false);
    }
  }

  function startEditing() {
    if (!submission) return;
    const vals: Record<number, string> = {};
    for (const d of submission.data) {
      if (d.value_file_path === null) {
        vals[d.id] = d.value_text ?? "";
      }
    }
    setEditValues(vals);
    setPendingFile(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditValues({});
    setPendingFile(null);
  }

  async function saveEditing() {
    if (!accessToken || !id || !submission) return;

    // Text field updates
    const updates: { id: number; value_text: string }[] = [];
    for (const d of submission.data) {
      if (d.value_file_path !== null) continue;
      const newVal = editValues[d.id];
      if (newVal !== undefined && newVal !== (d.value_text ?? "")) {
        updates.push({ id: d.id, value_text: newVal });
      }
    }

    const hasTextChanges = updates.length > 0;
    const hasFileChange = !!pendingFile;

    if (!hasTextChanges && !hasFileChange) { cancelEditing(); return; }

    setEditSaving(true);
    try {
      if (hasTextChanges) {
        await apiUpdateSubmissionData(accessToken, Number(id), updates);
      }
      if (hasFileChange && pendingFile) {
        const fileField = submission.data.find((d) => d.value_file_path !== null);
        if (fileField) {
          await apiReplaceSubmissionFile(accessToken, Number(id), fileField.id, pendingFile);
        }
      }
      setEditing(false);
      setPendingFile(null);
      setEditSaved(true);
      setTimeout(() => setEditSaved(false), 2000);
      load();
    } catch {
      // keep editing open on error
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout contentClassName="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          Carregando inscrição...
        </div>
      </AdminLayout>
    );
  }

  if (error || !submission) {
    return (
      <AdminLayout contentClassName="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-destructive text-sm">{error || "Inscrição não encontrada."}</p>
          <Link to="/admin/dashboard" className="text-primary text-sm hover:underline">
            ← Voltar ao painel
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const fileField = submission.data.find(
    (d: SubmissionDataRow) => d.value_file_path !== null,
  );

  return (
    <AdminLayout contentClassName="max-w-4xl mx-auto px-4 py-8">
      {showDelete && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}
      {showRejectReasonModal && (
        <RejectionReasonModal
          initialValue={rejectionReason}
          saving={statusSaving}
          onCancel={() => {
            setShowRejectReasonModal(false);
            setStatus(submission.status as SubmissionStatus);
          }}
          onConfirm={handleConfirmRejection}
        />
      )}
      {showMove && submission && (
        <MoveFormModal
          forms={forms}
          currentFormId={submission.form_id}
          onConfirm={handleMove}
          onCancel={() => setShowMove(false)}
          moving={moving}
        />
      )}

      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para inscrições
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-lg font-bold text-foreground tracking-wider">
                {submission.protocol || `#${submission.id}`}
              </span>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">{submission.form_title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enviado em {new Date(submission.submitted_at + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              {submission.ip_address && ` · IP ${submission.ip_address}`}
            </p>
            {submission.reviewed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Revisado em {new Date(submission.reviewed_at + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </p>
            )}
            {submission.turma_id && submission.turma_name && (
              <p className="text-xs mt-1">
                <Link to={`/admin/turmas/${submission.turma_id}`} className="text-primary hover:underline">
                  Turma atual: {submission.turma_name}
                </Link>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Status selector */}
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as SubmissionStatus)}
                disabled={statusSaving}
                className="px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="pendente">Pendente</option>
                <option value="aprovado">Deferido</option>
                <option value="rejeitado">Indeferido</option>
                <option value="reserva">Reserva</option>
              </select>
              {statusSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {statusSaved  && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>

            {/* Delete button */}
            <button
              onClick={() => setShowDelete(true)}
              className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              title="Excluir inscrição"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Move to another form */}
            <button
              onClick={() => setShowMove(true)}
              className="p-2 rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors"
              title="Mover para outro formulário"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {status === "rejeitado" && (submission.rejection_reason || rejectionReason) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-red-700 mb-1">Motivo do indeferimento</h3>
          <p className="text-sm text-red-700 whitespace-pre-wrap">
            {submission.rejection_reason || rejectionReason}
          </p>
        </div>
      )}

      {/* Field data */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-foreground text-base">Dados da inscrição</h2>
          <div className="flex items-center gap-2">
            {editSaved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3.5 h-3.5" /> Salvo
              </span>
            )}
            {editing ? (
              <>
                <button
                  onClick={cancelEditing}
                  disabled={editSaving}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
                <button
                  onClick={saveEditing}
                  disabled={editSaving}
                  className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground font-semibold rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </button>
              </>
            ) : (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar dados
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {submission.data
            .filter((d: SubmissionDataRow) => d.value_file_path === null)
            .map((d: SubmissionDataRow) => (
                <div key={d.id} className="border-b border-border pb-4">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  {d.field_label}
                </dt>
                {editing ? (
                  <input
                    type="text"
                    value={editValues[d.id] ?? ""}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:border-primary transition-colors"
                  />
                ) : (
                  <dd className="text-sm text-foreground break-words">
                    {d.value_text ?? <span className="text-muted-foreground italic">Não preenchido</span>}
                  </dd>
                )}
              </div>
            ))}
        </div>

        {/* File field */}
        {fileField && accessToken && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              {["jpg","jpeg","png","gif","webp"].includes(
                (fileField.value_file_path ?? "").split(".").pop()?.toLowerCase() ?? ""
              ) ? (
                <ImageIcon className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {fileField.field_label}
            </h3>
            <FileViewer
              token={accessToken}
              filePath={fileField.value_file_path!}
              editing={editing}
              onFileReplace={setPendingFile}
              pendingFile={pendingFile}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
