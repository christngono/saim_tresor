import Link from "next/link";
import type { ReactNode } from "react";

// ── Primitives de présentation (composants serveur) ──

export function PageHeader({
  title, description, actions,
}: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

type Tone = "neutral" | "positive" | "negative" | "warning" | "brand" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  negative: "bg-rose-50 text-rose-700 ring-rose-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatCard({
  label, value, hint, tone = "neutral", icon,
}: {
  label: string; value: string; hint?: string; tone?: Tone; icon?: ReactNode;
}) {
  const accent: Record<Tone, string> = {
    neutral: "text-slate-900", positive: "text-emerald-600", negative: "text-rose-600",
    warning: "text-amber-600", brand: "text-brand-700", info: "text-sky-700",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        {icon && <div className="text-slate-300">{icon}</div>}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular ${accent[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ButtonLink({
  href, children, variant = "primary",
}: {
  href: string; children: ReactNode; variant?: "primary" | "secondary";
}) {
  return <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>{children}</Link>;
}

/** Formatage monétaire XAF (FCFA), chiffres alignés. */
export function fcfa(v: string | number): string {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}
