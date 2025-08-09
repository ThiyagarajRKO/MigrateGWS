import UserCloneAnalyzer from '@/components/UserCloneAnalyzer';

export default function UserCloneAnalysisPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Clone Analysis</h1>
          <p className="mt-2 text-lg text-gray-600">
            Analyze which users are already cloned and which users need to be created in target domains.
            This tool integrates target user discovery to provide comprehensive clone status analysis.
          </p>
        </div>
        
        <UserCloneAnalyzer />
        
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">How it Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">1. Discovery Phase</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Discovers users from source domain using Google Workspace API</li>
                <li>• Discovers users from target domains using the same logic</li>
                <li>• Uses service account authentication with domain-wide delegation</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">2. Analysis Phase</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Compares source and target users using multiple matching strategies</li>
                <li>• Identifies exact email matches, name matches, and custom mappings</li>
                <li>• Calculates clone percentage and migration readiness</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">3. Recommendations</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Provides suggestions for users that need cloning</li>
                <li>• Identifies conflicting matches that need manual review</li>
                <li>• Prioritizes admin users for account creation</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">4. Export & Planning</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Export analysis results in CSV or JSON format</li>
                <li>• Generate detailed clone plans by target domain</li>
                <li>• Integration ready for automated user creation</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Migration Workflow Integration</h3>
          <p className="text-blue-700 text-sm">
            This user clone analysis integrates seamlessly with your migration workflow. Use the results to:
          </p>
          <ul className="mt-2 text-blue-700 text-sm space-y-1">
            <li>• <strong>Pre-Migration:</strong> Create missing user accounts in target domains</li>
            <li>• <strong>User Mapping:</strong> Map source users to existing target users</li>
            <li>• <strong>Data Migration:</strong> Proceed with confidence knowing all users are properly cloned</li>
            <li>• <strong>Validation:</strong> Verify migration completeness with clone status tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
