import Link from "next/link";
import { listRapprochements } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";

function fcfa(v: string) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

const STATUT_TON: Record<string, string> = {
  BROUILLON: "bg-gray-100 text-gray-700",
  EN_REVUE: "bg-amber-100 text-amber-800",
  VALIDE: "bg-green-100 text-green-800",
  EXPORTE: "bg-blue-100 text-blue-800",
};

export default async function Page() {
  const ctx = await requireCtx();
  const raps = await listRapprochements(ctx);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rapprochements bancaires</h1>
        <div className="flex gap-2">
          <Link href="/rapprochement/importer"
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
            Importer CSV (grand livre + relevé)
          </Link>
          <Link href="/rapprochement/nouveau"
            className="rounded border px-4 py-2 text-sm">
            Upload relevé (PDF/IA)
          </Link>
        </div>
      </header>

      {raps.length === 0 ? (
        <p className="text-gray-500">Aucun rapprochement. Importez un relevé pour commencer.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2">Période</th>
              <th>Statut</th>
              <th>Écarts</th>
              <th className="text-right">Écart de solde</th>
            </tr>
          </thead>
          <tbody>
            {raps.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="py-2">
                  <Link href={`/rapprochement/${r.id}`} className="text-blue-700">
                    {r.periodeDebut} → {r.periodeFin}
                  </Link>
                </td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUT_TON[r.statut] ?? ""}`}>
                    {r.statut}
                  </span>
                </td>
                <td>{r.nbEcarts}</td>
                <td className="text-right">{fcfa(r.ecart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
