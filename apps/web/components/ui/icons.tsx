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
// Marque officielle SAIM : « S » blanc dans un écusson au dégradé bleu.
export const SaimMark = ({ className = "h-8 w-auto" }: P) => (
  <svg className={className} viewBox="0 0 1002 1501" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SAIM">
    <path d="M300.596 0H701.392C734.791 0 764.016 15.0067 789.066 45.0201L964.413 255.114C989.463 285.127 1001.99 320.143 1001.99 360.16V1140.51C1001.99 1180.53 989.463 1215.54 964.413 1245.56L789.066 1455.65C764.016 1485.66 734.791 1500.67 701.392 1500.67H300.596C267.197 1500.67 237.972 1485.66 212.922 1455.65L37.5745 1245.56C12.5248 1215.54 0 1180.53 0 1140.51V360.16C0 320.143 12.5248 285.127 37.5745 255.114L212.922 45.0201C237.972 15.0067 267.197 0 300.596 0Z" fill="url(#saim-grad)"/>
    <path d="M605.387 527.381C603.115 504.464 593.361 486.661 576.126 473.972C558.891 461.282 535.501 454.938 505.955 454.938C485.88 454.938 468.929 457.778 455.103 463.46C441.277 468.953 430.671 476.623 423.285 486.472C416.088 496.32 412.49 507.494 412.49 519.994C412.111 530.411 414.289 539.502 419.024 547.267C423.948 555.032 430.671 561.756 439.194 567.438C447.717 572.93 457.565 577.76 468.74 581.926C479.914 585.903 491.846 589.313 504.535 592.153L556.808 604.653C582.187 610.335 605.482 617.911 626.694 627.381C647.906 636.85 666.277 648.498 681.808 662.324C697.338 676.15 709.365 692.438 717.887 711.188C726.599 729.938 731.05 751.434 731.24 775.676C731.05 811.282 721.959 842.153 703.967 868.29C686.164 894.237 660.406 914.407 626.694 928.801C593.171 943.006 552.736 950.108 505.387 950.108C458.418 950.108 417.508 942.911 382.66 928.517C348.001 914.123 320.918 892.816 301.41 864.597C282.092 836.188 271.959 801.055 271.012 759.199H390.046C391.372 778.706 396.959 794.994 406.808 808.063C416.846 820.941 430.198 830.695 446.865 837.324C463.721 843.763 482.755 846.983 503.967 846.983C524.8 846.983 542.887 843.953 558.228 837.892C573.758 831.832 585.785 823.403 594.308 812.608C602.83 801.813 607.092 789.407 607.092 775.392C607.092 762.324 603.209 751.339 595.444 742.438C587.868 733.536 576.694 725.96 561.921 719.71C547.338 713.46 529.44 707.778 508.228 702.665L444.876 686.756C395.823 674.824 357.092 656.169 328.683 630.79C300.274 605.411 286.164 571.225 286.353 528.233C286.164 493.006 295.539 462.229 314.478 435.903C333.607 409.578 359.838 389.028 393.171 374.256C426.505 359.483 464.383 352.097 506.808 352.097C549.99 352.097 587.679 359.483 619.876 374.256C652.262 389.028 677.452 409.578 695.444 435.903C713.437 462.229 722.717 492.722 723.285 527.381H605.387Z" fill="white"/>
    <defs>
      <linearGradient id="saim-grad" x1="0" y1="0" x2="1386.05" y2="925.459" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4BB8E8"/>
        <stop offset="1" stopColor="#1A7DB5"/>
      </linearGradient>
    </defs>
  </svg>
);
