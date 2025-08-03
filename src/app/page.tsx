'use client';

import Link from 'next/link'
import { Users, Database, Settings, BarChart3, Shield, FileText, Coffee, Clock, CheckCircle, Zap } from 'lucide-react'
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
      
      <div className="min-h-screen bg-gray-50">
        {/* Simple Header */}
        <header className="bg-white border-b border-gray-200" role="banner">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <Database className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-xl font-semibold text-gray-900">MigrateGWS</span>
                  <div className="text-sm text-gray-600">Google Workspace Migration</div>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center space-x-8">
                <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/migrations" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                  Migrations
                </Link>
                <Link href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Sign In
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14" role="main">
          {/* Status */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-7 border border-blue-100 transform -rotate-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
              Built by IT folks who actually do this stuff
            </div>
            
            <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-6 leading-tight">
              Move Google Workspace
              <br />
              <span className="text-blue-600 underline decoration-wavy decoration-blue-300">Without Losing Sleep</span>
            </h1>
            
            <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed font-medium">
              Tired of manually migrating users one by one? We built this because we were sick of 
              spending weekends babysitting migrations that should just work. Cross-tenant, 
              domain consolidation, company splits - we've been there.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-14">
              <Link href="/migrations/new" className="bg-blue-600 text-white px-7 py-3 rounded-lg hover:bg-blue-700 transition-all font-semibold transform hover:-translate-y-1 hover:shadow-lg">
                Start a Migration →
              </Link>
              <Link href="/dashboard" className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all font-semibold">
                See How It Works
              </Link>
            </div>
          </div>

          {/* What We Actually Do */}
          <section className="mb-18">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 mb-5">
                What This Thing Actually Does
              </h2>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto leading-relaxed">
                No marketing fluff. Here's what happens when you use our tool.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-7">
              <div className="bg-white rounded-lg p-6 shadow border border-gray-200 hover:shadow-lg transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Maps Users Intelligently
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Point it at your source domains, tell it where users should go. 
                  It figures out conflicts, handles duplicates, and doesn't break existing setups.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow border border-gray-200 hover:shadow-lg transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Handles the OAuth Mess
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Cross-tenant migrations are a pain because of Google's security (which is good!). 
                  We walk you through the delegation setup so it actually works.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow border border-gray-200 hover:shadow-lg transition-all transform hover:-translate-y-1">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Shows You What's Happening
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Real progress bars, actual error messages you can understand, 
                  and logs that help you figure out what went wrong (if anything did).
                </p>
              </div>
            </div>
          </section>

          {/* Real Talk Section */}
          <section className="bg-blue-50 rounded-xl p-7 mb-18 border-l-4 border-blue-300 transform -rotate-1">
            <div className="max-w-4xl mx-auto transform rotate-1">
              <div className="flex items-start space-x-4 mb-5">
                <div className="w-11 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 transform rotate-3">
                  <Coffee className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                    Real Talk About Workspace Migrations
                  </h2>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Look, we've all been there. Here's the honest truth about what usually goes wrong:
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-800 text-sm font-medium">Manual exports that take forever and miss stuff</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-800 text-sm font-medium">CSV files with 2000 users that you have to process one by one</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-800 text-sm font-medium">OAuth permissions that break halfway through</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-800 text-sm font-medium">Users ending up in the wrong domains</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-4 text-blue-500" />
                    <span className="text-gray-800 text-sm font-medium">Bulk user discovery and smart mapping</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-800 text-sm font-medium">Handles duplicate names and email conflicts</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-5 text-blue-500" />
                    <span className="text-gray-800 text-sm font-medium">Proper OAuth setup with clear instructions</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-4 text-blue-500" />
                    <span className="text-gray-800 text-sm font-medium">Batch processing with progress tracking</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-100 rounded-lg border border-blue-200 transform rotate-1">
                <p className="text-blue-800 font-medium text-sm leading-relaxed">
                  💡 <strong>Pro tip:</strong> Test with a few users first. Always. Even we do this and we built the thing.
                </p>
              </div>
            </div>
          </section>

          {/* Migration Scenarios */}
          <section className="mb-14 transform -rotate-1 border-l-4 border-blue-400">
            <div className="text-center mb-8 ml-3">
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                <span className="border-b-4 border-wavy border-blue-500">Common Situations We Handle</span>
              </h2>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto leading-relaxed">
                These are the scenarios we see most often. Sound familiar?
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-5 ml-3">
              <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all transform rotate-1 hover:scale-102">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-7 h-6 bg-blue-100 rounded-lg flex items-center justify-center transform -rotate-12">
                    <span className="text-blue-600 font-bold text-xs">1</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Company Got Acquired</h3>
                </div>
                <p className="text-gray-700 mb-3 text-sm leading-relaxed font-medium">
                  You need to move everyone from oldcompany.com to newparent.com, 
                  but they're in completely different Google Workspace organizations.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  → Cross-tenant migration with user mapping
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all transform -rotate-2 mt-2 hover:scale-102">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-6 h-7 bg-blue-100 rounded-lg flex items-center justify-center transform rotate-6">
                    <span className="text-blue-600 font-bold text-xs">2</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Cleaning Up Domains</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                  You've got users scattered across division1.com, division2.com, 
                  and want everyone under one domain.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  → Many-to-one consolidation
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all transform rotate-2 hover:scale-102">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xs">3</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Spinning Off a Division</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                  Part of your company is becoming its own thing and needs 
                  their own Workspace with their users moved over.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  → Selective user migration
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all transform -rotate-1 mt-3 hover:scale-102">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-5 h-7 bg-blue-100 rounded-lg flex items-center justify-center transform rotate-12">
                    <span className="text-blue-600 font-bold text-xs">4</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">The Rebrand</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                  Company name changed, need to move everyone from oldname.com 
                  to shinynewaname.com while keeping everything else the same.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  → Simple domain rename migration
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-14 py-12 bg-gray-50 border-t-2 border-blue-500 transform rotate-1">
            <div className="max-w-4xl mx-auto px-4">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                <span className="border-b-4 border-wavy border-blue-500">How It Actually Works</span>
              </h2>
              
              <div className="grid md:grid-cols-3 gap-7">
                <div className="text-center p-5 bg-white rounded-lg shadow-sm hover:scale-105 transition-transform">
                  <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Connect & Map</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Point us to your source and target domains. We'll discover all your users and let you map them properly.
                  </p>
                </div>
                
                <div className="text-center p-5 bg-white rounded-lg shadow-sm hover:scale-105 transition-transform">
                  <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Review & Test</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Check the mappings, resolve any conflicts, and test with a small batch first. Trust us on this.
                  </p>
                </div>
                
                <div className="text-center p-5 bg-white rounded-lg shadow-sm hover:scale-105 transition-transform">
                  <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Migrate</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Hit the button and watch it go. We'll handle the heavy lifting while you get real-time progress updates.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="text-center bg-blue-50 rounded-lg p-8 transform -rotate-1 border-r-4 border-blue-300">
            <h2 className="text-3xl font-semibold text-gray-900 mb-3 transform rotate-1">
              <span className="border-b-4 border-wavy border-blue-500">Ready to Stop Doing This Manually?</span>
            </h2>
            <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto leading-relaxed font-medium">
              Stop spending your weekends wrestling with CSV files and broken OAuth flows. 
              Let's get your migration done properly.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/migrations/new" className="bg-blue-600 text-white px-7 py-3 rounded-lg hover:bg-blue-700 transition-all font-semibold transform hover:scale-105 hover:-rotate-1">
                Start Your First Migration
              </Link>
              <Link href="/dashboard" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-white hover:border-blue-300 transition-all font-semibold transform rotate-1 hover:scale-105">
                Explore the Dashboard
              </Link>
            </div>
            
            <div className="mt-7 flex items-center justify-center space-x-5 text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-3 text-blue-500" />
                <span>Setup in ~10 minutes</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <Shield className="w-3 h-4 text-blue-500" />
                <span>Your data stays in Google</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3 text-blue-500" />
                <span>Built by IT pros</span>
              </div>
            </div>
          </section>
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-gray-200 mt-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <Database className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-gray-800">MigrateGWS</span>
              </div>
              <div className="text-sm text-gray-500">
                Made by people who actually do Google Workspace migrations for a living.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
