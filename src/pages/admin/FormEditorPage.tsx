import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bot,
  LogOut,
  ChevronLeft,
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Save,
  Eye,
  EyeOff,
  Loader2,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  GripHorizontal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiGetAdminForm,
  apiCreateForm,
  apiUpdateForm,
  apiCreateField,
  apiUpdateField,
  apiDeleteField,
  apiReorderFields,
  type AdminFormWithFields,
  type AdminField,
} from "@/api/admin";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text",     label: "Texto curto",     icon: "Aa" },
  { value: "textarea", label: "Texto longo",      icon: "¶" },
  { value: "date",     label: "Data",             icon: "📅" },
  { value: "cpf",      label: "CPF",              icon: "🪪" },
  { value: "tel",      label: "Telefone",         icon: "📞" },
  { value: "email",    label: "E-mail",           icon: "✉️" },
  { value: "number",   label: "Número",           icon: "#" },
  { value: "radio",    label: "Múltipla escolha", icon: "🔘" },
  { value: "select",   label: "Lista suspensa",   icon: "▾" },
  { value: "file",     label: "Upload de arquivo", icon: "📎" },
] as const;

const HAS_OPTIONS = ["radio", "select"];
const HAS_PLACEHOLDER = ["text", "textarea", "tel", "email", "number", "cpf", "date"];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navLink = (to: string, label: string, matchPrefixes: string[]) => {
    const isActive = matchPrefixes.some((p) => pathname.startsWith(p));
    return (
      <Link
        to={to}
        className={`text-sm transition-colors ${
          isActive
            ? "text-white font-semibold border-b border-white/60 pb-0.5"
            : "text-white/80 hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  async function handleLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[hsl(var(--navy))] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-secondary" />
          <span className="font-bold text-base">Painel Admin</span>
          <span className="text-white/40 hidden sm:inline">·</span>
          <span className="text-white/70 text-sm hidden sm:inline">Programa de Robótica</span>
        </div>
        <nav className="flex items-center gap-4">
          {navLink("/admin/dashboard", "Inscrições", ["/admin/dashboard", "/admin/submissions"])}
          {navLink("/admin/forms", "Turmas", ["/admin/forms"])}
          <span className="text-white/30">|</span>
          <span className="text-sm text-white/70 hidden sm:inline">{admin?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </nav>
      </header>
      <div>{children}</div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 ${
      type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "ok" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── FieldEditor ──────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: Partial<AdminField> & { _tmpId?: string };
  formId: number;
  onSave: (saved: AdminField) => void;
  onCancel: () => void;
  token: string;
  nextOrder: number;
}

function FieldEditor({ field, formId, onSave, onCancel, token, nextOrder }: Omit<FieldEditorProps, "totalFields">) {
  const isNew = !field.id;
  const [type, setType] = useState(field.type ?? "text");
  const [label, setLabel] = useState(field.label ?? "");
  const [name, setName] = useState(field.name ?? "");
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "");
  const [required, setRequired] = useState(field.required ?? true);
  const [options, setOptions] = useState<string[]>(field.options ?? ["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    labelRef.current?.focus();
  }, []);

  // Auto-set name when label changes (only for new fields)
  useEffect(() => {
    if (isNew && label) setName(slugify(label));
  }, [label, isNew]);

  // Reset options when type changes
  useEffect(() => {
    if (!HAS_OPTIONS.includes(type) && options.length > 0 && isNew) {
      setOptions(["", ""]);
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOptionChange(i: number, val: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  }

  function handleAddOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function handleRemoveOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!label.trim()) { setError("O label é obrigatório."); return; }
    if (!name.trim() || !/^[a-z0-9_]+$/.test(name)) {
      setError("O nome interno deve conter apenas letras minúsculas, números e _");
      return;
    }
    if (HAS_OPTIONS.includes(type)) {
      const filtered = options.filter((o) => o.trim());
      if (filtered.length < 2) { setError("Adicione pelo menos 2 opções."); return; }
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        type,
        label: label.trim(),
        name: name.trim(),
        placeholder: placeholder.trim() || undefined,
        required,
        options: HAS_OPTIONS.includes(type) ? options.filter((o) => o.trim()) : undefined,
        order: field.field_order ?? nextOrder,
      };
      let saved: AdminField;
      if (isNew) {
        saved = await apiCreateField(token, formId, payload);
      } else {
        saved = await apiUpdateField(token, formId, field.id!, payload);
      }
      onSave(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar campo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      {/* Type */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo do campo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Label (visível ao aluno) *</label>
        <input
          ref={labelRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Nome Completo do Aluno"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
        />
      </div>

      {/* Internal name */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          Nome interno <span className="font-normal text-muted-foreground/60">(somente letras, números e _)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          placeholder="nome_do_campo"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background font-mono"
        />
      </div>

      {/* Placeholder */}
      {HAS_PLACEHOLDER.includes(type) && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Placeholder (dica dentro do campo)</label>
          <input
            type="text"
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            placeholder="Ex: Digite aqui..."
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
          />
        </div>
      )}

      {/* Required toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setRequired((v) => !v)}
          className="flex items-center gap-1.5 text-sm"
          type="button"
        >
          {required ? (
            <ToggleRight className="w-5 h-5 text-primary" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-muted-foreground/40" />
          )}
          <span className={required ? "text-foreground font-medium" : "text-muted-foreground"}>
            {required ? "Obrigatório" : "Opcional"}
          </span>
        </button>
      </div>

      {/* Options */}
      {HAS_OPTIONS.includes(type) && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Opções</label>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                  className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background"
                />
                {options.length > 2 && (
                  <button onClick={() => handleRemoveOption(i)} type="button" className="text-muted-foreground/50 hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddOption}
              type="button"
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar opção
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {isNew ? "Adicionar campo" : "Salvar campo"}
        </button>
        <button
          onClick={onCancel}
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── SortableFieldCard ────────────────────────────────────────────────────────

function SortableFieldCard({
  field,
  editingId,
  onEdit,
  onDelete,
  children,
}: {
  field: AdminField;
  editingId: number | null;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`bg-white rounded-xl border ${editingId === field.id ? "border-primary/40 shadow-md" : "border-border shadow-sm"} overflow-hidden`}>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Drag */}
          <button
            {...listeners}
            {...attributes}
            className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Type icon */}
          <span className="text-sm w-6 text-center select-none">{typeInfo?.icon ?? "?"}</span>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{field.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{field.name}</p>
          </div>

          {/* Required badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${field.required ? "bg-red-50 border-red-200 text-red-700" : "bg-muted/50 border-border text-muted-foreground"}`}>
            {field.required ? "obrigatório" : "opcional"}
          </span>

          {/* Actions */}
          <button
            onClick={() => onEdit(field.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Editar campo"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(field.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remover campo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inline editor */}
        {editingId === field.id && children && (
          <div className="border-t border-primary/20 px-4 pb-4 pt-3">{children}</div>
        )}
      </div>
    </div>
  );
}

// ─── LivePreview ──────────────────────────────────────────────────────────────

function LivePreview({ title, fields }: { title: string; fields: AdminField[] }) {
  return (
    <div className="bg-muted/30 rounded-2xl border border-border p-1 overflow-auto max-h-[calc(100vh-180px)] sticky top-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" /> Preview — como o aluno vai ver
      </p>
      <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
        {/* Form header */}
        <div className="bg-primary px-5 py-4">
          <h2 className="text-white font-bold text-base">{title || "Título do formulário"}</h2>
        </div>
        <div className="p-4 space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Adicione campos ao formulário</p>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <PreviewInput field={field} />
              </div>
            ))
          )}
          {fields.length > 0 && (
            <button
              disabled
              className="w-full bg-primary text-primary-foreground text-sm font-bold py-2.5 rounded-full opacity-60 cursor-not-allowed mt-2"
            >
              Enviar inscrição
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewInput({ field }: { field: AdminField }) {
  const base = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-muted/30 text-muted-foreground cursor-not-allowed";
  if (field.type === "textarea") {
    return <textarea disabled rows={3} placeholder={field.placeholder ?? ""} className={`${base} resize-none`} />;
  }
  if (field.type === "select") {
    return (
      <select disabled className={base}>
        <option value="">Selecione...</option>
        {(field.options ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "radio") {
    return (
      <div className="space-y-1.5">
        {(field.options ?? []).map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm text-muted-foreground cursor-not-allowed">
            <input type="radio" disabled className="accent-primary" /> {o}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "file") {
    return (
      <div className={`${base} flex items-center gap-2 opacity-60`}>
        <GripHorizontal className="w-4 h-4" /> Escolher arquivo (PDF ou imagem)
      </div>
    );
  }
  const inputType = field.type === "cpf" ? "text" : field.type;
  return (
    <input
      type={inputType}
      disabled
      placeholder={field.placeholder ?? ""}
      className={base}
    />
  );
}

// ─── FormEditorPage ───────────────────────────────────────────────────────────

type EditingState =
  | { kind: "none" }
  | { kind: "existing"; id: number }
  | { kind: "new" };

export default function FormEditorPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const isNew = routeId === "new";
  const formId = isNew ? null : Number(routeId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [form, setForm] = useState<AdminFormWithFields | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  // Local editable state (unsaved)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cardLevel, setCardLevel] = useState("");
  const [cardTurno, setCardTurno] = useState("");
  const [cardSubtitle, setCardSubtitle] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<AdminField[]>([]);
  const [dirty, setDirty] = useState(false);

  // UI state
  const [editing, setEditing] = useState<EditingState>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [confirmDeleteField, setConfirmDeleteField] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Load existing form
  useEffect(() => {
    if (isNew || !formId || !accessToken) return;
    apiGetAdminForm(accessToken, formId)
      .then((data) => {
        setForm(data);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setCardLevel(data.card_level ?? "");
        setCardTurno(data.card_turno ?? "");
        setCardSubtitle(data.card_subtitle ?? "");
        setIsActive(data.is_active === 1);
        setFields([...data.fields].sort((a, b) => a.field_order - b.field_order));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isNew, formId, accessToken]);

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Save form metadata
  const handleSaveForm = useCallback(async () => {
    if (!accessToken) return;
    if (!title.trim()) { showToast("O título é obrigatório.", "err"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const created = await apiCreateForm(accessToken, { title: title.trim(), description: description.trim() || undefined });
        showToast("Formulário criado ✓");
        navigate(`/admin/forms/${created.id}`, { replace: true });
      } else {
        const updated = await apiUpdateForm(accessToken, formId!, {
          title: title.trim(),
          description: description.trim() || undefined,
          is_active: isActive,
          card_level: cardLevel.trim() || null,
          card_turno: cardTurno.trim() || null,
          card_subtitle: cardSubtitle.trim() || null,
        });
        setForm((prev) => prev ? { ...prev, ...updated } : prev);
        setDirty(false);
        showToast("Salvo ✓");
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Erro ao salvar.", "err");
    } finally {
      setSaving(false);
    }
  }, [accessToken, isNew, formId, title, description, cardLevel, cardTurno, cardSubtitle, isActive, navigate]);

  // Drag-end for fields
  async function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !accessToken || !formId) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);
    try {
      await apiReorderFields(
        accessToken,
        formId,
        reordered.map((f, i) => ({ id: f.id, order: i }))
      );
    } catch {
      showToast("Erro ao reordenar campos.", "err");
    }
  }

  // Delete field
  async function handleDeleteField(id: number) {
    if (!accessToken || !formId) return;
    try {
      await apiDeleteField(accessToken, formId, id);
      setFields((prev) => prev.filter((f) => f.id !== id));
      showToast("Campo removido ✓");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Erro ao remover campo.", "err");
    } finally {
      setConfirmDeleteField(null);
    }
  }

  // Field saved callback
  function handleFieldSaved(saved: AdminField) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    setEditing({ kind: "none" });
    showToast("Campo salvo ✓");
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando formulário...</span>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="max-w-lg mx-auto mt-16 bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-sm">
          <p className="font-semibold mb-1">Erro ao carregar formulário</p>
          <p>{error}</p>
          <Link to="/admin/forms" className="mt-4 inline-flex items-center gap-1 text-red-700 underline text-sm">
            ← Voltar para lista
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const editorContent = (
    <div className="space-y-6">
      {/* ── Metadata section ── */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="bg-primary px-5 py-1.5">
          <div className="h-1.5 w-12 bg-white/30 rounded-full" />
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              Título exibido no card da landing page *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              placeholder="Ex: Fundamental I"
              className="w-full text-lg font-bold border-0 border-b-2 border-border focus:border-primary outline-none bg-transparent py-1 text-foreground transition-colors"
            />
          </div>

          {/* Card display fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                Nível
              </label>
              <input
                type="text"
                value={cardLevel}
                onChange={(e) => { setCardLevel(e.target.value); setDirty(true); }}
                placeholder="Ex: Fundamental I"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                Turno <span className="font-normal normal-case text-primary">(Manhã / Tarde / Tarde Avançada)</span>
              </label>
              <input
                type="text"
                value={cardTurno}
                onChange={(e) => { setCardTurno(e.target.value); setDirty(true); }}
                placeholder="Ex: Manhã"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                Subtítulo
              </label>
              <input
                type="text"
                value={cardSubtitle}
                onChange={(e) => { setCardSubtitle(e.target.value); setDirty(true); }}
                placeholder="Ex: 3º ao 5º Ano • Matutino"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              Descrição do card
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
              placeholder="Breve descrição exibida no card de inscrição da landing page..."
              rows={2}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          {form?.slug && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold">URL de inscrição:</span>
              <code className="bg-muted px-2 py-0.5 rounded font-mono">/inscricao/{form.slug}</code>
            </div>
          )}
        </div>
      </div>

      {/* ── Fields section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
            Campos do formulário
            <span className="ml-2 text-xs font-normal text-muted-foreground normal-case">
              ({fields.length} campo{fields.length !== 1 ? "s" : ""})
            </span>
          </h2>
        </div>

        {fields.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFieldDragEnd}
          >
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {fields.map((field) => (
                  <SortableFieldCard
                    key={field.id}
                    field={field}
                    editingId={editing.kind === "existing" ? editing.id : null}
                    onEdit={(id) =>
                      setEditing((prev) =>
                        prev.kind === "existing" && prev.id === id
                          ? { kind: "none" }
                          : { kind: "existing", id }
                      )
                    }
                    onDelete={(id) => setConfirmDeleteField(id)}
                  >
                    {editing.kind === "existing" && editing.id === field.id && accessToken && formId && (
                      <FieldEditor
                      field={field}
                      formId={formId}
                      token={accessToken}
                      nextOrder={fields.length}
                      onSave={handleFieldSaved}
                      onCancel={() => setEditing({ kind: "none" })}
                    />
                    )}
                  </SortableFieldCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* New field editor */}
        {editing.kind === "new" && accessToken && formId && (
          <FieldEditor
            field={{}}
            formId={formId}
            token={accessToken}
            nextOrder={fields.length}
            onSave={handleFieldSaved}
            onCancel={() => setEditing({ kind: "none" })}
          />
        )}

        {/* Add field button */}
        {editing.kind !== "new" && !isNew && (
          <button
            onClick={() => setEditing({ kind: "new" })}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-primary text-sm py-3 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar campo
          </button>
        )}

        {isNew && fields.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Salve o formulário primeiro para começar a adicionar campos.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Delete confirmation dialog */}
      {confirmDeleteField !== null && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-foreground">Remover campo?</h3>
            <p className="text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. Dados já enviados por alunos para este campo{" "}
              <strong>não serão apagados</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteField(confirmDeleteField)}
                className="flex-1 bg-red-500 text-white text-sm font-semibold py-2 rounded-xl hover:bg-red-600 transition-colors"
              >
                Sim, remover
              </button>
              <button
                onClick={() => setConfirmDeleteField(null)}
                className="flex-1 border border-border text-sm py-2 rounded-xl hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ── Sticky header ── */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/admin/forms"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Link>
            <span className="text-muted-foreground/30">/</span>
            <h1 className="text-lg font-bold text-foreground truncate">
              {isNew ? "Nova Turma" : (title || "Editor de formulário")}
            </h1>
            {!isNew && (
              <button
                onClick={() => { setIsActive((v) => !v); setDirty(true); }}
                className="flex items-center gap-1 text-xs shrink-0"
                title="Ativar/desativar formulário"
              >
                {isActive ? (
                  <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-700 font-medium hidden sm:inline">Ativo</span></>
                ) : (
                  <><ToggleLeft className="w-5 h-5 text-muted-foreground/40" /><span className="text-muted-foreground hidden sm:inline">Inativo</span></>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && (
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl px-3 py-1.5 hover:bg-muted transition-colors"
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showPreview ? "Ocultar preview" : "Ver preview"}</span>
              </button>
            )}
            <button
              onClick={handleSaveForm}
              disabled={saving || (!dirty && !isNew)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-1.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isNew ? "Criar formulário" : "Salvar alterações"}
            </button>
          </div>
        </div>

        {/* ── Two-panel layout ── */}
        {!isNew && showPreview ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
            <div>{editorContent}</div>
            <div>
              <LivePreview title={title} fields={fields} />
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">{editorContent}</div>
        )}
      </div>
    </AdminLayout>
  );
}
