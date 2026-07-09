import type { Forecast } from "../../lib/api";

function fcfa(v: string | number) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

export function ForecastView({ f }: { f: Forecast }) {
  const soldes = f.points.map((p) => Number(p.solde_projete));
  const maxAbs = Math.max(1, ...soldes.map((s) => Math.abs(s)), Number(f.solde_initial));

  return (
    <div className="card p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Prévisionnel glissant 30 / 60 / 90 jours</h2>

      {f.alerte_rupture && (
        <div className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          ⚠️ Risque de <strong>rupture de trésorerie</strong> à <strong>{f.rupture_horizon_jours} jours</strong>. À valider par le DAF.
        </div>
      )}

      <div className="mb-5 flex items-end gap-8 px-2" style={{ height: 150 }}>
        {f.points.map((p) => {
          const val = Number(p.solde_projete);
          const h = (Math.abs(val) / maxAbs) * 100;
          const neg = val < 0;
          return (
            <div key={p.horizon_jours} className="flex flex-1 flex-col items-center justify-end">
              <span className={`mb-1.5 text-xs font-medium tabular ${neg ? "text-rose-600" : "text-slate-500"}`}>{fcfa(val)}</span>
              <div className="flex w-full items-end justify-center" style={{ height: 96 }}>
                <div className={`w-12 rounded-t-md transition-all ${neg ? "bg-rose-500" : "bg-brand-500"}`}
                  style={{ height: `${Math.max(4, h)}%` }} />
              </div>
              <span className="mt-2 text-xs font-semibold text-slate-600">{p.horizon_jours} j</span>
            </div>
          );
        })}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 font-medium">Horizon</th>
            <th className="py-2 font-medium">Encaissements</th>
            <th className="py-2 font-medium">Décaissements</th>
            <th className="py-2 text-right font-medium">Solde projeté</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {f.points.map((p) => (
            <tr key={p.horizon_jours}>
              <td className="py-2.5 text-slate-600">{p.horizon_jours} j · {p.date}</td>
              <td className="py-2.5 tabular text-emerald-600">+{fcfa(p.encaissements_prevus)}</td>
              <td className="py-2.5 tabular text-rose-600">−{fcfa(p.decaissements_prevus)}</td>
              <td className={`py-2.5 text-right font-medium tabular ${p.rupture ? "text-rose-600" : "text-slate-700"}`}>{fcfa(p.solde_projete)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
