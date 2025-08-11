'use client';

import Link from 'next/link'
import { 
  Users, 
  Database, 
  Settings, 
  BarChart3, 
  Shield, 
  FileText, 
  Coffee, 
  Clock, 
  CheckCircle, 
  Zap,
  ArrowRight,
  Star,
  Sparkles,
  Target,
  TrendingUp,
  Gauge,
  ChevronRight,
  Activity
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
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
      
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50">
        {/* Modern Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-secondary-200/50" role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <Database className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
                </div>
                <div>
                  <span className="text-lg font-bold text-secondary-900">MigrateGWS</span>
                  <div className="text-xs text-secondary-600">Enterprise Migration Platform</div>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center space-x-8">
                <Link href="/dashboard" className="text-sm text-secondary-700 hover:text-primary-600 font-medium transition-all hover:scale-105">
                  Dashboard
                </Link>
                <Link href="/migrations" className="text-sm text-secondary-700 hover:text-primary-600 font-medium transition-all hover:scale-105">
                  Migrations
                </Link>
                <Link href="/login">
                  <Button variant="primary" size="sm" className="shadow-lg hover:shadow-xl">
                    <span>Get Started</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Hero Section - Centered & Symmetrical */}
        <section className="relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-100/20 via-transparent to-primary-100/20"></div>
          </div>
          
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            {/* Status Badge - Centered */}
            <div className="text-center mb-12">
              <Badge variant="info" className="mb-8 px-4 py-2 text-sm">
                <Sparkles className="w-3 h-3 mr-2" />
                Built by IT professionals who actually migrate workspaces
              </Badge>
              
              {/* Main Headline - Perfectly Centered */}
              <div className="space-y-6 mb-12">
                <h1 className="text-5xl md:text-7xl font-bold text-secondary-900 leading-tight">
                  Enterprise Google
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700">
                    Workspace Migration
                  </span>
                </h1>
                
                <p className="text-xl text-secondary-700 max-w-3xl mx-auto leading-relaxed">
                  Professional-grade migration platform for cross-tenant moves, domain consolidation, 
                  and organizational restructuring. Zero downtime, maximum reliability.
                </p>
              </div>

              {/* Symmetrical CTA Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16">
                <Link href="/migrations/new">
                  <Button size="lg" className="min-w-[220px] text-lg py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1">
                    <Zap className="h-5 w-5 mr-2" />
                    Start Migration
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="lg" className="min-w-[220px] text-lg py-4 hover:shadow-lg">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    View Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Symmetrical Stats Section */}
        <section className="py-16 bg-white/70 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-3">
                <div className="text-4xl font-bold text-primary-600">10K+</div>
                <div className="text-sm text-secondary-600 font-medium">Users Migrated</div>
              </div>
              <div className="space-y-3">
                <div className="text-4xl font-bold text-success-600">99.9%</div>
                <div className="text-sm text-secondary-600 font-medium">Uptime</div>
              </div>
              <div className="space-y-3">
                <div className="text-4xl font-bold text-warning-600">500+</div>
                <div className="text-sm text-secondary-600 font-medium">Organizations</div>
              </div>
              <div className="space-y-3">
                <div className="text-4xl font-bold text-info-600">24/7</div>
                <div className="text-sm text-secondary-600 font-medium">Support</div>
              </div>
            </div>
          </div>
        </section>

        {/* Symmetrical Features Grid */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-secondary-900 mb-6">
                Enterprise-Grade Migration Platform
              </h2>
              <p className="text-xl text-secondary-700 max-w-3xl mx-auto">
                Built for IT professionals who need reliable, scalable workspace migrations
              </p>
            </div>
            
            {/* 2x2 Symmetrical Grid */}
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Top Left */}
              <Card className="group hover:shadow-2xl transition-all duration-300 border-l-4 border-primary-500 h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Users className="h-7 w-7 text-white" />
                    </div>
                    <Star className="h-6 w-6 text-warning-500" />
                  </div>
                  <CardTitle className="text-2xl group-hover:text-primary-600 transition-colors">
                    Smart User Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-700 text-lg leading-relaxed">
                    AI-powered conflict resolution, bulk operations, and visual mapping tools. 
                    Handle complex organizational restructuring with confidence.
                  </p>
                </CardContent>
              </Card>

              {/* Top Right */}
              <Card className="group hover:shadow-2xl transition-all duration-300 border-l-4 border-success-500 h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Shield className="h-7 w-7 text-white" />
                    </div>
                    <Gauge className="h-6 w-6 text-primary-500" />
                  </div>
                  <CardTitle className="text-2xl group-hover:text-success-600 transition-colors">
                    Enterprise Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-700 text-lg leading-relaxed">
                    OAuth 2.0 delegation, encrypted data transfer, and audit trails. 
                    Meet compliance requirements without compromising security.
                  </p>
                </CardContent>
              </Card>

              {/* Bottom Left */}
              <Card className="group hover:shadow-2xl transition-all duration-300 border-l-4 border-info-500 h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-info-500 to-info-600 rounded-xl flex items-center justify-center shadow-lg">
                      <BarChart3 className="h-7 w-7 text-white" />
                    </div>
                    <TrendingUp className="h-6 w-6 text-success-500" />
                  </div>
                  <CardTitle className="text-2xl group-hover:text-info-600 transition-colors">
                    Real-time Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-700 text-lg leading-relaxed">
                    Live progress tracking, detailed logs, and instant notifications. 
                    Know exactly what's happening at every step.
                  </p>
                </CardContent>
              </Card>

              {/* Bottom Right */}
              <Card className="group hover:shadow-2xl transition-all duration-300 border-l-4 border-warning-500 h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Target className="h-7 w-7 text-white" />
                    </div>
                    <CheckCircle className="h-6 w-6 text-success-500" />
                  </div>
                  <CardTitle className="text-2xl group-hover:text-warning-600 transition-colors">
                    Zero-Downtime Process
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-700 text-lg leading-relaxed">
                    Parallel processing, automatic rollback, and error recovery. 
                    Your users won't even notice the migration happening.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* New Microservices Architecture Section */}
        <section className="py-20 bg-gradient-to-br from-primary-50 to-secondary-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <Badge variant="info" className="mb-6 px-4 py-2">
                <Database className="w-3 h-3 mr-2" />
                Enterprise Architecture
              </Badge>
              <h2 className="text-4xl font-bold text-secondary-900 mb-6">
                Microservices Migration Platform
              </h2>
              <p className="text-xl text-secondary-700 max-w-3xl mx-auto">
                Built with enterprise-grade microservices architecture for scalability, 
                reliability, and real-time monitoring across all Google Workspace services.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <Card className="text-center hover:shadow-lg transition-all duration-300 border-t-4 border-primary-500">
                <CardHeader>
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Database className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Distributed Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-600">
                    Separate microservices for Gmail, Drive, Calendar, Contacts, Chat, Groups, and Photos 
                    enable parallel processing and service-specific optimizations.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover:shadow-lg transition-all duration-300 border-t-4 border-success-500">
                <CardHeader>
                  <div className="w-16 h-16 bg-gradient-to-br from-success-500 to-success-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Activity className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Real-time Orchestration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-600">
                    Central orchestrator manages job distribution, monitors health, and provides 
                    real-time updates through WebSocket connections.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover:shadow-lg transition-all duration-300 border-t-4 border-info-500">
                <CardHeader>
                  <div className="w-16 h-16 bg-gradient-to-br from-info-500 to-info-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Shared Authentication</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-secondary-600">
                    Single service account with domain-wide delegation and impersonation 
                    provides secure, centralized authentication across all services.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">
              <Link href="/microservices">
                <Button size="lg" variant="outline" className="text-lg py-4 px-8 hover:shadow-lg">
                  <Settings className="h-5 w-5 mr-2" />
                  Explore Architecture
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Professional Trust Section */}
        <section className="py-20 bg-gradient-to-r from-secondary-900 to-secondary-800 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="mb-12">
              <Badge variant="outline" className="text-white border-white/30 mb-6 px-4 py-2">
                <Coffee className="w-4 h-4 mr-2" />
                Built by IT professionals
              </Badge>
              
              <h2 className="text-4xl font-bold mb-6">
                Stop Wrestling with Manual Migrations
              </h2>
              
              <p className="text-xl text-secondary-300 max-w-4xl mx-auto leading-relaxed">
                We've been where you are. Spending weekends babysitting migrations, 
                dealing with OAuth headaches, and explaining delays to executives. 
                That's why we built this platform.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-10 mt-16">
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Save Weeks of Work</h3>
                <p className="text-secondary-300 text-lg">Automated workflows replace manual processes</p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Enterprise Reliability</h3>
                <p className="text-secondary-300 text-lg">99.9% uptime with automatic error recovery</p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Proven at Scale</h3>
                <p className="text-secondary-300 text-lg">500+ successful enterprise migrations</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-24 bg-gradient-to-br from-primary-50 to-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-white rounded-3xl shadow-2xl p-16 border border-primary-100">
              <h2 className="text-5xl font-bold text-secondary-900 mb-8">
                Ready to Migrate Like a Pro?
              </h2>
              
              <p className="text-2xl text-secondary-700 mb-12 max-w-3xl mx-auto">
                Join hundreds of IT teams who've made the switch to automated, 
                reliable Google Workspace migrations.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-8 mb-8">
                <Link href="/migrations/new">
                  <Button size="lg" className="min-w-[250px] text-xl py-6 shadow-xl hover:shadow-2xl">
                    <Zap className="h-6 w-6 mr-3" />
                    Start Your Migration
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button variant="outline" size="lg" className="min-w-[250px] text-xl py-6">
                    <BarChart3 className="h-6 w-6 mr-3" />
                    Schedule Demo
                  </Button>
                </Link>
              </div>

              <div className="text-lg text-secondary-600 space-x-8">
                <span>✓ No credit card required</span>
                <span>✓ 30-day free trial</span>
                <span>✓ Expert support included</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
