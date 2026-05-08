import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suivi d'échecs d'Abi",
  description: "Une petite application pour suivre les progrès aux échecs."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
