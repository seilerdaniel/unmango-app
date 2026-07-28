import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { ThemeProvider } from "@/context/ThemeContext";
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

// Script mínimo e inline para aplicar la clase "dark" ANTES de la
// primera pintada (evita el flash de modo claro al recargar con el
// modo oscuro ya elegido). ThemeContext hace el resto una vez que React
// hidrata.
const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('unmango_theme');
    var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">
        <ThemeProvider>
          <PrivacyProvider>
            <CategoriesProvider>
              {children}
            </CategoriesProvider>
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}