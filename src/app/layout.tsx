import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "assist",
  description: "A friendly personal-life dashboard.",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
