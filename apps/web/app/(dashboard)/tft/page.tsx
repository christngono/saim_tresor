"use client";

import { useState, useTransition } from "react";
import type { Forecast, TFTOut } from "../../../lib/api";
import { buildTFTAction, forecastAction } from "./actions";
import { TFTView } from "../../../components/cashflow/TFTView";
import { ForecastView } from "../../../components/cashflow/ForecastView";
import { IconTFT } from "../../../components/ui/icons";

export default function Page() {
  const [tft, setTft] = useState<TFTOut | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [methode, setMethode] = useState("INDIRECTE");
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function construire() {
    start(async () => {
      setErreur(null);
      try {
        const t = await buildTFTAction({
          periode_debut: "2026-06-30", periode_fin: "2026-06-30",
          tresorerie_ouverture: "3700000", methode,
        });
        setTft(t);
        setForecast(await forecastAction({ date_reference: "2026-06-30", solde_initial: t.donnees.tresorerie_cloture, seuil_alerte: "0" }));
      } catch (e) { setErreur((e as Error).message); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Flux de trésorerie (TFT)</h1>
          <p className="mt-1 text-sm text-slate-500">Calcul déterministe SYSCOHADA + prévisionnel glissant.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={methode} onChange={(e) => setMethode(e.target.value)} className="input w-auto py-2">
            <option value="INDIRECTE">Méthode indirecte</option>
            <option value="DIRECTE">Méthode directe</option>
          </select>
          <button onClick={construire} disabled={pending} className="btn-primary">
            <IconTFT className="h-4 w-4" /> {pending ? "Calcul…" : "Construire"}
          </button>
        </div>
      </div>

      {erreur && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{erreur}</p>}

      {!tft && !erreur && (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <span className="text-slate-300"><IconTFT className="h-8 w-8" /></span>
          <p className="font-medium text-slate-700">Aucun TFT généré</p>
          <p className="max-w-sm text-sm text-slate-400">
            Le tableau de flux est calculé de façon déterministe à partir des écritures de la période, puis validé par un humain avant export.
          </p>
        </div>
      )}

      {tft && <TFTView tft={tft} />}
      {forecast && <ForecastView f={forecast} />}
    </div>
  );
}
