// Icônes SVG inline (stroke = currentColor), légères et cohérentes.
type P = { className?: string };
const base = (className = "h-5 w-5") => ({
  className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const IconTresorerie = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.4" /></svg>
);
export const IconRapprochement = ({ className }: P) => (
  <svg {...base(className)}><path d="M7 4v13" /><path d="M4 8l3-4 3 4" /><path d="M17 20V7" /><path d="M14 16l3 4 3-4" /></svg>
);
export const IconTFT = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M7 15l4-4 3 3 5-6" /></svg>
);
export const IconFactures = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>
);
export const IconLogout = ({ className }: P) => (
  <svg {...base(className)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
);
export const IconPlus = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconUpload = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 16V4" /><path d="M8 8l4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}><path d="M20 6L9 17l-5-5" /></svg>
);
export const IconAlert = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
);
export const IconLogo = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z" /><path d="M12 7v10M9.5 9.2c0-1.2 1.1-1.8 2.5-1.8s2.5.6 2.5 1.7c0 2.5-5 1.4-5 3.9 0 1.1 1.1 1.8 2.5 1.8s2.5-.6 2.5-1.8" /></svg>
);
