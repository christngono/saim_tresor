import Link from "next/link";
import { registerAction } from "./actions";
import { SaimMark } from "../../../components/ui/icons";

const ERREURS: Record<string, string> = {
  champs: "Merci de remplir tous les champs (mot de passe : 6 caractères min.).",
  email: "Cet email est déjà utilisé.",
};

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white">
          <SaimMark className="h-10 w-auto" />
          <div className="text-lg font-semibold">SAIM Trésorerie</div>
        </div>
        <form action={registerAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Créer un compte entreprise</h1>
            <p className="text-sm text-slate-500">Quelques informations et vous démarrez.</p>
          </div>
          {searchParams.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {ERREURS[searchParams.error] ?? "Erreur lors de l'inscription."}
            </p>
          )}

          <Field name="raisonSociale" label="Raison sociale" placeholder="MA PME SARL" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="nom" label="Votre nom" placeholder="Responsable" />
            <Field name="email" label="Email" type="email" placeholder="vous@pme.cm" />
          </div>
          <Field name="password" label="Mot de passe" type="password" placeholder="6 caractères min." />

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Compte bancaire principal
            </div>
            <div className="space-y-3">
              <Field name="banque" label="Banque" placeholder="Ex : Afriland First Bank" />
              <Field name="numeroCompte" label="N° de compte (optionnel)" required={false} placeholder="10005-00012-…" />
            </div>
          </div>

          <button className="btn-primary w-full">Créer mon compte</button>
          <p className="text-center text-xs text-slate-500">
            Déjà inscrit ? <Link href="/login" className="font-medium text-brand-700 hover:underline">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  name, label, type = "text", placeholder, required = true,
}: {
  name: string; label: string; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} className="input" />
    </div>
  );
}
