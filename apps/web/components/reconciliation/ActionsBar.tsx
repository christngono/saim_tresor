"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validerRapprochementAction } from "../../app/(dashboard)/rapprochement/actions";
import { IconCheck, IconUpload } from "../ui/icons";

export function ActionsBar({ id, statut }: { id: string; statut: string }) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const router = useRouter();
  const valide = statut === "VALIDE" || statut === "EXPORTE";

  return (
    <div className="flex items-center gap-3">
      {!valide && (
        <button disabled={pending} className="btn-primary"
          onClick={() => start(async () => {
            setErreur(null);
            try { await validerRapprochementAction(id); } catch (e) { setErreur((e as Error).message); }
          })}>
          <IconCheck className="h-4 w-4" /> Clôturer
        </button>
      )}
      {valide && (
        // Téléchargement direct : l'API renvoie le .xlsx, aucun stockage requis.
        <a href={`/api/export/rapprochement/${id}`} download className="btn-secondary"
          onClick={() => setTimeout(() => router.refresh(), 1200)}>
          <IconUpload className="h-4 w-4" /> Exporter (.xlsx)
        </a>
      )}
      {erreur && <span className="text-sm text-rose-600">{erreur}</span>}
    </div>
  );
}
