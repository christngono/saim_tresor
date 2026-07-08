import Link from "next/link";
import { signOut } from "../../auth";

const NAV = [
  { href: "/tresorerie", label: "Trésorerie" },
  { href: "/rapprochement", label: "Rapprochement" },
  { href: "/tft", label: "Flux (TFT)" },
  { href: "/factures", label: "Factures / DSO" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-gray-50 p-4">
        <div className="mb-6 px-2">
          <div className="font-bold">SAIM Trésorerie</div>
          <div className="text-xs text-gray-500">SYSCOHADA révisé</div>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="block rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
              {n.label}
            </Link>
          ))}
        </nav>
        <form
          action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}
          className="mt-6"
        >
          <button className="px-2 text-xs text-gray-500 hover:text-gray-800">Se déconnecter</button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
