import { Metadata } from 'next'

export const homePageMetadata: Metadata = {
  title: 'Google Workspace Migration Platform - MigrateGWS',
  description: 'Professional Google Workspace to Google Workspace migration platform for IT teams and resellers. Migrate Gmail, Drive, Calendar, Contacts with advanced domain mapping and real-time progress tracking.',
  keywords: [
    'Google Workspace migration',
    'GWS migration tool',
    'Gmail migration service',
    'Google Drive migration',
    'Google Calendar migration',
    'cross-tenant migration',
    'domain mapping',
    'IT migration platform',
    'workspace data transfer',
    'tenant-to-tenant migration',
    'Google Workspace reseller tools',
    'enterprise migration solution'
  ],
  openGraph: {
    title: 'Google Workspace Migration Platform - MigrateGWS',
    description: 'Professional Google Workspace migration platform built for IT teams and resellers. Secure cross-tenant migrations with real-time tracking.',
    url: 'https://migratgws.com',
    type: 'website',
    images: [
      {
        url: '/og-home.jpg',
        width: 1200,
        height: 630,
        alt: 'MigrateGWS Google Workspace Migration Platform Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Google Workspace Migration Platform - MigrateGWS',
    description: 'Professional Google Workspace migration platform built for IT teams and resellers.',
    images: ['/twitter-home.jpg'],
  },
  alternates: {
    canonical: 'https://migratgws.com',
  },
}

export const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MigrateGWS',
  description: 'Professional Google Workspace to Google Workspace migration platform for IT teams and resellers',
  url: 'https://migratgws.com',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web Browser',
  softwareVersion: '1.0',
  author: {
    '@type': 'Organization',
    name: 'MigrateGWS Team',
    url: 'https://migratgws.com'
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free and open-source Google Workspace migration platform'
  },
  featureList: [
    'Gmail Migration',
    'Google Drive Migration', 
    'Google Calendar Migration',
    'Contacts Migration',
    'Shared Drives Migration',
    'Domain Mapping',
    'Cross-tenant Migration',
    'Real-time Progress Tracking',
    'User Transformation',
    'Audit Reports'
  ],
  screenshot: 'https://migratgws.com/screenshot.jpg',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '127'
  }
}

export const organizationData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MigrateGWS',
  url: 'https://migratgws.com',
  logo: 'https://migratgws.com/logo.png',
  description: 'Professional Google Workspace migration platform for IT teams and resellers',
  foundingDate: '2024',
  specialty: 'Google Workspace Migration Services',
  knowsAbout: [
    'Google Workspace Migration',
    'Cross-tenant Migration',
    'Domain Migration',
    'IT Services',
    'Cloud Migration'
  ]
}

export const faqData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Google Workspace migration?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Google Workspace migration is the process of moving user data (Gmail, Drive, Calendar, Contacts) from one Google Workspace domain to another, either within the same organization or between different tenants.'
      }
    },
    {
      '@type': 'Question', 
      name: 'Can I migrate between different Google Workspace tenants?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, MigrateGWS supports cross-tenant migrations between different Google Workspace organizations with proper domain-wide delegation setup and OAuth permissions.'
      }
    },
    {
      '@type': 'Question',
      name: 'What data can be migrated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'MigrateGWS can migrate Gmail messages, Google Drive files, Google Calendar events, Contacts, and Shared Drive contents between Google Workspace domains.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is the migration secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, MigrateGWS uses official Google APIs with OAuth authentication and domain-wide delegation for secure access. No passwords are stored and all connections use encrypted channels.'
      }
    }
  ]
}
