import Link from "next/link";
import { registerAction } from "./actions";

const ERREURS: Record<string, string> = {
  champs: "Merci de remplir tous les champs (mot de passe : 6 caractères min.).",
  email: "Cet email est déjà utilisé.",
};

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-10">
      <form action={registerAction} className="w-96 space-y-3 rounded-lg border bg-white p-6">
        <div>
          <div className="text-lg font-bold">SAIM Trésorerie</div>
          <div className="text-xs text-gray-500">Créer un compte entreprise</div>
        </div>
        {searchParams.error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERREURS[searchParams.error] ?? "Erreur lors de l'inscription."}
          </p>
        )}

        <Field name="raisonSociale" label="Raison sociale" placeholder="MA PME SARL" />
        <Field name="nom" label="Votre nom" placeholder="Nom du responsable" />
        <Field name="email" label="Email" type="email" placeholder="vous@entreprise.cm" />
        <Field name="password" label="Mot de passe" type="password" placeholder="6 caractères min." />
        <div className="border-t pt-3">
          <div className="mb-2 text-xs uppercase text-gray-400">Compte bancaire principal</div>
          <Field name="banque" label="Banque" placeholder="Ex : Afriland First Bank" />
          <Field name="numeroCompte" label="N° de compte (optionnel)" required={false}
            placeholder="10005-00012-..." />
        </div>

        <button className="w-full rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Créer mon compte
        </button>
        <p className="text-center text-xs text-gray-500">
          Déjà inscrit ? <Link href="/login" className="text-blue-700">Se connecter</Link>
        </p>
      </form>
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
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder}
        className="w-full rounded border px-3 py-2 text-sm" />
    </div>
  );
}
