import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, AlertCircle, Users, School, Clock, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiListForms, type FormRow } from "@/api/admin";
import {
  apiListTurmas,
  apiCreateTurma,
  apiUpdateTurma,
  apiDeleteTurma,
  type TurmaRow,
} from "@/api/turmas";
import { AdminLayout } from "./AdminLayout";

type TurmaFormState = {
  name: string;
  form_id: string;
  school_name: string;
  responsavel: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  max_capacity: string;
  is_active: boolean;
};

const INITIAL_FORM: TurmaFormState = {
  name: "",
  form_id: "",
  school_name: "",
  responsavel: "",
  day_of_week: "",
  start_time: "",
  end_time: "",
  max_capacity: "20",
  is_active: true,
};

function TurmaModal({
  title,
  forms,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  title: string;
  forms: FormRow[];
  initial: TurmaFormState;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (state: TurmaFormState) => void;
}) {
  const [state, setState] = useState<TurmaFormState>(initial);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-xl p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-sm">
            <span className="text-muted-foreground">Nome da turma</span>
            <input
              value={state.name}
              onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
              placeholder="Ex: Fund. I - Manhã A"
            />
          </label>

          <label className="sm:col-span-2 text-sm">
            <span className="text-muted-foreground">Formulário base (opcional)</span>
            <select
              value={state.form_id}
              onChange={(e) => setState((prev) => ({ ...prev, form_id: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
            >
              <option value="">Sem vínculo fixo</option>
              {forms.map((form) => (
                <option key={form.id} value={String(form.id)}>{form.title}</option>
              ))}
            </select>
          </label>

          <label className="sm:col-span-2 text-sm">
            <span className="text-muted-foreground">Escola</span>
            <input
              value={state.school_name}
              onChange={(e) => setState((prev) => ({ ...prev, school_name: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
              placeholder="Ex: EMEF João da Silva"
            />
          </label>

          <label className="sm:col-span-2 text-sm">
            <span className="text-muted-foreground">Responsável / Professor</span>
            <input
              value={state.responsavel}
              onChange={(e) => setState((prev) => ({ ...prev, responsavel: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
              placeholder="Ex: Prof. Maria Souza"
            />
          </label>

          <label className="sm:col-span-2 text-sm">
            <span className="text-muted-foreground">Dias da semana</span>
            <input
              value={state.day_of_week}
              onChange={(e) => setState((prev) => ({ ...prev, day_of_week: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
              placeholder="Ex: Segunda e Quarta"
            />
          </label>

          <label className="text-sm">
            <span className="text-muted-foreground">Início</span>
            <input
              type="time"
              value={state.start_time}
              onChange={(e) => setState((prev) => ({ ...prev, start_time: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="text-muted-foreground">Fim</span>
            <input
              type="time"
              value={state.end_time}
              onChange={(e) => setState((prev) => ({ ...prev, end_time: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="text-muted-foreground">Capacidade</span>
            <input
              type="number"
              min={1}
              max={200}
              value={state.max_capacity}
              onChange={(e) => setState((prev) => ({ ...prev, max_capacity: e.target.value }))}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2"
            />
          </label>

          <label className="text-sm flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={state.is_active}
              onChange={(e) => setState((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            <span className="text-muted-foreground">Turma ativa</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(state)}
            disabled={saving || !state.name.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TurmasPage() {
  const { accessToken } = useAuth();

  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterFormId, setFilterFormId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("active");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<TurmaRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError("");

    try {
      const [formsResult, turmasResult] = await Promise.all([
        apiListForms(accessToken),
        apiListTurmas(accessToken),
      ]);
      setForms(formsResult);
      setTurmas(turmasResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar turmas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  const filteredTurmas = useMemo(() => {
    return turmas.filter((turma) => {
      if (filterFormId && turma.form_id !== Number(filterFormId)) return false;
      if (filterStatus === "active" && turma.is_active !== 1) return false;
      if (filterStatus === "inactive" && turma.is_active !== 0) return false;
      return true;
    });
  }, [turmas, filterFormId, filterStatus]);

  function toFormState(turma?: TurmaRow): TurmaFormState {
    if (!turma) return INITIAL_FORM;
    return {
      name: turma.name,
      form_id: turma.form_id ? String(turma.form_id) : "",
      school_name: turma.school_name ?? "",
      responsavel: turma.responsavel ?? "",
      day_of_week: turma.day_of_week ?? "",
      start_time: turma.start_time ?? "",
      end_time: turma.end_time ?? "",
      max_capacity: String(turma.max_capacity),
      is_active: turma.is_active === 1,
    };
  }

  async function handleSubmit(state: TurmaFormState) {
    if (!accessToken) return;
    setSaving(true);

    const payload = {
      name: state.name,
      form_id: state.form_id ? Number(state.form_id) : null,
      school_name: state.school_name || null,
      responsavel: state.responsavel || null,
      day_of_week: state.day_of_week || null,
      start_time: state.start_time || null,
      end_time: state.end_time || null,
      max_capacity: Number(state.max_capacity) || 20,
      is_active: state.is_active,
    };

    try {
      if (editingTurma) {
        await apiUpdateTurma(accessToken, editingTurma.id, payload);
      } else {
        await apiCreateTurma(accessToken, payload);
      }
      setModalOpen(false);
      setEditingTurma(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar turma.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(turma: TurmaRow) {
    if (!accessToken) return;
    const hasStudents = turma.enrolled_count > 0;
    const confirmed = window.confirm(
      hasStudents
        ? "Esta turma possui alunos. Deseja excluir mesmo assim e remover os vínculos?"
        : "Deseja excluir esta turma?"
    );
    if (!confirmed) return;

    try {
      await apiDeleteTurma(accessToken, turma.id, hasStudents);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir turma.");
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando turmas...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {modalOpen && (
        <TurmaModal
          title={editingTurma ? "Editar turma" : "Nova turma"}
          forms={forms}
          initial={toFormState(editingTurma ?? undefined)}
          saving={saving}
          onCancel={() => {
            setModalOpen(false);
            setEditingTurma(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie alocação de alunos deferidos, escola e horários.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTurma(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Nova turma
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-muted-foreground">Filtrar por formulário</span>
          <select
            value={filterFormId}
            onChange={(e) => setFilterFormId(e.target.value)}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2"
          >
            <option value="">Todos</option>
            {forms.map((form) => (
              <option key={form.id} value={String(form.id)}>{form.title}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-muted-foreground">Status da turma</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2"
          >
            <option value="active">Apenas ativas</option>
            <option value="inactive">Apenas inativas</option>
            <option value="all">Todas</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {filteredTurmas.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground">
          Nenhuma turma encontrada com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTurmas.map((turma) => {
            const occupancy = turma.max_capacity > 0
              ? Math.min(100, Math.round((turma.enrolled_count / turma.max_capacity) * 100))
              : 0;

            return (
              <div key={turma.id} className="bg-white border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/admin/turmas/${turma.id}`}
                      className="text-base font-bold text-foreground hover:text-primary transition-colors"
                    >
                      {turma.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">{turma.form_title ?? "Sem formulário base"}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      turma.is_active === 1
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {turma.is_active === 1 ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4" />
                    <span>{turma.school_name || "Escola não definida"}</span>
                  </div>
                  {turma.responsavel && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{turma.responsavel}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {turma.day_of_week || "Dias não definidos"}
                      {turma.start_time || turma.end_time
                        ? ` · ${turma.start_time ?? "--:--"} às ${turma.end_time ?? "--:--"}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{turma.enrolled_count}/{turma.max_capacity} alunos</span>
                  </div>
                </div>

                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${occupancy}%` }} />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingTurma(turma);
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(turma)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                  <Link
                    to={`/admin/turmas/${turma.id}`}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 border border-primary/30 text-primary rounded-lg text-xs hover:bg-primary/5"
                  >
                    Gerenciar alunos
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
