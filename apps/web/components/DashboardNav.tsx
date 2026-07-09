"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconTresorerie, IconRapprochement, IconTFT, IconFactures,
} from "./ui/icons";

const NAV = [
  { href: "/tresorerie", label: "Trésorerie", Icon: IconTresorerie },
  { href: "/rapprochement", label: "Rapprochement", Icon: IconRapprochement },
  { href: "/tft", label: "Flux (TFT)", Icon: IconTFT },
  { href: "/factures", label: "Factures / DSO", Icon: IconFactures },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-slate-800 font-medium text-white"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            }`}
          >
            <span className={active ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"}>
              <Icon />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
