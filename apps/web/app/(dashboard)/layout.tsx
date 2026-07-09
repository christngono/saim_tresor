import { auth, signOut } from "../../auth";
import { DashboardNav } from "../../components/DashboardNav";
import { IconLogo, IconLogout } from "../../components/ui/icons";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = (await auth()) as (Record<string, unknown> & { user?: { name?: string; email?: string } }) | null;
  const nom = session?.user?.name ?? "Utilisateur";
  const email = session?.user?.email ?? "";
  const initiales = nom.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-slate-900 px-4 py-5">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <span className="text-brand-400"><IconLogo className="h-7 w-7" /></span>
          <div>
            <div className="font-semibold leading-tight text-white">SAIM Trésorerie</div>
            <div className="text-[11px] text-slate-400">SYSCOHADA révisé</div>
          </div>
        </div>

        <DashboardNav />

        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {initiales}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{nom}</div>
              <div className="truncate text-[11px] text-slate-400">{email}</div>
            </div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100">
              <IconLogout className="h-5 w-5" /> Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
