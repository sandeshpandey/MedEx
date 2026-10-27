import type { Metadata } from "next";
import { DevPanel } from "@/components/DevPanel";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedEx take-home",
  description: "Senior frontend engineer assessment",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {children}
        <DevPanel />
      </body>
    </html>
  );
}
