"use client";

import { useState, useTransition } from "react";
import { exporterAction, validerRapprochementAction } from "../../app/(dashboard)/rapprochement/actions";

export function ActionsBar({ id, statut }: { id: string; statut: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const valide = statut === "VALIDE" || statut === "EXPORTE";

  return (
    <div className="flex items-center gap-3">
      {!valide && (
        <button
          disabled={pending}
          onClick={() => start(async () => {
            setErreur(null);
            try { await validerRapprochementAction(id); }
            catch (e) { setErreur((e as Error).message); }
          })}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Clôturer (validation humaine)
        </button>
      )}
      {valide && (
        <button
          disabled={pending}
          onClick={() => start(async () => {
            setErreur(null);
            try { setUrl(await exporterAction(id)); }
            catch (e) { setErreur((e as Error).message); }
          })}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Exporter (SYSCOHADA .xlsx)
        </button>
      )}
      {url && <a href={url} className="text-sm text-blue-700 underline">Télécharger l'état</a>}
      {erreur && <span className="text-sm text-red-600">{erreur}</span>}
    </div>
  );
}
