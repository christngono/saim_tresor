import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "../../../auth";
import { SaimMark } from "../../../components/ui/icons";
import { AuthBackground } from "../../../components/AuthBackground";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  async function connexion(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/tresorerie",
      });
    } catch (e) {
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
      redirect("/login?error=1");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-4">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white">
          <SaimMark className="h-10 w-auto" />
          <div className="text-lg font-semibold">SAIM Trésorerie</div>
        </div>
        <form action={connexion} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Connexion</h1>
            <p className="text-sm text-slate-500">Accédez à votre espace trésorerie.</p>
          </div>
          {searchParams.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              Identifiants invalides.
            </p>
          )}
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required placeholder="vous@entreprise.cm" className="input" />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input name="password" type="password" required placeholder="••••••••" className="input" />
          </div>
          <button className="btn-primary w-full">Se connecter</button>
          <p className="text-center text-xs text-slate-500">
            Pas de compte ? <Link href="/register" className="font-medium text-brand-700 hover:underline">Créer une entreprise</Link>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Conforme SYSCOHADA révisé · Cameroun</p>
      </div>
    </div>
  );
}
