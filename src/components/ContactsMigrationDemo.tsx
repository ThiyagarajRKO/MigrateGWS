/**
 * Contacts Migration Demo Component
 * Demonstrates how to use the ContactsMigrationService
 */

import React, { useState } from 'react';
import { 
  ContactsMigrationService, 
  MigrationServiceFactory, 
  DEFAULT_SERVICE_OPTIONS 
} from '../services/migration';

interface ContactsMigrationDemoProps {
  userMappings: Array<{
    sourceEmail: string;
    targetEmail: string;
  }>;
}

export function ContactsMigrationDemo({ userMappings }: ContactsMigrationDemoProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);

  const runContactsMigration = async () => {
    if (!userMappings.length) {
      alert('No user mappings provided');
      return;
    }

    setIsRunning(true);
    setResults([]);
    
    try {
      // Create contacts migration service with default options
      const contactsService = MigrationServiceFactory.createContactsService(
        {
          sourceToken: 'your-source-token',
          targetToken: 'your-target-token',
        },
        {
          id: 'contacts-migration',
          name: 'Contacts Migration',
          mappingType: 'one-to-one',
          userMappings: [],
          services: ['contacts'],
          options: {
            preservePermissions: true,
            preserveSharing: true,
            batchSize: 10,
            retryAttempts: 3,
            throttleMs: 1000,
          },
        },
        DEFAULT_SERVICE_OPTIONS.contacts
      );

      const migrationResults = [];

      for (const mapping of userMappings) {
        console.log(`Starting contacts migration: ${mapping.sourceEmail} → ${mapping.targetEmail}`);
        
        const result = await contactsService.migrateOneToOne(
          mapping.sourceEmail,
          mapping.targetEmail
        );
        
        migrationResults.push({
          mapping,
          result,
        });
      }

      setResults(migrationResults);
      
    } catch (error) {
      console.error('Contacts migration failed:', error);
      alert(`Migration failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4">Contacts Migration</h3>
      
      <div className="mb-4">
        <h4 className="font-medium mb-2">User Mappings:</h4>
        {userMappings.length === 0 ? (
          <p className="text-gray-500">No user mappings configured</p>
        ) : (
          <ul className="space-y-1">
            {userMappings.map((mapping, index) => (
              <li key={index} className="text-sm">
                {mapping.sourceEmail} → {mapping.targetEmail}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">Migration Options:</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <div>✓ Preserve contact groups</div>
          <div>✓ Preserve contact photos</div>
          <div>✓ Preserve custom fields</div>
          <div>• Batch size: 10 contacts per batch</div>
          <div>• Retry attempts: 3</div>
          <div>• Throttle: 1 second between requests</div>
        </div>
      </div>

      <button
        onClick={runContactsMigration}
        disabled={isRunning || userMappings.length === 0}
        className={`px-4 py-2 rounded font-medium ${
          isRunning || userMappings.length === 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isRunning ? 'Migrating Contacts...' : 'Start Contacts Migration'}
      </button>

      {progress && (
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <h4 className="font-medium">Migration Progress</h4>
          <div className="text-sm">
            <div>Service: {progress.serviceType}</div>
            <div>User: {progress.userId}</div>
            <div>Status: {progress.status}</div>
            <div>Progress: {progress.progress}%</div>
            {progress.details?.currentItem && (
              <div>Current: {progress.details.currentItem}</div>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Migration Results:</h4>
          <div className="space-y-2">
            {results.map((item, index) => (
              <div key={index} className="p-3 border rounded">
                <div className="font-medium">
                  {item.mapping.sourceEmail} → {item.mapping.targetEmail}
                </div>
                <div className={`text-sm ${item.result.success ? 'text-green-600' : 'text-red-600'}`}>
                  Status: {item.result.success ? 'Success' : 'Failed'}
                </div>
                <div className="text-sm text-gray-600">
                  Total: {item.result.summary.totalItems}, 
                  Success: {item.result.summary.successfulItems}, 
                  Failed: {item.result.summary.failedItems}
                </div>
                {item.result.errors.length > 0 && (
                  <div className="text-sm text-red-600 mt-1">
                    Errors: {item.result.errors.join(', ')}
                  </div>
                )}
                {item.result.warnings.length > 0 && (
                  <div className="text-sm text-yellow-600 mt-1">
                    Warnings: {item.result.warnings.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-50 rounded text-sm text-yellow-800">
        <strong>Note:</strong> This is a demo component. In a real implementation, you would need to:
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Set up proper Google OAuth2 authentication</li>
          <li>Configure Google People API access</li>
          <li>Handle user consent for contacts access</li>
          <li>Implement proper error handling and logging</li>
          <li>Add progress tracking and cancellation support</li>
        </ul>
      </div>
    </div>
  );
}
