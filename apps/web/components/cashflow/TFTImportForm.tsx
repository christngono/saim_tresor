"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { importerEtConstruireTFTAction } from "../../app/(dashboard)/tft/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Import & calcul du TFT…" : "Importer et générer le TFT"}
    </button>
  );
}

export function TFTImportForm() {
  const [nom, setNom] = useState("");

  return (
    <form action={importerEtConstruireTFTAction} className="card max-w-xl space-y-5 p-6">
      <div>
        <label className="label">Grand livre complet (CSV — toutes les classes 1 à 7)</label>
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40">
          <span>{nom || "Choisir un fichier CSV…"}</span>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">Parcourir</span>
          <input type="file" name="grand_livre" accept=".csv" className="hidden"
            onChange={(e) => setNom(e.target.files?.[0]?.name ?? "")} />
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Colonnes : date_ecriture, journal, piece, compte, libelle, debit, credit.
          Facultatif si vos écritures sont déjà en base.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Début de période</label>
          <input name="periode_debut" type="date" required className="input" />
        </div>
        <div>
          <label className="label">Fin de période</label>
          <input name="periode_fin" type="date" required className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Trésorerie d'ouverture (FCFA)</label>
          <input name="tresorerie_ouverture" type="number" step="0.01" required defaultValue="0" className="input" />
          <p className="mt-1 text-xs text-slate-400">Solde des comptes de classe 5 au 1er jour.</p>
        </div>
        <div>
          <label className="label">Méthode</label>
          <select name="methode" className="input">
            <option value="INDIRECTE">Indirecte (part du résultat)</option>
            <option value="DIRECTE">Directe (encaissements − décaissements)</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
        ⚠️ Le TFT exige le grand livre <strong>complet</strong> (pas seulement la banque) : classes 1
        (emprunts), 2 (immobilisations), 3 (stocks), 4 (clients/fournisseurs), 5 (trésorerie),
        6 (charges) et 7 (produits). Vos livres doivent être équilibrés (Σ débits = Σ crédits),
        sinon le contrôle ne tombera pas à 0 — et l'app vous le signalera.
      </div>

      <SubmitButton />
    </form>
  );
}
