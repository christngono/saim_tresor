import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "../../../auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  async function connexion(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/tresorerie",
      });
    } catch (e) {
      // NextAuth relance une redirection ; on ne la traite pas comme une erreur.
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
      redirect("/login?error=1");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form action={connexion} className="w-80 space-y-4 rounded-lg border bg-white p-6">
        <div>
          <div className="text-lg font-bold">SAIM Trésorerie</div>
          <div className="text-xs text-gray-500">Connexion</div>
        </div>
        {searchParams.error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            Identifiants invalides.
          </p>
        )}
        <input name="email" type="email" required placeholder="Email"
          className="w-full rounded border px-3 py-2 text-sm" />
        <input name="password" type="password" required placeholder="Mot de passe"
          className="w-full rounded border px-3 py-2 text-sm" />
        <button className="w-full rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Se connecter
        </button>
        <p className="text-center text-xs text-gray-500">
          Pas de compte ? <Link href="/register" className="text-blue-700">Créer une entreprise</Link>
        </p>
      </form>
    </div>
  );
}
