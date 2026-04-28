import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SFIT — Sistema de Fiscalización Inteligente de Transporte",
  description:
    "Plataforma institucional para la fiscalización y gestión del transporte público y la flota vehicular municipal.",
  keywords: [
    "fiscalización",
    "transporte",
    "flota vehicular",
    "municipalidad",
    "SFIT",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn("h-full", inter.variable, "font-sans")}
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
