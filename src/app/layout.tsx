import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'
import Head from 'next/head'

export const metadata: Metadata = {
  title: {
    default: 'MigrateGWS - Google Workspace Migration Platform',
    template: '%s | MigrateGWS'
  },
  description: 'Professional Google Workspace to Google Workspace migration platform for IT teams and resellers. Migrate Gmail, Drive, Calendar, Contacts with domain mapping and real-time tracking.',
  keywords: [
    'Google Workspace migration',
    'GWS migration',
    'Gmail migration',
    'Google Drive migration',
    'Google Calendar migration',
    'domain migration',
    'tenant migration',
    'IT migration tools',
    'workspace migration',
    'cross-tenant migration',
    'domain mapping',
    'user migration'
  ],
  authors: [{ name: 'MigrateGWS Team' }],
  creator: 'MigrateGWS',
  publisher: 'MigrateGWS',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://migratgws.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'MigrateGWS - Google Workspace Migration Made Simple',
    description: 'Professional Google Workspace migration platform built for IT teams and resellers. Secure, scalable migrations with real-time tracking.',
    url: 'https://migratgws.com',
    siteName: 'MigrateGWS',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MigrateGWS - Google Workspace Migration Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MigrateGWS - Google Workspace Migration Made Simple',
    description: 'Professional Google Workspace migration platform built for IT teams and resellers.',
    images: ['/twitter-image.jpg'],
    creator: '@migratgws',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/fonts/ClashGrotesk-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/fonts/ClashGrotesk-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/fonts/ClashGrotesk-Semibold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* DNS prefetch for Google Fonts */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
