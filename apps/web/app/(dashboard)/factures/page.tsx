import { listFactures } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";
import { AnalysePanel } from "../../../components/invoicing/AnalysePanel";

function fcfa(v: string) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

const STATUT_TON: Record<string, string> = {
  EMISE: "bg-gray-100 text-gray-700",
  PARTIELLE: "bg-amber-100 text-amber-800",
  PAYEE: "bg-green-100 text-green-800",
  EN_RETARD: "bg-red-100 text-red-800",
  LITIGE: "bg-red-100 text-red-800",
};

// Date de référence de l'analyse (aujourd'hui, dans le contexte de démo).
const DATE_REF = "2026-07-08";

export default async function Page() {
  const ctx = await requireCtx();
  const factures = await listFactures(ctx);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">Factures & DSO</h1>

      <AnalysePanel dateReference={DATE_REF} />

      <section>
        <h2 className="mb-2 text-lg font-semibold">Toutes les factures ({factures.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2">Sens</th><th>Numéro</th><th>Tiers</th>
              <th>Échéance</th><th>Statut</th><th className="text-right">Reste dû</th>
            </tr>
          </thead>
          <tbody>
            {factures.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="py-1.5">{f.sens === "CLIENT" ? "Client" : "Fourn."}</td>
                <td>{f.numero}</td>
                <td>{f.tiers}</td>
                <td>{f.dateEcheance}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUT_TON[f.statut] ?? ""}`}>{f.statut}</span>
                </td>
                <td className="text-right">{fcfa(f.resteAPayer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
