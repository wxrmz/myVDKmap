import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Splash } from "@/components/Splash";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = { title: "Мой дом. Владивосток" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <body>
        <Providers>
          {children}
          <Splash />
        </Providers>
      </body>
    </html>
  );
}
