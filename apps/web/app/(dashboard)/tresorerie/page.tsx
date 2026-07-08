import Link from "next/link";
import { listComptes, listRapprochements } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";

function fcfa(v: number) {
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

export default async function Page() {
  const ctx = await requireCtx();
  const [comptes, raps] = await Promise.all([listComptes(ctx), listRapprochements(ctx)]);

  const aInstruire = raps.filter((r) => r.statut === "EN_REVUE").length;
  const ecartsOuverts = raps
    .filter((r) => r.statut === "EN_REVUE")
    .reduce((s, r) => s + r.nbEcarts, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-bold">Vue d'ensemble trésorerie</h1>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Kpi label="Comptes bancaires" value={String(comptes.length)} />
        <Kpi label="Rapprochements à instruire" value={String(aInstruire)}
          highlight={aInstruire > 0} />
        <Kpi label="Écarts ouverts" value={String(ecartsOuverts)} highlight={ecartsOuverts > 0} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Comptes bancaires</h2>
        <div className="grid grid-cols-2 gap-4">
          {comptes.map((c) => (
            <div key={c.id} className="rounded-lg border p-4">
              <div className="font-medium">{c.banque}</div>
              <div className="text-sm text-gray-500">{c.intitule}</div>
              <div className="mt-1 text-xs text-gray-400">{c.numeroCompte}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Rapprochements récents</h2>
          <Link href="/rapprochement" className="text-sm text-blue-700">Tout voir →</Link>
        </div>
        <ul className="divide-y rounded-lg border">
          {raps.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <Link href={`/rapprochement/${r.id}`} className="text-blue-700">
                {r.periodeDebut} → {r.periodeFin}
              </Link>
              <span className="text-gray-500">{r.statut} · {r.nbEcarts} écart(s)</span>
            </li>
          ))}
          {raps.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucun rapprochement.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
