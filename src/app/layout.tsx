import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UnMango - Finanzas Personales",
  description: "Dashboard personal para control de gastos y finanzas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrivacyProvider>
          <CategoriesProvider>
            {children}
          </CategoriesProvider>
        </PrivacyProvider>
      </body>
    </html>
  );
}