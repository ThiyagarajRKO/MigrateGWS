'use client';

import Link from 'next/link'
import { Users, Database, Settings, BarChart3, Shield, FileText } from 'lucide-react'
import { structuredData, organizationData, faqData } from './metadata'

export default function Home() {
  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([structuredData, organizationData, faqData])
        }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 landing-page font-manrope">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-blue-100 sticky top-0 z-50" role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl mr-3 shadow-lg">
                  <Database className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  MigrateGWS
                </span>
              </div>
              <nav className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Main navigation">
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 hover:scale-105 transform">
                  Dashboard
                </Link>
                <Link href="/migrations" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 hover:scale-105 transform">
                  Migrations
                </Link>
                <Link href="/user-mapping" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 hover:scale-105 transform">
                  User Mapping
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-200 hover:scale-105 transform">
                  Settings
                </Link>
                <Link href="/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  Sign In
                </Link>
              </nav>
              
              {/* Mobile menu button */}
              <div className="md:hidden">
                <button className="p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" role="main">
          <section className="text-center mb-20" aria-labelledby="hero-heading">
            {/* Floating elements background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
              <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-1000"></div>
              <div className="absolute bottom-40 left-1/4 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-2000"></div>
            </div>
            
            <div className="relative">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-8 shadow-sm">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                Built for IT Professionals & Resellers
              </div>
              
              <h1 id="hero-heading" className="hero-title text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-none tracking-tight">
                <span className="block bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent drop-shadow-sm">
                  Moving Google
                </span>
                <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mt-2 animate-gradient-x drop-shadow-lg">
                  Workspaces
                </span>
                <span className="block text-4xl md:text-5xl lg:text-6xl font-light bg-gradient-to-r from-gray-600 via-gray-800 to-gray-600 bg-clip-text text-transparent mt-4 tracking-wide">
                  Just Got Easier
                </span>
              </h1>
              
              <p className="hero-subtitle text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto mb-6 font-medium leading-relaxed">
                Built by IT pros, for IT pros and resellers who need to migrate data between Google Workspace domains.
              </p>
              
              <p className="hero-subtitle text-lg md:text-xl text-gray-500 max-w-5xl mx-auto mb-12 leading-relaxed">
                We know tenant-to-tenant migrations are a pain. This platform handles Gmail, Drive, Calendar, Contacts, and Shared Drives 
                while giving you real visibility into what's happening. Set up domain mappings, track progress in real-time, 
                and stop worrying about whether everything made it across.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
                <Link href="/migrations/new" className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 inline-flex items-center justify-center">
                  <span>Start Migration</span>
                  <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/dashboard" className="group bg-white/80 backdrop-blur text-blue-600 border-2 border-blue-200 px-8 py-4 rounded-xl hover:bg-blue-50 hover:border-blue-300 font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 inline-flex items-center justify-center">
                  <span>View Dashboard</span>
                  <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
        </section>

        {/* Feature Cards */}
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">Platform Features</h2>
          
          <article className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 hover:bg-white hover:shadow-2xl transition-all duration-500 border border-blue-100 hover:border-blue-200 transform hover:-translate-y-2">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Users className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="feature-title text-2xl font-bold mb-3 text-gray-900 group-hover:text-blue-900 transition-colors">Smart User Mapping</h3>
              <p className="feature-description text-gray-600 leading-relaxed">
                Map users between domains however you need - one-to-one, split accounts, or merge them together
              </p>
            </div>
            <div className="flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
              <span className="text-sm">Learn more</span>
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </article>
          
          <article className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 hover:bg-white hover:shadow-2xl transition-all duration-500 border border-green-100 hover:border-green-200 transform hover:-translate-y-2">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Shield className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="feature-title text-2xl font-bold mb-3 text-gray-900 group-hover:text-green-900 transition-colors">Actually Secure</h3>
              <p className="feature-description text-gray-600 leading-relaxed">
                Uses proper Google OAuth and domain delegation - no sketchy workarounds or storing passwords
              </p>
            </div>
            <div className="flex items-center text-green-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
              <span className="text-sm">Learn more</span>
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </article>
          
          <article className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 hover:bg-white hover:shadow-2xl transition-all duration-500 border border-purple-100 hover:border-purple-200 transform hover:-translate-y-2">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="feature-title text-2xl font-bold mb-3 text-gray-900 group-hover:text-purple-900 transition-colors">See What's Happening</h3>
              <p className="feature-description text-gray-600 leading-relaxed">
                Real progress tracking so you know if something's stuck (and can actually do something about it)
              </p>
            </div>
            <div className="flex items-center text-purple-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
              <span className="text-sm">Learn more</span>
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </article>
          
          <article className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 hover:bg-white hover:shadow-2xl transition-all duration-500 border border-orange-100 hover:border-orange-200 transform hover:-translate-y-2">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Settings className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="feature-title text-2xl font-bold mb-3 text-gray-900 group-hover:text-orange-900 transition-colors">Visual Setup</h3>
              <p className="feature-description text-gray-600 leading-relaxed">
                Drag and drop to set up domain mappings - no more spreadsheets or config files to mess with
              </p>
            </div>
            <div className="flex items-center text-orange-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
              <span className="text-sm">Learn more</span>
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </article>
          
          <article className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 hover:bg-white hover:shadow-2xl transition-all duration-500 border border-indigo-100 hover:border-indigo-200 transform hover:-translate-y-2">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Database className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="feature-title text-2xl font-bold mb-3 text-gray-900 group-hover:text-indigo-900 transition-colors">Everything Gets Moved</h3>
              <p className="feature-description text-gray-600 leading-relaxed">
                Gmail, Drive files, calendars, contacts, shared drives - if it's in Workspace, we'll move it
              </p>
            </div>
            <div className="flex items-center text-indigo-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
              <span className="text-sm">Learn more</span>
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </article>
          
          <article className="group bg-white/70 backdrop-blur-sm rounded-2xl p-8 hover:bg-white hover:shadow-2xl transition-all duration-500 border border-red-100 hover:border-red-200 transform hover:-translate-y-2">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <FileText className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="feature-title text-2xl font-bold mb-3 text-gray-900 group-hover:text-red-900 transition-colors">Proper Documentation</h3>
              <p className="feature-description text-gray-600 leading-relaxed">
                Get detailed reports of what moved, what didn't, and why - for your records and peace of mind
              </p>
            </div>
            <div className="flex items-center text-red-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
              <span className="text-sm">Learn more</span>
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </article>
        </section>

        {/* Migration Types */}
        <section className="relative bg-gradient-to-br from-white via-blue-50 to-indigo-50 rounded-3xl p-12 shadow-2xl border border-blue-100" aria-labelledby="migration-types-heading">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100 to-transparent rounded-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-indigo-100 to-transparent rounded-3xl opacity-50"></div>
          
          <div className="relative">
            <div className="text-center mb-12">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 text-sm font-medium mb-6">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Migration Scenarios
              </div>
              <h2 id="migration-types-heading" className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Common Migration Situations
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                We've designed our platform to handle the most challenging workspace migration scenarios
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <article className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-l-4 border-blue-500 hover:border-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="feature-title text-xl font-bold mb-3 text-gray-900 group-hover:text-blue-900 transition-colors">Moving Domains Around</h3>
                    <p className="feature-description text-gray-600 leading-relaxed">
                      When you need to move users between domains in the same Workspace org
                    </p>
                  </div>
                </div>
              </article>
              
              <article className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-l-4 border-green-500 hover:border-green-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="feature-title text-xl font-bold mb-3 text-gray-900 group-hover:text-green-900 transition-colors">Company Acquisitions</h3>
                    <p className="feature-description text-gray-600 leading-relaxed">
                      Moving users from one company's Workspace to another's (the tricky cross-tenant stuff)
                    </p>
                  </div>
                </div>
              </article>
              
              <article className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-l-4 border-purple-500 hover:border-purple-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="feature-title text-xl font-bold mb-3 text-gray-900 group-hover:text-purple-900 transition-colors">Consolidating Domains</h3>
                    <p className="feature-description text-gray-600 leading-relaxed">
                      You've got multiple domains and want everyone under one roof
                    </p>
                  </div>
                </div>
              </article>
              
              <article className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-l-4 border-orange-500 hover:border-orange-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="feature-title text-xl font-bold mb-3 text-gray-900 group-hover:text-orange-900 transition-colors">Splitting Things Up</h3>
                    <p className="feature-description text-gray-600 leading-relaxed">
                      Breaking up one domain into separate ones (spin-offs, divisions, etc.)
                    </p>
                  </div>
                </div>
              </article>
            </div>
            
            <div className="mt-12 text-center">
              <Link href="/dashboard" className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                <span>Get Started Today</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
    </>
  )
}
