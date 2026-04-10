import { useState, useEffect, useRef } from "react";
import { Save, Loader2, CheckCircle, Phone, Instagram, MessageCircle, CalendarDays, HardDrive, Download, Upload, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiGetSettings, apiUpdateSettings, apiDownloadBackup, apiRestoreBackup, type SiteSettingsAdmin } from "@/api/admin";
import { AdminLayout } from "./AdminLayout";

const DEFAULT: SiteSettingsAdmin = {
  whatsapp_number: "",
  whatsapp_message: "",
  whatsapp_floating_enabled: "1",
  whatsapp_footer_enabled: "1",
  instagram_handle: "",
  instagram_enabled: "1",
  phone_display: "",
  phone_number: "",
  phone_enabled: "1",
  enrollments_status: "open",
  enrollments_date_start: "24/03",
  enrollments_date_end: "30/03",
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

export default function SettingsPage() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<SiteSettingsAdmin>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupDone, setBackupDone] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupPhase, setBackupPhase] = useState<"preparing" | "downloading">("preparing");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreDone, setRestoreDone] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restorePhase, setRestorePhase] = useState<"uploading" | "processing">("uploading");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiGetSettings(accessToken)
      .then(setForm)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  function set(key: keyof SiteSettingsAdmin, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiUpdateSettings(accessToken, form);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBackup() {
    if (!accessToken) return;
    setBackingUp(true);
    setBackupError("");
    setBackupDone(false);
    setBackupProgress(0);
    setBackupPhase("preparing");
    try {
      const blob = await apiDownloadBackup(accessToken, (received, total) => {
        setBackupPhase("downloading");
        setBackupProgress(Math.round((received / total) * 100));
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `backup_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupProgress(100);
      setBackupDone(true);
      setTimeout(() => setBackupDone(false), 5000);
    } catch (err: unknown) {
      setBackupError(err instanceof Error ? err.message : "Erro ao criar backup.");
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestoreFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".zip")) {
      setRestoreError("Selecione um arquivo .zip gerado pelo backup.");
      return;
    }
    setRestoreFile(f);
    setRestoreError("");
    setShowRestoreConfirm(true);
  }

  async function handleRestoreConfirm() {
    if (!accessToken || !restoreFile) return;
    setRestoring(true);
    setRestoreError("");
    setRestoreDone(false);
    setRestoreProgress(0);
    setRestorePhase("uploading");
    setShowRestoreConfirm(false);
    try {
      await apiRestoreBackup(accessToken, restoreFile, (sent, total) => {
        const pct = Math.round((sent / total) * 100);
        setRestoreProgress(pct);
        if (pct >= 100) setRestorePhase("processing");
      });
      setRestoreProgress(100);
      setRestoreDone(true);
      setRestoreFile(null);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      setTimeout(() => setRestoreDone(false), 5000);
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : "Erro ao restaurar backup.");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando configurações...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout contentClassName="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados de contato e redes sociais exibidos na landing page.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Inscrições ── */}
        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Status das Inscrições</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Controla o status exibido na landing page em todos os textos de inscrições.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {([
              { value: "open",     label: "Abertas",     color: "bg-green-500 hover:bg-green-600" },
              { value: "extended", label: "Prorrogadas",  color: "bg-amber-500 hover:bg-amber-600" },
              { value: "closed",   label: "Encerradas",   color: "bg-red-500 hover:bg-red-600" },
            ] as const).map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("enrollments_status", value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors border-2 ${
                  form.enrollments_status === value
                    ? `${color} text-white border-transparent shadow-md`
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {form.enrollments_status !== "closed" && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data de início
                </label>
                <input
                  type="text"
                  value={form.enrollments_date_start}
                  onChange={(e) => set("enrollments_date_start", e.target.value)}
                  placeholder="24/03"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data de encerramento
                </label>
                <input
                  type="text"
                  value={form.enrollments_date_end}
                  onChange={(e) => set("enrollments_date_end", e.target.value)}
                  placeholder="30/03"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}
        </section>

        {/* ── WhatsApp ── */}
        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-foreground">WhatsApp</h2>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Número (com DDI, sem espaços ou símbolos)
            </label>
            <input
              type="text"
              value={form.whatsapp_number}
              onChange={(e) => set("whatsapp_number", e.target.value)}
              placeholder="559998881234"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              Ex: 559998881234 (55 = Brasil, 99 = DDD, número)
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mensagem pré-preenchida
            </label>
            <textarea
              rows={3}
              value={form.whatsapp_message}
              onChange={(e) => set("whatsapp_message", e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Toggle
              label="Exibir botão flutuante (canto inferior direito)"
              checked={form.whatsapp_floating_enabled === "1"}
              onChange={(v) => set("whatsapp_floating_enabled", v ? "1" : "0")}
            />
            <Toggle
              label="Exibir botão no footer da página"
              checked={form.whatsapp_footer_enabled === "1"}
              onChange={(v) => set("whatsapp_footer_enabled", v ? "1" : "0")}
            />
          </div>
        </section>

        {/* ── Instagram ── */}
        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Instagram className="w-5 h-5 text-pink-500" />
            <h2 className="font-semibold text-foreground">Instagram</h2>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Arroba (sem o @)
            </label>
            <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
              <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-r border-border">
                @
              </span>
              <input
                type="text"
                value={form.instagram_handle}
                onChange={(e) => set("instagram_handle", e.target.value)}
                placeholder="clubinhorobotica_codo"
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <Toggle
            label="Exibir link do Instagram no footer"
            checked={form.instagram_enabled === "1"}
            onChange={(v) => set("instagram_enabled", v ? "1" : "0")}
          />
        </section>

        {/* ── Telefone ── */}
        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-foreground">Telefone</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Exibição
              </label>
              <input
                type="text"
                value={form.phone_display}
                onChange={(e) => set("phone_display", e.target.value)}
                placeholder="(99) 98888-1234"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Número para discagem (sem +)
              </label>
              <input
                type="text"
                value={form.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
                placeholder="559998881234"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <Toggle
            label="Exibir telefone no footer"
            checked={form.phone_enabled === "1"}
            onChange={(v) => set("phone_enabled", v ? "1" : "0")}
          />
        </section>

        {/* ── Save button ── */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle className="w-4 h-4" />
              Salvo com sucesso!
            </span>
          )}
        </div>
      </form>

      {/* ── Backup e Restauração ── */}
      <section className="mt-6 bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-5 h-5 text-slate-600" />
          <h2 className="font-semibold text-foreground">Backup e Restauração</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Baixe uma cópia completa do sistema (banco de dados + todos os arquivos enviados: boletins, imagens, PDFs).
          O backup é gerado sem interromper o funcionamento. O arquivo .zip pode ser usado para restaurar o sistema completo.
        </p>

        {/* Erros */}
        {backupError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center justify-between">
            <span>{backupError}</span>
            <button onClick={() => setBackupError("")} className="text-red-400 hover:text-red-600 font-bold ml-4">✕</button>
          </div>
        )}
        {restoreError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center justify-between">
            <span>{restoreError}</span>
            <button onClick={() => setRestoreError("")} className="text-red-400 hover:text-red-600 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Backup */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBackup}
              disabled={backingUp || restoring}
              className="flex items-center gap-2 bg-slate-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {backingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {backingUp
                ? backupPhase === "preparing"
                  ? "Preparando backup..."
                  : `Baixando... ${backupProgress}%`
                : "Baixar backup"}
            </button>
            {backupDone && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" />
                Backup baixado com sucesso!
              </span>
            )}
          </div>
          {backingUp && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{backupPhase === "preparing" ? "Preparando o arquivo ZIP no servidor..." : "Baixando arquivo..."}</span>
                {backupPhase === "downloading" && <span>{backupProgress}%</span>}
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                {backupPhase === "preparing" ? (
                  <div className="h-full bg-slate-500 rounded-full animate-pulse w-full" />
                ) : (
                  <div
                    className="h-full bg-slate-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${backupProgress}%` }}
                  />
                )}
              </div>
              {backupPhase === "preparing" && (
                <p className="text-xs text-muted-foreground italic">Compactando banco de dados e arquivos. Pode levar alguns minutos...</p>
              )}
            </div>
          )}
        </div>

        {/* Divisor */}
        <hr className="border-border" />

        {/* Restauração */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-foreground">Restaurar backup</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione um arquivo <strong>.zip</strong> gerado pelo botão acima. O banco de dados e
            todos os arquivos serão substituídos. O sistema cria uma cópia de segurança automática
            dos dados atuais antes de restaurar.
          </p>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 border-dashed cursor-pointer transition-colors ${
                  restoring
                    ? "opacity-60 cursor-not-allowed border-border text-muted-foreground"
                    : "border-amber-300 text-amber-700 hover:bg-amber-50"
                }`}
              >
                {restoring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {restoring
                  ? restorePhase === "uploading"
                    ? `Enviando... ${restoreProgress}%`
                    : "Restaurando no servidor..."
                  : "Selecionar arquivo .zip"}
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleRestoreFileSelect}
                  disabled={restoring}
                  className="hidden"
                />
              </label>
              {restoreDone && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Backup restaurado com sucesso!
                </span>
              )}
            </div>
            {restoring && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{restorePhase === "uploading" ? "Enviando arquivo para o servidor..." : "Restaurando banco de dados e arquivos..."}</span>
                  {restorePhase === "uploading" && <span>{restoreProgress}%</span>}
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  {restorePhase === "processing" ? (
                    <div className="h-full bg-amber-500 rounded-full animate-pulse w-full" />
                  ) : (
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${restoreProgress}%` }}
                    />
                  )}
                </div>
                {restorePhase === "processing" && (
                  <p className="text-xs text-muted-foreground italic">Extraindo e aplicando backup. Não feche esta página...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Modal de confirmação de restauração */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-foreground">Confirmar restauração</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Todos os dados atuais (inscrições, formulários, arquivos) serão substituídos pelo conteúdo do backup.
              Uma cópia de segurança dos dados atuais será criada automaticamente.
            </p>
            <p className="text-xs text-muted-foreground">
              Arquivo: <strong>{restoreFile?.name}</strong>
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowRestoreConfirm(false); setRestoreFile(null); if (restoreInputRef.current) restoreInputRef.current.value = ""; }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
