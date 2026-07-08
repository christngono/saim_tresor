import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAIM Trésorerie",
  description: "Gestion de trésorerie conforme SYSCOHADA révisé",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="text-gray-900 antialiased">{children}</body>
    </html>
  );
}
