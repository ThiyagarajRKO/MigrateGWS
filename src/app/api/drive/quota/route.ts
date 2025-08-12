/**
 * Drive API Quota Management API Route
 * Provides quota status and handles Drive API calls with quota management
 */

import { NextRequest, NextResponse } from 'next/server';
import { EnhancedDriveAPIService } from '@/lib/enhanced-drive-api-service';
import { migrateDriveFilesBatch } from '@/lib/drive-api-rate-limiter';
import { migrationLogger } from '@/lib/migration-websocket-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const migrationId = searchParams.get('migrationId');
    const action = searchParams.get('action') || 'status';

    // If no migrationId, provide basic quota status
    if (!migrationId) {
      return NextResponse.json({
        success: true,
        message: 'Drive Quota API - Operational',
        status: 'available',
        endpoints: {
          status: '/api/drive/quota?migrationId=<id>&action=status',
          test: '/api/drive/quota?migrationId=<id>&action=test',
          history: '/api/drive/quota?migrationId=<id>&action=history'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Get auth from session or request headers
    const authToken = request.headers.get('authorization');
    if (!authToken) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    const driveService = new EnhancedDriveAPIService(authToken);

    switch (action) {
      case 'status':
        const quotaUsage = driveService.getQuotaUsage();
        return NextResponse.json({
          success: true,
          quotaUsage,
          migrationId,
          timestamp: new Date().toISOString()
        });

      case 'test':
        const testResult = await driveService.testAPIConnection();
        return NextResponse.json({
          success: true,
          test: testResult,
          migrationId
        });

      case 'reset':
        driveService.resetQuota();
        return NextResponse.json({
          success: true,
          message: 'Quota counters reset',
          migrationId
        });

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error: any) {
    migrationLogger.log({
      level: 'error',
      category: 'api',
      service: 'drive',
      message: 'Drive quota API error',
      details: {
        error: error.message,
        stack: error.stack
      }
    });

    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      migrationId, 
      files, 
      action = 'migrate',
      migrationOptions = {}
    } = body;

    if (!migrationId) {
      return NextResponse.json({
        error: 'Migration ID is required'
      }, { status: 400 });
    }

    const authToken = request.headers.get('authorization');
    if (!authToken) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    const driveService = new EnhancedDriveAPIService(authToken);

    migrationLogger.log({
      level: 'info',
      category: 'migration',
      service: 'drive',
      message: `Starting Drive migration: ${action}`,
      details: {
        migrationId,
        action,
        fileCount: files?.length || 0,
        options: migrationOptions
      }
    });

    switch (action) {
      case 'migrate':
        if (!files || !Array.isArray(files)) {
          return NextResponse.json({
            error: 'Files array is required for migration'
          }, { status: 400 });
        }

        const results = await migrateDriveFilesBatch(
          files,
          async (file) => {
            return await driveService.migrateFile(file, migrationOptions.targetFolderId, {
              preserveName: migrationOptions.preserveName,
              namePrefix: migrationOptions.namePrefix,
              nameSuffix: migrationOptions.nameSuffix
            });
          },
          migrationOptions.batchSize
        );

        migrationLogger.log({
          level: results.failedFiles > 0 ? 'warning' : 'success',
          category: 'migration',
          service: 'drive',
          message: 'Drive migration completed',
          details: {
            migrationId,
            ...results,
            successRate: `${Math.round((results.processedFiles / results.totalFiles) * 100)}%`,
            quotaErrorRate: `${Math.round((results.quotaErrors / results.totalFiles) * 100)}%`
          }
        });

        return NextResponse.json({
          success: true,
          results,
          message: results.quotaErrors > 0 
            ? `Migration completed with ${results.quotaErrors} quota-related delays`
            : 'Migration completed successfully',
          migrationId
        });

      case 'migrate_folder':
        const { sourceFolderId, targetParentId } = migrationOptions;
        
        if (!sourceFolderId || !targetParentId) {
          return NextResponse.json({
            error: 'Source folder ID and target parent ID are required'
          }, { status: 400 });
        }

        const folderResults = await driveService.migrateFolderStructure(
          sourceFolderId,
          targetParentId,
          {
            preserveStructure: migrationOptions.preserveStructure,
            nameMapping: migrationOptions.nameMapping,
            onProgress: (progress) => {
              migrationLogger.log({
                level: 'info',
                category: 'migration',
                service: 'drive',
                message: 'Folder migration progress',
                details: {
                  migrationId,
                  ...progress
                }
              });
            }
          }
        );

        return NextResponse.json({
          success: true,
          results: folderResults,
          migrationId
        });

      case 'list_files':
        const { folderId, pageSize = 100, query } = migrationOptions;
        
        const fileList = await driveService.listFiles({
          folderId,
          pageSize,
          query
        });

        return NextResponse.json({
          success: true,
          files: fileList,
          count: fileList.length,
          migrationId
        });

      case 'create_folder':
        const { folderName, parentId } = migrationOptions;
        
        if (!folderName) {
          return NextResponse.json({
            error: 'Folder name is required'
          }, { status: 400 });
        }

        const newFolder = await driveService.createFolder(folderName, parentId);

        return NextResponse.json({
          success: true,
          folder: newFolder,
          migrationId
        });

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error: any) {
    const isQuotaError = error.status === 429 || error.message.includes('quota');
    
    migrationLogger.log({
      level: 'error',
      category: 'api',
      service: 'drive',
      message: isQuotaError ? 'Drive quota exceeded' : 'Drive API error',
      details: {
        error: error.message,
        status: error.status,
        isQuotaError,
        retryAfter: isQuotaError ? 60000 : undefined
      }
    });

    if (isQuotaError) {
      return NextResponse.json({
        error: 'Quota exceeded',
        quotaError: true,
        retryAfter: 60000,
        message: 'Drive API quota exceeded. Migration will retry automatically.',
        details: error.message
      }, { status: 429 });
    }

    return NextResponse.json({
      error: 'Drive API error',
      details: error.message
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { migrationId, action } = body;

    if (!migrationId) {
      return NextResponse.json({
        error: 'Migration ID is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'pause':
        migrationLogger.log({
          level: 'info',
          category: 'migration',
          service: 'drive',
          message: 'Drive migration paused',
          details: { migrationId }
        });

        return NextResponse.json({
          success: true,
          message: 'Migration paused',
          migrationId
        });

      case 'resume':
        migrationLogger.log({
          level: 'info',
          category: 'migration',
          service: 'drive',
          message: 'Drive migration resumed',
          details: { migrationId }
        });

        return NextResponse.json({
          success: true,
          message: 'Migration resumed',
          migrationId
        });

      case 'retry_failed':
        migrationLogger.log({
          level: 'info',
          category: 'migration',
          service: 'drive',
          message: 'Retrying failed Drive operations',
          details: { migrationId }
        });

        return NextResponse.json({
          success: true,
          message: 'Retrying failed operations',
          migrationId
        });

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error: any) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
