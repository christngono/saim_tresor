"use client";

import { useState, useTransition } from "react";
import type { Forecast, TFTOut } from "../../../lib/api";
import { buildTFTAction, forecastAction } from "./actions";
import { TFTView } from "../../../components/cashflow/TFTView";
import { ForecastView } from "../../../components/cashflow/ForecastView";

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
          periode_debut: "2026-06-01", periode_fin: "2026-06-30",
          tresorerie_ouverture: "3700000", methode,
        });
        setTft(t);
        const f = await forecastAction({
          date_reference: "2026-06-30",
          solde_initial: t.donnees.tresorerie_cloture,
          seuil_alerte: "0",
        });
        setForecast(f);
      } catch (e) {
        setErreur((e as Error).message);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flux de trésorerie (TFT)</h1>
        <div className="flex items-center gap-3">
          <select value={methode} onChange={(e) => setMethode(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm">
            <option value="INDIRECTE">Méthode indirecte</option>
            <option value="DIRECTE">Méthode directe</option>
          </select>
          <button onClick={construire} disabled={pending}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {pending ? "Calcul en cours…" : "Construire le TFT + prévisionnel"}
          </button>
        </div>
      </header>

      {erreur && <p className="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>}

      {!tft && !erreur && (
        <p className="text-gray-500">
          Le TFT (SYSCOHADA révisé) est calculé de façon déterministe à partir des
          écritures de la période, puis validé par un humain avant export.
        </p>
      )}

      {tft && <TFTView tft={tft} />}
      {forecast && <ForecastView f={forecast} />}
    </div>
  );
}
