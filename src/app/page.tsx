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
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl animate-float-slow"></div>
        </div>

        {/* Header */}
        <header className="bg-white/90 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-50" role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center group">
                <div className="p-3 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl mr-4 shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:scale-105">
                  <Database className="h-7 w-7 text-white" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-2xl font-black bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                    MigrateGWS
                  </span>
                  <div className="text-xs text-gray-500 font-medium tracking-wide">
                    Secure Google Workspace Migration
                  </div>
                </div>
              </div>
              <nav className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Main navigation">
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-semibold transition-all duration-300 hover:scale-105 transform relative group">
                  Dashboard
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/migrations" className="text-gray-600 hover:text-blue-600 font-semibold transition-all duration-300 hover:scale-105 transform relative group">
                  Migrations
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/user-mapping" className="text-gray-600 hover:text-blue-600 font-semibold transition-all duration-300 hover:scale-105 transform relative group">
                  User Mapping
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-blue-600 font-semibold transition-all duration-300 hover:scale-105 transform relative group">
                  Settings
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:w-full transition-all duration-300"></span>
                </Link>
                <Link href="/login" className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-8 py-3 rounded-2xl hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 font-bold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1">
                  Sign In
                </Link>
              </nav>
              
              {/* Mobile menu button */}
              <div className="md:hidden">
                <button className="p-3 rounded-2xl text-gray-600 hover:text-blue-600 hover:bg-white/50 transition-all duration-300 backdrop-blur-sm shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="relative z-10" role="main">
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center" aria-labelledby="hero-heading">
            {/* Status Badge */}
            <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 text-blue-800 text-sm font-bold mb-8 shadow-xl backdrop-blur-sm border border-white/20 hover:scale-105 transition-transform duration-300">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mr-3 animate-pulse shadow-lg"></div>
              Built for IT Professionals & Resellers
              <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            
            {/* Main Title */}
            <h1 id="hero-heading" className="relative mb-12">
              <div className="text-7xl md:text-8xl lg:text-9xl font-black leading-none tracking-tight mb-4">
                <span className="block bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 bg-clip-text text-transparent drop-shadow-sm">
                  Migrate Your
                </span>
                <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent animate-gradient-x drop-shadow-xl">
                  Google Workspace
                </span>
              </div>
              <div className="text-4xl md:text-5xl lg:text-6xl font-light bg-gradient-to-r from-gray-600 via-gray-800 to-gray-600 bg-clip-text text-transparent tracking-wide">
                with Confidence
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full opacity-60 animate-bounce"></div>
              <div className="absolute top-1/2 -right-8 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full opacity-60 animate-bounce delay-500"></div>
            </h1>
            
            {/* Subtitle */}
            <div className="max-w-5xl mx-auto mb-12">
              <p className="text-xl md:text-2xl text-gray-700 font-semibold leading-relaxed mb-6">
                Seamlessly transfer your Gmail, Drive, Calendar, and other Google Workspace data between domains with our enterprise-grade migration platform.
              </p>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                Built by IT professionals who understand the pain of tenant-to-tenant migrations. 
                Get real visibility, proper security, and actually finish your projects on time.
              </p>
            </div>
            
            {/* Feature Highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
              <div className="flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:scale-105 transition-transform duration-300">
                <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full shadow-lg"></div>
                <span className="text-gray-700 font-semibold text-sm">Cross-tenant migration support</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:scale-105 transition-transform duration-300">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full shadow-lg"></div>
                <span className="text-gray-700 font-semibold text-sm">Advanced domain & user mapping</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:scale-105 transition-transform duration-300">
                <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full shadow-lg"></div>
                <span className="text-gray-700 font-semibold text-sm">Real-time progress monitoring</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:scale-105 transition-transform duration-300">
                <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-red-500 rounded-full shadow-lg"></div>
                <span className="text-gray-700 font-semibold text-sm">Comprehensive audit reports</span>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-6 mb-20">
              <Link href="/migrations/new" className="group relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105 hover:-translate-y-2 overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative flex items-center justify-center">
                  Start Migration
                  <svg className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link href="/dashboard" className="group relative bg-white/90 backdrop-blur-sm text-gray-800 border-2 border-gray-200 px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 hover:-translate-y-2 hover:bg-white hover:border-blue-300">
                <span className="flex items-center justify-center">
                  View Dashboard
                  <svg className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            </div>
          </section>

          {/* Feature Cards */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20" aria-labelledby="features-heading">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-gray-100 to-blue-100 text-gray-800 text-sm font-bold mb-6">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Platform Features
              </div>
              <h2 id="features-heading" className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Why IT Pros Choose Us
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Enterprise-grade features designed for complex migration scenarios
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <article className="group relative bg-gradient-to-br from-white/80 to-blue-50/50 backdrop-blur-sm rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 border border-white/30 hover:border-blue-200/50 transform hover:-translate-y-3 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/50 to-transparent rounded-3xl"></div>
            <div className="relative">
              <div className="w-18 h-18 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Users className="h-10 w-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-gray-900 group-hover:text-blue-900 transition-colors">Smart User Mapping</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Intelligent user mapping between domains - handle one-to-one, split accounts, merges, and complex scenarios with visual drag-and-drop tools.
              </p>
              <div className="flex items-center text-blue-600 font-bold group-hover:translate-x-3 transition-transform duration-300">
                <span>Explore mapping tools</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </article>
          
          <article className="group relative bg-gradient-to-br from-white/80 to-green-50/50 backdrop-blur-sm rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 border border-white/30 hover:border-green-200/50 transform hover:-translate-y-3 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-100/50 to-transparent rounded-3xl"></div>
            <div className="relative">
              <div className="w-18 h-18 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Shield className="h-10 w-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-gray-900 group-hover:text-green-900 transition-colors">Enterprise Security</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Built on Google's OAuth 2.0 and domain-wide delegation. No password storage, no API key exposure - just secure, auditable access control.
              </p>
              <div className="flex items-center text-green-600 font-bold group-hover:translate-x-3 transition-transform duration-300">
                <span>Security overview</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </article>
          
          <article className="group relative bg-gradient-to-br from-white/80 to-purple-50/50 backdrop-blur-sm rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 border border-white/30 hover:border-purple-200/50 transform hover:-translate-y-3 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100/50 to-transparent rounded-3xl"></div>
            <div className="relative">
              <div className="w-18 h-18 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <BarChart3 className="h-10 w-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-gray-900 group-hover:text-purple-900 transition-colors">Real-Time Visibility</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Live progress tracking with detailed insights. Know exactly what's happening, identify bottlenecks, and get actionable alerts when intervention is needed.
              </p>
              <div className="flex items-center text-purple-600 font-bold group-hover:translate-x-3 transition-transform duration-300">
                <span>View monitoring</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </article>
          
          <article className="group relative bg-gradient-to-br from-white/80 to-orange-50/50 backdrop-blur-sm rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 border border-white/30 hover:border-orange-200/50 transform hover:-translate-y-3 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-100/50 to-transparent rounded-3xl"></div>
            <div className="relative">
              <div className="w-18 h-18 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Settings className="h-10 w-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-gray-900 group-hover:text-orange-900 transition-colors">Visual Configuration</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Intuitive drag-and-drop interface for complex domain mappings. No more spreadsheets or config files - visualize your migration strategy.
              </p>
              <div className="flex items-center text-orange-600 font-bold group-hover:translate-x-3 transition-transform duration-300">
                <span>Try visual setup</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </article>
          
          <article className="group relative bg-gradient-to-br from-white/80 to-indigo-50/50 backdrop-blur-sm rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 border border-white/30 hover:border-indigo-200/50 transform hover:-translate-y-3 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-100/50 to-transparent rounded-3xl"></div>
            <div className="relative">
              <div className="w-18 h-18 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Database className="h-10 w-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-gray-900 group-hover:text-indigo-900 transition-colors">Complete Data Migration</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Gmail, Drive files, calendars, contacts, shared drives, Chat spaces - comprehensive migration of all Google Workspace services.
              </p>
              <div className="flex items-center text-indigo-600 font-bold group-hover:translate-x-3 transition-transform duration-300">
                <span>See all services</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </article>
          
          <article className="group relative bg-gradient-to-br from-white/80 to-red-50/50 backdrop-blur-sm rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 border border-white/30 hover:border-red-200/50 transform hover:-translate-y-3 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-100/50 to-transparent rounded-3xl"></div>
            <div className="relative">
              <div className="w-18 h-18 bg-gradient-to-br from-red-500 to-red-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <FileText className="h-10 w-10 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-black mb-4 text-gray-900 group-hover:text-red-900 transition-colors">Comprehensive Reporting</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Detailed audit trails, migration reports, and compliance documentation. Track what moved, what didn't, and why - for your peace of mind.
              </p>
              <div className="flex items-center text-red-600 font-bold group-hover:translate-x-3 transition-transform duration-300">
                <span>View sample reports</span>
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </article>
        </div>
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
