import { useState, useRef } from "react";
import { Search, CheckCircle2, Clock, BookOpen, Bot, Loader2, AlertCircle } from "lucide-react";
import { apiSearchResultados, type PublicResultRow } from "@/api/public";

function ResultCard({ r }: { r: PublicResultRow }) {
  const aprovado = r.resultado === "aprovado";

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 shadow-sm ${
        aprovado
          ? "border-green-200 bg-green-50"
          : "border-yellow-200 bg-yellow-50"
      }`}
    >
      {/* Badge + Nome */}
      <div className="flex items-start gap-3">
        {aprovado ? (
          <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 shrink-0" />
        ) : (
          <Clock className="w-6 h-6 text-yellow-600 mt-0.5 shrink-0" />
        )}
        <div>
          <p className="font-bold text-foreground text-base leading-tight">{r.nome_completo}</p>
          <span
            className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              aprovado
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {aprovado ? "APROVADO(A)" : "CADASTRO DE RESERVA"}
          </span>
        </div>
      </div>

      {/* Escola */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="w-4 h-4 shrink-0" />
        <span>{r.escola}</span>
      </div>

      {/* Turma (se alocado) */}
      {r.turma_name && (
        <div className="flex items-start gap-2 text-sm bg-white/70 border border-white rounded-lg px-3 py-2">
          <Bot className="w-4 h-4 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-foreground">{r.turma_name}</p>
            {(r.turma_day || r.turma_start) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[r.turma_day, r.turma_start && r.turma_end ? `${r.turma_start}–${r.turma_end}` : r.turma_start]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultadoPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicResultRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    setResults(null);

    try {
      const data = await apiSearchResultados(q);
      setResults(data.results);
      setMessage(data.message ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar resultado.");
    } finally {
      setLoading(false);
    }
  }

  const notFound = results !== null && results.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E1A] via-[#0d1526] to-[#0A0E1A] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary" />
          <div>
            <p className="font-bold text-white text-sm leading-tight">Clube de Robótica · Codó - MA</p>
            <p className="text-xs text-white/50">Consulta de Resultados 2026</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pt-12 pb-16">
        <div className="w-full max-w-xl">
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Consulte seu resultado
          </h1>
          <p className="text-white/60 text-sm text-center mb-8">
            Informe seu nome completo, número de protocolo ou CPF para verificar sua situação.
          </p>

          {/* Search form */}
          <form onSubmit={handleSearch} className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, protocolo ou CPF..."
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-12 pr-32 py-3.5 text-white placeholder:text-white/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || query.trim().length < 3}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </form>

          {/* States */}
          {error && (
            <div className="flex items-center gap-3 bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {message && !error && (
            <p className="text-white/50 text-sm text-center mb-4">{message}</p>
          )}

          {notFound && (
            <div className="text-center py-10">
              <Bot className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 font-medium">Nenhum resultado encontrado</p>
              <p className="text-white/40 text-sm mt-1">
                Verifique se o nome está correto ou tente o número de protocolo recebido no e-mail de confirmação.
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-4">
              <p className="text-white/50 text-xs text-right">
                {results.length} resultado{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((r) => (
                <ResultCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-4 py-4 text-center">
        <p className="text-white/30 text-xs">
          SEMECTI · Coordenação de Ciência, Tecnologia e Inovação · Codó - MA
        </p>
      </footer>
    </div>
  );
}
