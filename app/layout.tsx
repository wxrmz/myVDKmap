import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Splash } from "@/components/Splash";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

const DESCRIPTION = "Карта Владивостока для жителей: проблемы двора и дома, ремонты и отключения рядом, квитанции ЖКХ простыми словами.";
export const metadata: Metadata = {
  title: { default: "Мой дом. Владивосток", template: "%s · Мой дом. Владивосток" },
  description: DESCRIPTION,
  openGraph: { type: "website", locale: "ru_RU", siteName: "Мой дом. Владивосток", title: "Мой дом. Владивосток", description: DESCRIPTION },
};

// A reload always starts at the city map. Middleware cannot tell a reload from an opened shared link, the browser can.
const RELOAD_HOME = `if (location.pathname !== "/" && performance.getEntriesByType("navigation")[0]?.type === "reload") location.replace("/");`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RELOAD_HOME }} />
      </head>
      <body>
        <Providers>
          {children}
          <Splash />
        </Providers>
      </body>
    </html>
  );
}
