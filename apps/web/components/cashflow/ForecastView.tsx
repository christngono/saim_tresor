import type { Forecast } from "../../lib/api";

function fcfa(v: string | number) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

export function ForecastView({ f }: { f: Forecast }) {
  const soldes = f.points.map((p) => Number(p.solde_projete));
  const maxAbs = Math.max(1, ...soldes.map((s) => Math.abs(s)), Number(f.solde_initial));

  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 text-lg font-semibold">Prévisionnel glissant 30 / 60 / 90 jours</h2>

      {f.alerte_rupture && (
        <div className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ Risque de <strong>rupture de trésorerie</strong> à horizon{" "}
          <strong>{f.rupture_horizon_jours} jours</strong>. Décision à valider par le DAF.
        </div>
      )}

      <div className="mb-4 flex items-end gap-6" style={{ height: 140 }}>
        {f.points.map((p) => {
          const val = Number(p.solde_projete);
          const h = (Math.abs(val) / maxAbs) * 100;
          const neg = val < 0;
          return (
            <div key={p.horizon_jours} className="flex flex-1 flex-col items-center justify-end">
              <span className={`mb-1 text-xs ${neg ? "text-red-600" : "text-gray-600"}`}>{fcfa(val)}</span>
              <div className="flex w-full items-end justify-center" style={{ height: 90 }}>
                <div
                  className={`w-10 rounded-t ${neg ? "bg-red-500" : "bg-green-500"}`}
                  style={{ height: `${Math.max(4, h)}%` }}
                />
              </div>
              <span className="mt-1 text-xs font-medium">{p.horizon_jours}j</span>
            </div>
          );
        })}
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th className="py-1">Horizon</th><th>Encaissements</th><th>Décaissements</th><th className="text-right">Solde projeté</th></tr>
        </thead>
        <tbody>
          {f.points.map((p) => (
            <tr key={p.horizon_jours} className="border-t">
              <td className="py-1.5">{p.horizon_jours}j ({p.date})</td>
              <td className="text-green-700">+{fcfa(p.encaissements_prevus)}</td>
              <td className="text-red-700">−{fcfa(p.decaissements_prevus)}</td>
              <td className={`text-right font-medium ${p.rupture ? "text-red-600" : ""}`}>
                {fcfa(p.solde_projete)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
