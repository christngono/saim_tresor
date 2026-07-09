"use client";

import { useState, useTransition } from "react";
import { exporterAction, validerRapprochementAction } from "../../app/(dashboard)/rapprochement/actions";
import { IconCheck, IconUpload } from "../ui/icons";

export function ActionsBar({ id, statut }: { id: string; statut: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const valide = statut === "VALIDE" || statut === "EXPORTE";

  return (
    <div className="flex items-center gap-3">
      {!valide && (
        <button disabled={pending}
          onClick={() => start(async () => { setErreur(null); try { await validerRapprochementAction(id); } catch (e) { setErreur((e as Error).message); } })}
          className="btn-primary">
          <IconCheck className="h-4 w-4" /> Clôturer
        </button>
      )}
      {valide && (
        <button disabled={pending}
          onClick={() => start(async () => { setErreur(null); try { setUrl(await exporterAction(id)); } catch (e) { setErreur((e as Error).message); } })}
          className="btn-secondary">
          <IconUpload className="h-4 w-4" /> Exporter (.xlsx)
        </button>
      )}
      {url && <a href={url} className="text-sm font-medium text-brand-700 hover:underline">Télécharger</a>}
      {erreur && <span className="text-sm text-rose-600">{erreur}</span>}
    </div>
  );
}
