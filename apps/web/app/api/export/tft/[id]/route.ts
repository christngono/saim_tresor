import { requireCtx } from "../../../../../lib/session";

const API = process.env.API_BASE_URL ?? "http://127.0.0.1:8010";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Relaie l'export vers l'API (avec le tenant issu de la session) et renvoie le
// fichier au navigateur en téléchargement. Aucun stockage objet requis.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireCtx();
  const res = await fetch(`${API}/cashflow/${params.id}/export`, {
    method: "POST",
    headers: {
      "X-Entreprise-Id": ctx.entrepriseId,
      "X-Utilisateur-Id": ctx.utilisateurId,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(`Export impossible (${res.status}) : ${detail}`, { status: res.status });
  }

  return new Response(await res.arrayBuffer(), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="tft-${params.id}.xlsx"`,
    },
  });
}
