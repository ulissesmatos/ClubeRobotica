import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle, Phone, Instagram, MessageCircle, CalendarDays } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiGetSettings, apiUpdateSettings, type SiteSettingsAdmin } from "@/api/admin";
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
    </AdminLayout>
  );
}
