import "./globals.css";
import type { ReactNode } from "react";
import LanguageProvider from "@/components/possum/LanguageProvider";

export const metadata = {
  title: "Possum Bot | The Discord Community Toolkit",
  description: "Moderation, onboarding, security, community progression and server operations in one modular Discord bot platform.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-black">
      <body className="h-full bg-black text-white">
        <div className="min-h-screen bg-black">
          {children}
        </div>
        <LanguageProvider />
      </body>
    </html>
  );
}
