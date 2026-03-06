import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  Plus,
  GripVertical,
  Pencil,
  List,
  ToggleLeft,
  ToggleRight,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiListForms,
  apiUpdateForm,
  apiReorderForms,
  type FormRow,
} from "@/api/admin";

// ─── AdminLayout ──────────────────────────────────────────────────────────────

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

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
          <Link to="/admin/dashboard" className="text-sm text-white/80 hover:text-white transition-colors">Inscrições</Link>
          <Link to="/admin/forms" className="text-sm text-white font-semibold border-b border-white/60 pb-0.5">Turmas</Link>
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
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

// ─── SortableFormRow ──────────────────────────────────────────────────────────

function SortableFormRow({
  form,
  onToggle,
  onCopySlug,
  copiedSlug,
}: {
  form: FormRow;
  onToggle: (id: number, current: number) => void;
  onCopySlug: (slug: string) => void;
  copiedSlug: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: form.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl border border-border shadow-sm flex items-center gap-3 px-4 py-3 group"
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Status toggle */}
      <button
        onClick={() => onToggle(form.id, form.is_active)}
        title={form.is_active ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
        className="shrink-0"
      >
        {form.is_active ? (
          <ToggleRight className="w-6 h-6 text-green-500" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-muted-foreground/40" />
        )}
      </button>

      {/* Title & slug */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{form.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {form.slug ? (
            <>
              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                {form.slug}
              </code>
              <button
                onClick={() => form.slug && onCopySlug(form.slug)}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title="Copiar slug"
              >
                {copiedSlug === form.slug ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <span className="text-xs text-muted-foreground/50">
                → /inscricao/{form.slug}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/40 italic">sem slug</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/admin/dashboard?formId=${form.id}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
          title="Ver inscrições desta turma"
        >
          <List className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Inscrições</span>
        </Link>
        <Link
          to={`/admin/forms/${form.id}`}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg font-medium"
          title="Editar formulário"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Editar</span>
        </Link>
      </div>
    </div>
  );
}

// ─── FormsPage ────────────────────────────────────────────────────────────────

export default function FormsPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!accessToken) return;
    apiListForms(accessToken)
      .then((data) => {
        setForms([...data].sort((a, b) => a.display_order - b.display_order));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleToggle(id: number, currentActive: number) {
    if (!accessToken) return;
    const newActive = currentActive === 1 ? false : true;
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_active: newActive ? 1 : 0 } : f))
    );
    try {
      await apiUpdateForm(accessToken, id, { is_active: newActive });
      showToast(newActive ? "Turma ativada ✓" : "Turma desativada ✓");
    } catch {
      // revert
      setForms((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_active: currentActive } : f))
      );
      showToast("Erro ao atualizar status");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !accessToken) return;

    const oldIndex = forms.findIndex((f) => f.id === active.id);
    const newIndex = forms.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(forms, oldIndex, newIndex);

    // Optimistic update
    setForms(reordered);

    // Persist
    try {
      await apiReorderForms(
        accessToken,
        reordered.map((f, i) => ({ id: f.id, display_order: i }))
      );
      showToast("Ordem salva ✓");
    } catch {
      // revert
      setForms(forms);
      showToast("Erro ao salvar ordem");
    }
  }

  function handleCopySlug(slug: string) {
    navigator.clipboard.writeText(`/inscricao/${slug}`).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  return (
    <AdminLayout>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Turmas & Formulários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Arraste para reordenar os cards na landing page. Clique em Editar para gerenciar campos.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/forms/new")}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Turma
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando formulários...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-semibold mb-2">Nenhum formulário cadastrado</p>
          <p className="text-sm">Clique em "Nova Turma" para começar.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <GripVertical className="w-3.5 h-3.5" />
            A ordem abaixo determina a posição dos cards na landing page
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={forms.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {forms.map((form) => (
                  <SortableFormRow
                    key={form.id}
                    form={form}
                    onToggle={handleToggle}
                    onCopySlug={handleCopySlug}
                    copiedSlug={copiedSlug}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </AdminLayout>
  );
}
