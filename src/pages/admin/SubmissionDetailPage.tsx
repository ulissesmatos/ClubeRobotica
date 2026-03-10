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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiGetSubmission,
  apiUpdateStatus,
  apiDeleteSubmission,
  apiUpdateSubmissionData,
  fetchUploadAsBlob,
  type SubmissionDetail,
  type SubmissionDataRow,
  type SubmissionStatus,
} from "@/api/admin";

import { AdminLayout } from "./AdminLayout";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente:  "bg-amber-100 text-amber-800 border-amber-200",
    aprovado:  "bg-green-100 text-green-800 border-green-200",
    rejeitado: "bg-red-100 text-red-800 border-red-200",
  };
  const icons: Record<string, React.ReactNode> = {
    pendente:  <Clock className="w-3 h-3" />,
    aprovado:  <CheckCircle className="w-3 h-3" />,
    rejeitado: <XCircle className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    pendente: "Pendente", aprovado: "Deferido", rejeitado: "Indeferido",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full border ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {icons[status]}
      {labels[status] ?? status}
    </span>
  );
}

// ─── File viewer ──────────────────────────────────────────────────────────────

function FileViewer({ token, filePath }: { token: string; filePath: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
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
      {isImage && (
        <img
          src={objectUrl}
          alt={filename}
          className="max-w-full max-h-80 rounded-lg border border-border object-contain"
        />
      )}
      {isPdf && (
        <iframe
          src={objectUrl}
          title={filename}
          className="w-full h-96 rounded-lg border border-border"
        />
      )}
      {!isImage && !isPdf && (
        <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
          <FileText className="w-4 h-4" />
          <span className="font-mono">{filename}</span>
        </div>
      )}
      <a
        href={objectUrl}
        download={filename}
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <Download className="w-4 h-4" />
        Baixar arquivo
      </a>
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

  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // Editing state
  const [editing,     setEditing]     = useState(false);
  const [editValues,  setEditValues]  = useState<Record<number, string>>({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [editSaved,   setEditSaved]   = useState(false);

  const load = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError("");
    apiGetSubmission(accessToken, Number(id))
      .then((s) => {
        setSubmission(s);
        setStatus(s.status as SubmissionStatus);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(newStatus: SubmissionStatus) {
    if (!accessToken || !id) return;
    setStatus(newStatus);
    setStatusSaving(true);
    setStatusSaved(false);
    try {
      await apiUpdateStatus(accessToken, Number(id), newStatus);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 2000);
    } catch {
      // revert
      setStatus(submission?.status as SubmissionStatus ?? "pendente");
    } finally {
      setStatusSaving(false);
    }
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

  function startEditing() {
    if (!submission) return;
    const vals: Record<number, string> = {};
    for (const d of submission.data) {
      if (d.value_file_path === null) {
        vals[d.id] = d.value_text ?? "";
      }
    }
    setEditValues(vals);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditValues({});
  }

  async function saveEditing() {
    if (!accessToken || !id || !submission) return;
    const updates: { id: number; value_text: string }[] = [];
    for (const d of submission.data) {
      if (d.value_file_path !== null) continue;
      const newVal = editValues[d.id];
      if (newVal !== undefined && newVal !== (d.value_text ?? "")) {
        updates.push({ id: d.id, value_text: newVal });
      }
    }
    if (updates.length === 0) { cancelEditing(); return; }

    setEditSaving(true);
    try {
      await apiUpdateSubmissionData(accessToken, Number(id), updates);
      setEditing(false);
      setEditSaved(true);
      setTimeout(() => setEditSaved(false), 2000);
      load(); // Recarrega os dados
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

      {/* Back link */}
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para inscrições
      </Link>

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
          </div>
        </div>
      </div>

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
            <FileViewer token={accessToken} filePath={fileField.value_file_path!} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
