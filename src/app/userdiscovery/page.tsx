'use client';

import { Suspense } from 'react';
import UserMapping from '@/components/UserMapping';

export default function UserDiscoveryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            User Discovery & Mapping
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Discover users from your source domain and map them to target domains. 
            Users that don't exist in the target domain will be automatically cloned 
            based on their first and last names.
          </p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading user discovery...</span>
          </div>
        }>
          <UserMapping />
        </Suspense>
      </div>
    </div>
  );
}
