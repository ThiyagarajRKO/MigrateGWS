'use client';

import Link from 'next/link'
import { Users, Database, Settings, BarChart3, Shield, FileText, Coffee, Clock, CheckCircle } from 'lucide-react'
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
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Simple Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm" role="banner">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <Database className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-gray-800">MigrateGWS</span>
                  <div className="text-xs text-gray-500">Google Workspace Migration Tool</div>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm">
                  Dashboard
                </Link>
                <Link href="/migrations" className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm">
                  Migrations
                </Link>
                <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Sign In
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12" role="main">
          {/* Status */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Built by IT folks who actually do this stuff
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 leading-tight">
              Move Google Workspace
              <br />
              <span className="text-blue-600">Without Losing Sleep</span>
            </h1>
            
            <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto leading-relaxed">
              Tired of manually migrating users one by one? We built this because we were sick of 
              spending weekends babysitting migrations that should just work. Cross-tenant, 
              domain consolidation, company splits - we've been there.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-12">
              <Link href="/migrations/new" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                Start a Migration →
              </Link>
              <Link href="/dashboard" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all font-semibold">
                See How It Works
              </Link>
            </div>
          </div>

          {/* What We Actually Do */}
          <section className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                What This Thing Actually Does
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                No marketing fluff. Here's what happens when you use our tool.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Maps Users Intelligently
                </h3>
                <p className="text-gray-600 text-sm">
                  Point it at your source domains, tell it where users should go. 
                  It figures out conflicts, handles duplicates, and doesn't break existing setups.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Handles the OAuth Mess
                </h3>
                <p className="text-gray-600 text-sm">
                  Cross-tenant migrations are a pain because of Google's security (which is good!). 
                  We walk you through the delegation setup so it actually works.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Shows You What's Happening
                </h3>
                <p className="text-gray-600 text-sm">
                  Real progress bars, actual error messages you can understand, 
                  and logs that help you figure out what went wrong (if anything did).
                </p>
              </div>
            </div>
          </section>
          {/* Real Talk Section */}
          <section className="bg-blue-50 rounded-lg p-6 mb-16">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Coffee className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-1">
                    Real Talk About Workspace Migrations
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Look, we've all been there. Here's the honest truth about what usually goes wrong:
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">Manual exports that take forever and miss stuff</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">CSV files with 2000 users that you have to process one by one</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">OAuth permissions that break halfway through</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">Users ending up in the wrong domains</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 text-sm">Bulk user discovery and smart mapping</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 text-sm">Handles duplicate names and email conflicts</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 text-sm">Proper OAuth setup with clear instructions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 text-sm">Batch processing with progress tracking</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-blue-800 font-medium text-sm">
                  💡 <strong>Pro tip:</strong> Test with a few users first. Always. Even we do this and we built the thing.
                </p>
              </div>
            </div>
          </section>

          {/* Migration Scenarios */}
          <section className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                Common Situations We Handle
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                These are the scenarios we see most often. Sound familiar?
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xs">1</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Company Got Acquired</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm">
                  You need to move everyone from oldcompany.com to newparent.com, 
                  but they're in completely different Google Workspace organizations.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  → Cross-tenant migration with user mapping
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-md transition-all">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold text-xs">2</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Cleaning Up Domains</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm">
                  You've got users scattered across division1.com, division2.com, 
                  and want everyone under one domain.
                </p>
                <div className="text-xs text-green-600 font-medium">
                  → Many-to-one consolidation
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xs">3</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">Spinning Off a Division</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm">
                  Part of your company is becoming its own thing and needs 
                  their own Workspace with their users moved over.
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  → Selective user migration
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:shadow-md transition-all">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-bold text-xs">4</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800">The Rebrand</h3>
                </div>
                <p className="text-gray-600 mb-3 text-sm">
                  Company name changed, need to move everyone from oldname.com 
                  to shinynewaname.com while keeping everything else the same.
                </p>
                <div className="text-xs text-orange-600 font-medium">
                  → Simple domain rename migration
                </div>
              </div>
            </div>
                <div className="text-sm text-purple-600 font-medium">
                  → Selective user migration
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-6 hover:border-orange-300 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-bold text-sm">4</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Multi-Region Setup</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  You need the same users to exist in multiple regions or 
                  divisions for compliance or organizational reasons.
                </p>
                <div className="text-sm text-orange-600 font-medium">
                  → One-to-many user cloning
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                How This Actually Works
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                No magic, just good engineering. Here's the step-by-step:
              </p>
            </div>
            
            <div className="space-y-8">
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold shadow-lg">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Set Up OAuth Permissions</h3>
                  <p className="text-gray-600">
                    We walk you through setting up domain-wide delegation properly. 
                    This is the tricky part that usually breaks, so we have detailed guides with screenshots.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold shadow-lg">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Discover and Map Users</h3>
                  <p className="text-gray-600">
                    Point the tool at your source domains. It pulls all users, 
                    shows you conflicts, and lets you choose how to map them to target domains.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold shadow-lg">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Create Target Users</h3>
                  <p className="text-gray-600">
                    Batch creates users in the target domains with proper error handling, 
                    rate limiting, and retry logic. You see exactly what's happening.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 bg-green-600 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Migration Report</h3>
                  <p className="text-gray-600">
                    Get a detailed report of what worked, what didn't, and what you need to do next. 
                    No guessing about whether it actually worked.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-blue-50 rounded-xl p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Stop Doing This Manually?
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Set up your first migration in about 10 minutes. 
              Test it with a few users, then let it handle the rest.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/migrations/new" className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-8 py-4 rounded-lg hover:shadow-lg transition-all duration-200 font-semibold text-lg">
                Start Your First Migration
              </Link>
              <Link href="/dashboard" className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg hover:bg-white hover:border-purple-300 transition-all duration-200 font-semibold text-lg">
                Explore the Dashboard
              </Link>
            </div>
            
            <div className="mt-8 flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Setup in ~10 minutes</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Your data stays in Google</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Built by IT pros</span>
              </div>
            </div>
          </section>
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-gray-200 mt-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
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
