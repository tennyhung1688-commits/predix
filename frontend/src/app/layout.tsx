import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import ErrorBoundary from "@/components/ErrorBoundary";
import { translations } from "@/i18n/translations";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: translations.zh['app.title'],
  description: translations.zh['app.description'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

function RootLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${dmSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <ErrorBoundary>
          <Providers>
            <Navbar />
            <main className="flex-1">{children}</main>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={
      <html lang="zh-CN" className={`${dmSans.variable} ${spaceGrotesk.variable} h-full antialiased`} style={{ colorScheme: 'dark' }}>
        <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="flex items-center justify-center min-h-screen">
            <div className="h-8 w-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        </body>
      </html>
    }>
      <RootLayoutInner>{children}</RootLayoutInner>
    </Suspense>
  );
}
