// Fond animé pour les écrans d'authentification : grille « papier financier »
// qui dérive lentement + motifs de graphiques incrustés (mix-blend soft-light,
// faible opacité) qui respirent à l'infini. 100 % CSS/SVG, sans JS.
import type { ReactNode } from "react";

function Motif({
  className, delay, children,
}: {
  className: string; delay: string; children: ReactNode;
}) {
  return (
    <div
      className={`anim-motif absolute text-white mix-blend-soft-light ${className}`}
      style={{ animationDelay: delay }}
      aria-hidden
    >
      {children}
    </div>
  );
}

export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Grille type papier millimétré, dérive diagonale infinie */}
      <svg className="anim-drift absolute -inset-16 h-[calc(100%+8rem)] w-[calc(100%+8rem)] mix-blend-soft-light" aria-hidden>
        <defs>
          <pattern id="saim-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="white" strokeOpacity="0.10" strokeWidth="1" />
          </pattern>
          <pattern id="saim-grid-fine" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M12 0H0V12" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#saim-grid-fine)" />
        <rect width="100%" height="100%" fill="url(#saim-grid)" />
      </svg>

      {/* Courbe haussière + aire (grand, en bas à gauche) */}
      <Motif className="left-[-2%] bottom-[6%] w-[42%] max-w-md" delay="0s">
        <svg viewBox="0 0 240 120" className="h-auto w-full" fill="none">
          <path d="M0 100 L40 78 L80 88 L120 52 L160 64 L200 26 L240 40" stroke="white" strokeWidth="2.5" className="anim-draw" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M0 100 L40 78 L80 88 L120 52 L160 64 L200 26 L240 40 V120 H0 Z" fill="white" fillOpacity="0.14" />
        </svg>
      </Motif>

      {/* Chandeliers (haut droite) */}
      <Motif className="right-[8%] top-[12%] w-40" delay="1.4s">
        <svg viewBox="0 0 160 90" className="h-auto w-full" fill="none" stroke="white" strokeWidth="2">
          {[
            [16, 20, 60, 30, 50], [46, 10, 70, 26, 44], [76, 34, 80, 42, 62],
            [106, 6, 50, 18, 40], [136, 24, 74, 34, 58],
          ].map(([x, yh1, yh2, yb1, yb2], i) => (
            <g key={i}>
              <line x1={x} y1={yh1} x2={x} y2={yh2} strokeWidth="1.5" />
              <rect x={x - 6} y={yb1} width="12" height={yb2 - yb1} fill="white" fillOpacity="0.18" />
            </g>
          ))}
        </svg>
      </Motif>

      {/* Barres (bas droite) */}
      <Motif className="right-[6%] bottom-[10%] w-44" delay="2.2s">
        <svg viewBox="0 0 180 90" className="h-auto w-full">
          {[[10, 30], [40, 55], [70, 40], [100, 70], [130, 50], [160, 82]].map(([x, h], i) => (
            <rect key={i} x={x} y={90 - h} width="18" height={h} rx="2" fill="white" fillOpacity="0.16" />
          ))}
        </svg>
      </Motif>

      {/* Donut (haut gauche) */}
      <Motif className="left-[10%] top-[10%] w-28" delay="0.8s">
        <svg viewBox="0 0 100 100" className="h-auto w-full" fill="none">
          <circle cx="50" cy="50" r="34" stroke="white" strokeOpacity="0.5" strokeWidth="12" />
          <circle cx="50" cy="50" r="34" stroke="white" strokeWidth="12" strokeDasharray="150 214" strokeLinecap="round" transform="rotate(-90 50 50)" />
        </svg>
      </Motif>

      {/* Flèche de croissance ↗ (centre droit) */}
      <Motif className="right-[24%] top-[44%] w-24" delay="3s">
        <svg viewBox="0 0 100 100" className="h-auto w-full" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 78 L44 52 L60 64 L88 26" />
          <path d="M66 26 H88 V48" />
        </svg>
      </Motif>

      {/* Sceau % (bas centre) */}
      <Motif className="left-[40%] bottom-[16%] w-16" delay="1.9s">
        <svg viewBox="0 0 60 60" className="h-auto w-full" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round">
          <circle cx="18" cy="18" r="8" /><circle cx="42" cy="42" r="8" /><path d="M46 14 L14 46" />
        </svg>
      </Motif>
    </div>
  );
}
