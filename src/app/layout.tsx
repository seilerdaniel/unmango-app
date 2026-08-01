import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from "@/context/UserContext";
import { HouseholdProvider } from "@/context/HouseholdContext";
import { PaymentDetailsProvider } from "@/context/PaymentDetailsContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { WalletsProvider } from "@/context/WalletsContext";
import { DashboardDataProvider } from "@/context/DashboardDataContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UnMango",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
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
    if (localStorage.getItem('unmango_oled_black') === 'true') {
      document.documentElement.classList.add('oled');
    }
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
      // El script de abajo agrega la clase "dark" a <html> ANTES de que
      // React hidrate (para evitar el flash de modo claro). Eso hace que
      // el className del navegador no coincida con el que renderizó el
      // servidor, y React lo marca como "hydration mismatch" — pero es
      // intencional, no un bug. suppressHydrationWarning le dice a React
      // que ignore ese desajuste puntual en este atributo.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">
        <ServiceWorkerRegister />
        <ThemeProvider>
          <UserProvider>
            <PrivacyProvider>
              <HouseholdProvider>
                <PaymentDetailsProvider>
                  <CategoriesProvider>
                    <WalletsProvider>
                      <DashboardDataProvider>
                        <ToastProvider>{children}</ToastProvider>
                      </DashboardDataProvider>
                    </WalletsProvider>
                  </CategoriesProvider>
                </PaymentDetailsProvider>
              </HouseholdProvider>
            </PrivacyProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}