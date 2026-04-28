import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, Loader2, UserPlus, X, ArrowRightLeft, CheckSquare, Square, School, Trash2, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  apiListTurmas,
  apiGetTurma,
  apiListUnassignedApproved,
  apiListSchools,
  apiEnrollStudent,
  apiEnrollStudentsBulk,
  apiEnrollBySchool,
  apiEnrollByProtocols,
  apiRemoveStudent,
  apiTransferStudent,
  type TurmaDetail,
  type TurmaRow,
  type UnassignedApprovedStudent,
} from "@/api/turmas";
import { AdminLayout } from "./AdminLayout";

export default function TurmaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [turma, setTurma] = useState<TurmaDetail | null>(null);
  const [allTurmas, setAllTurmas] = useState<TurmaRow[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedApprovedStudent[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "pendente" | "aprovado" | "rejeitado">("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterTurno, setFilterTurno] = useState("");  const [filterFormId, setFilterFormId] = useState<number | "">("" );  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Enrolled students filters
  const [searchEnrolled, setSearchEnrolled] = useState("");
  const [filterEnrolledStatus, setFilterEnrolledStatus] = useState<"" | "pendente" | "aprovado" | "rejeitado">("" );
  const [filterEnrolledSchool, setFilterEnrolledSchool] = useState("");
  const [filterEnrolledTurno, setFilterEnrolledTurno] = useState("");
  const [removeAllBusy, setRemoveAllBusy] = useState(false);

  // Protocol modal state
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);
  const [protocolText, setProtocolText] = useState("");
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [protocolResult, setProtocolResult] = useState<{ enrolled: number; errors: { protocol: string; message: string }[] } | null>(null);

  async function load() {
    if (!accessToken || !id) return;
    setLoading(true);
    setError("");

    try {
      const turmaId = Number(id);
      const [turmaResult, unassignedResult, turmasResult, schoolsResult] = await Promise.all([
        apiGetTurma(accessToken, turmaId),
        apiListUnassignedApproved(accessToken),
        apiListTurmas(accessToken),
        apiListSchools(accessToken),
      ]);
      setTurma(turmaResult);
      setUnassigned(unassignedResult);
      setAllTurmas(turmasResult);
      setSchools(schoolsResult);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar turma.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken, id]);

  const filteredUnassigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unassigned.filter((s) => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterSchool && (s.escola_canonical ?? s.escola ?? "") !== filterSchool) return false;
      if (filterTurno && (s.turno ?? "") !== filterTurno) return false;
      if (filterFormId !== "" && s.form_id !== filterFormId) return false;
      if (!q) return true;
      const name = (s.nome_completo ?? "").toLowerCase();
      const school = (s.escola ?? "").toLowerCase();
      return name.includes(q) || school.includes(q) || s.protocol.toLowerCase().includes(q);
    });
  }, [unassigned, search, filterStatus, filterSchool, filterTurno, filterFormId]);

  const filteredEnrolled = useMemo(() => {
    if (!turma) return [];
    const q = searchEnrolled.trim().toLowerCase();
    return turma.students.filter((s) => {
      if (filterEnrolledStatus && s.status !== filterEnrolledStatus) return false;
      if (filterEnrolledSchool && (s.escola_canonical ?? s.escola ?? "") !== filterEnrolledSchool) return false;
      if (filterEnrolledTurno && (s.turno ?? "") !== filterEnrolledTurno) return false;
      if (!q) return true;
      const name = (s.nome_completo ?? "").toLowerCase();
      const school = (s.escola ?? "").toLowerCase();
      return name.includes(q) || school.includes(q) || s.protocol.toLowerCase().includes(q);
    });
  }, [turma, searchEnrolled, filterEnrolledStatus, filterEnrolledSchool, filterEnrolledTurno]);

  // Derived option lists
  const unassignedFormOptions = useMemo(() => {
    const seen = new Set<number>();
    return unassigned
      .filter((s) => { if (seen.has(s.form_id)) return false; seen.add(s.form_id); return true; })
      .map((s) => ({ id: s.form_id, title: s.form_title }))
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [unassigned]);

  const unassignedSchoolOptions = useMemo(() => {
    const seen = new Set<string>();
    return unassigned
      .map((s) => s.escola_canonical ?? s.escola ?? "")
      .filter((v) => { if (!v || seen.has(v)) return false; seen.add(v); return true; })
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [unassigned]);

  const unassignedTurnoOptions = useMemo(() => {
    const seen = new Set<string>();
    return unassigned
      .map((s) => s.turno ?? "")
      .filter((v) => { if (!v || seen.has(v)) return false; seen.add(v); return true; })
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [unassigned]);

  const enrolledSchoolOptions = useMemo(() => {
    if (!turma) return [];
    const seen = new Set<string>();
    return turma.students
      .map((s) => s.escola_canonical ?? s.escola ?? "")
      .filter((v) => { if (!v || seen.has(v)) return false; seen.add(v); return true; })
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [turma]);

  const enrolledTurnoOptions = useMemo(() => {
    if (!turma) return [];
    const seen = new Set<string>();
    return turma.students
      .map((s) => s.turno ?? "")
      .filter((v) => { if (!v || seen.has(v)) return false; seen.add(v); return true; })
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [turma]);

  const targetTurmas = useMemo(() => {
    if (!turma) return [];
    return allTurmas.filter((t) => t.id !== turma.id && t.is_active === 1);
  }, [allTurmas, turma]);

  async function handleEnroll(submissionId: number) {
    if (!accessToken || !turma) return;
    setBusyId(submissionId);
    try {
      await apiEnrollStudent(accessToken, turma.id, submissionId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alocar aluno.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(submissionId: number) {
    if (!accessToken || !turma) return;
    setBusyId(submissionId);
    try {
      await apiRemoveStudent(accessToken, turma.id, submissionId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover aluno.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTransfer(submissionId: number, toTurmaId: number) {
    if (!accessToken || !turma) return;
    setBusyId(submissionId);
    try {
      await apiTransferStudent(accessToken, turma.id, submissionId, toTurmaId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao transferir aluno.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkEnroll() {
    if (!accessToken || !turma || selected.size === 0) return;
    setBulkLoading(true);
    setError("");
    try {
      const result = await apiEnrollStudentsBulk(accessToken, turma.id, [...selected]);
      if (result.errors.length > 0) {
        setError(`${result.enrolled} aluno(s) adicionado(s). ${result.errors.length} falharam.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alocar alunos.");
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredUnassigned.length && filteredUnassigned.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredUnassigned.map((s) => s.submission_id)));
    }
  }

  async function handleEnrollByProtocols() {
    if (!accessToken || !turma) return;
    const protocols = protocolText
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (protocols.length === 0) return;
    setProtocolLoading(true);
    setProtocolResult(null);
    try {
      const result = await apiEnrollByProtocols(accessToken, turma.id, protocols);
      setProtocolResult(result);
      if (result.enrolled > 0) void load();
    } catch (e) {
      setProtocolResult({ enrolled: 0, errors: [{ protocol: "—", message: e instanceof Error ? e.message : "Erro desconhecido" }] });
    } finally {
      setProtocolLoading(false);
    }
  }

  async function handleEnrollBySchool(schoolName: string) {
    if (!accessToken || !turma) return;
    setSchoolLoading(true);
    setError("");
    try {
      const result = await apiEnrollBySchool(accessToken, turma.id, schoolName, turma.form_id ?? undefined);
      if (result.errors.length > 0) {
        setError(`${result.enrolled} aluno(s) adicionado(s) da escola. ${result.errors.length} falharam.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alocar escola.");
    } finally {
      setSchoolLoading(false);
    }
  }

  async function handleRemoveAll() {
    if (!accessToken || !turma || filteredEnrolled.length === 0) return;
    if (!window.confirm(`Remover ${filteredEnrolled.length} aluno(s) da turma? Esta ação não pode ser desfeita.`)) return;
    setRemoveAllBusy(true);
    setError("");
    try {
      for (const student of filteredEnrolled) {
        await apiRemoveStudent(accessToken, turma.id, student.submission_id);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover alunos.");
    } finally {
      setRemoveAllBusy(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando turma...
        </div>
      </AdminLayout>
    );
  }

  if (!turma) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <p className="text-sm text-destructive">{error || "Turma não encontrada."}</p>
          <Link to="/admin/turmas" className="text-sm text-primary hover:underline">Voltar para turmas</Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="bg-white border border-border rounded-xl p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{turma.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{turma.form_title ?? "Sem formulário base"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {turma.school_name || "Escola não definida"}
              {turma.day_of_week ? ` · ${turma.day_of_week}` : ""}
              {turma.start_time || turma.end_time ? ` · ${turma.start_time ?? "--:--"} às ${turma.end_time ?? "--:--"}` : ""}
            </p>
            {turma.responsavel && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <School className="w-3.5 h-3.5" />
                {turma.responsavel}
              </p>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {turma.enrolled_count}/{turma.max_capacity} alunos
          </div>
        </div>
      </div>

      {schools.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4 mb-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <School className="w-4 h-4" />
            Alocar todos os alunos de uma escola
          </h2>
          <div className="flex flex-wrap gap-2">
            {schools.map((school) => (
              <button
                key={school}
                type="button"
                onClick={() => handleEnrollBySchool(school)}
                disabled={schoolLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-primary/5 hover:border-primary/30 disabled:opacity-50 transition-colors"
              >
                {schoolLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                {school}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 className="text-base font-bold text-foreground">
              Alunos na turma
              {filteredEnrolled.length !== turma.students.length && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({filteredEnrolled.length} de {turma.students.length})
                </span>
              )}
            </h2>
            {filteredEnrolled.length > 0 && (
              <button
                type="button"
                onClick={handleRemoveAll}
                disabled={removeAllBusy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 rounded-md text-xs hover:bg-red-50 disabled:opacity-50"
              >
                {removeAllBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Remover {filteredEnrolled.length === turma.students.length ? "todos" : `${filteredEnrolled.length} filtrado${filteredEnrolled.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>

          {turma.students.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                value={searchEnrolled}
                onChange={(e) => setSearchEnrolled(e.target.value)}
                placeholder="Buscar por nome ou protocolo"
                className="col-span-2 border border-border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={filterEnrolledStatus}
                onChange={(e) => setFilterEnrolledStatus(e.target.value as typeof filterEnrolledStatus)}
                className="border border-border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Todos os status</option>
                <option value="aprovado">Deferido</option>
                <option value="pendente">Pendente</option>
                <option value="rejeitado">Indeferido</option>
              </select>
              {enrolledSchoolOptions.length > 0 && (
                <select
                  value={filterEnrolledSchool}
                  onChange={(e) => setFilterEnrolledSchool(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Todas as escolas</option>
                  {enrolledSchoolOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {enrolledTurnoOptions.length > 0 && (
                <select
                  value={filterEnrolledTurno}
                  onChange={(e) => setFilterEnrolledTurno(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Todos os turnos</option>
                  {enrolledTurnoOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
          )}

          {turma.students.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno alocado ainda.</p>
          ) : filteredEnrolled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado com esse filtro.</p>
          ) : (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {filteredEnrolled.map((student) => (
                <div key={student.submission_id} className="border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/admin/submissions/${student.submission_id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary"
                        >
                          {student.nome_completo || "Sem nome"}
                        </Link>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          student.status === "aprovado" ? "bg-green-100 text-green-700"
                          : student.status === "pendente" ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {student.status === "aprovado" ? "Deferido" : student.status === "pendente" ? "Pendente" : "Indeferido"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{student.protocol} · {student.escola_canonical ?? student.escola ?? "Escola não informada"}</p>
                      {student.turno && <p className="text-xs text-muted-foreground">Turno: {student.turno}</p>}
                    </div>
                    <button
                      onClick={() => handleRemove(student.submission_id)}
                      disabled={busyId === student.submission_id || removeAllBusy}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-600 rounded-md text-xs hover:bg-red-50 disabled:opacity-50 shrink-0"
                    >
                      {busyId === student.submission_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      Remover
                    </button>
                  </div>

                  {targetTurmas.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3" /> Transferir:
                      </span>
                      <select
                        className="text-xs border border-border rounded px-2 py-1"
                        defaultValue=""
                        onChange={(e) => {
                          const toId = Number(e.target.value);
                          if (!toId) return;
                          void handleTransfer(student.submission_id, toId);
                        }}
                      >
                        <option value="">Selecionar turma</option>
                        {targetTurmas.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground">Sem turma</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setProtocolModalOpen(true); setProtocolText(""); setProtocolResult(null); }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-border text-foreground rounded-md text-xs hover:bg-muted"
              >
                <ClipboardList className="w-3 h-3" />
                Por protocolo
              </button>
            {filteredUnassigned.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {selected.size === filteredUnassigned.length && filteredUnassigned.length > 0
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />}
                  Selecionar todos
                </button>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkEnroll}
                    disabled={bulkLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    Adicionar {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, protocolo ou escola"
              className="col-span-2 border border-border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="border border-border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="aprovado">Deferido</option>
              <option value="pendente">Pendente</option>
              <option value="rejeitado">Indeferido</option>
            </select>
            {unassignedSchoolOptions.length > 0 && (
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className="border border-border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Todas as escolas</option>
                {unassignedSchoolOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {unassignedTurnoOptions.length > 0 && (
              <select
                value={filterTurno}
                onChange={(e) => setFilterTurno(e.target.value)}
                className="border border-border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Todos os turnos</option>
                {unassignedTurnoOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {unassignedFormOptions.length > 1 && (
              <select
                value={filterFormId}
                onChange={(e) => setFilterFormId(e.target.value === "" ? "" : Number(e.target.value))}
                className="border border-border rounded-lg px-2 py-1.5 text-sm col-span-2"
              >
                <option value="">Todos os formulários</option>
                {unassignedFormOptions.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            )}
          </div>

          {filteredUnassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno disponível com esse filtro.</p>
          ) : (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {filteredUnassigned.map((student) => (
                <div
                  key={student.submission_id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selected.has(student.submission_id)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                  onClick={() => toggleSelect(student.submission_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        {selected.has(student.submission_id)
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/admin/submissions/${student.submission_id}`}
                            className="text-sm font-semibold text-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {student.nome_completo || "Sem nome"}
                          </Link>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              student.status === "aprovado"
                                ? "bg-green-100 text-green-700"
                                : student.status === "pendente"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {student.status === "aprovado"
                              ? "Deferido"
                              : student.status === "pendente"
                              ? "Pendente"
                              : "Indeferido"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{student.protocol} · {student.form_title}</p>
                        <p className="text-xs text-muted-foreground">{student.escola || "Escola não informada"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnroll(student.submission_id);
                      }}
                      disabled={busyId === student.submission_id}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-primary/30 text-primary rounded-md text-xs hover:bg-primary/5 disabled:opacity-50 shrink-0"
                    >
                      {busyId === student.submission_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                      Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Protocol modal */}
      {protocolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Adicionar por protocolo</h3>
              <button
                type="button"
                onClick={() => setProtocolModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Cole um protocolo por linha. Os alunos encontrados serão adicionados à turma.
            </p>

            <textarea
              value={protocolText}
              onChange={(e) => setProtocolText(e.target.value)}
              placeholder={"PROT-2026-0001\nPROT-2026-0002\nPROT-2026-0003"}
              rows={8}
              className="border border-border rounded-lg px-3 py-2 text-sm font-mono resize-y w-full"
              disabled={protocolLoading}
            />

            {protocolResult && (
              <div className="text-sm space-y-1">
                <p className="text-green-700 font-medium">{protocolResult.enrolled} aluno{protocolResult.enrolled !== 1 ? "s" : ""} adicionado{protocolResult.enrolled !== 1 ? "s" : ""}.</p>
                {protocolResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-0.5 max-h-40 overflow-y-auto">
                    {protocolResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-700">
                        <span className="font-mono font-medium">{e.protocol}</span>
                        {e.protocol && e.protocol !== "—" ? ": " : " "}{e.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProtocolModalOpen(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleEnrollByProtocols}
                disabled={protocolLoading || protocolText.trim() === ""}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {protocolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
