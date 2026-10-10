import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClauseWise — Enterprise Legal Contract Intelligence",
  description: "AI legal contract analysis with deterministic quotation verification and autonomous agentic research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased h-screen overflow-hidden bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
