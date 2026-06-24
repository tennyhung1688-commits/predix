import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageViewTracker } from "@/components/PageViewTracker";
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
  metadataBase: new URL('https://predix.eu.cc'),
  openGraph: {
    title: 'PrediX — 全球预测市场交易平台',
    description: '在 Polymarket 上交易世界杯、政治、加密等预测市场。实时概率、真实赔率、零滑点。',
    url: 'https://predix.eu.cc',
    siteName: 'PrediX',
    locale: 'zh_CN',
    type: 'website',
    images: [{ url: 'https://predix.eu.cc/api/og/home', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrediX — 全球预测市场交易平台',
    description: '在 Polymarket 上交易世界杯、政治、加密等预测市场。实时概率、真实赔率。',
    images: ['https://predix.eu.cc/api/og/home'],
  },
  alternates: {
    languages: {
      'zh-CN': '/zh',
      'en-US': '/en',
    },
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0f',
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
      <head>
        <link rel="dns-prefetch" href="https://pixabay.com" />
        <link rel="dns-prefetch" href="https://loremflickr.com" />
        <link rel="dns-prefetch" href="https://predix-backend-0faz.onrender.com" />
        <link rel="preconnect" href="https://pixabay.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://loremflickr.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://predix-backend-0faz.onrender.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <PageViewTracker />
        <ErrorBoundary>
          <Providers>
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-[var(--border)] px-4 py-4 text-center text-[11px] text-[var(--text-muted)]">
              <span>PrediX © 2026</span>
              <span className="mx-3 opacity-30">|</span>
              <a href="https://x.com/PrediXeucc" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-blue)] transition-colors">
                X @PrediXeucc
              </a>
              <span className="mx-3 opacity-30">|</span>
              <a href="mailto:predixservice@outlook.com" className="hover:text-[var(--accent-blue)] transition-colors">
                predixservice@outlook.com
              </a>
            </footer>
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
