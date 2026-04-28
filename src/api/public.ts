export interface PublicResultRow {
  id: number;
  nome_completo: string;
  escola: string;
  resultado: "aprovado" | "reserva";
  turma_name: string | null;
  turma_day: string | null;
  turma_start: string | null;
  turma_end: string | null;
}

export async function apiSearchResultados(
  query: string
): Promise<{ results: PublicResultRow[]; message?: string }> {
  const qs = new URLSearchParams({ q: query });
  const res = await fetch(`/api/public/resultado?${qs.toString()}`);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error((json as { message?: string })?.message ?? "Erro ao consultar resultado.");
  }
  return res.json() as Promise<{ results: PublicResultRow[]; message?: string }>;
}
