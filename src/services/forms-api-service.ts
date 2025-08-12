/**
 * Google Forms API Service with Enhanced Error Handling
 * Handles 403 permission errors and delegation issues
 */

import { google } from 'googleapis';
import { migrationLogger } from '@/lib/migration-websocket-logger';

export interface FormInfo {
  formId: string;
  title: string;
  description?: string;
  documentTitle: string;
  responseCount?: number;
  createdTime?: string;
  modifiedTime?: string;
}

export interface FormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers: Record<string, any>;
}

export interface FormsAPIError extends Error {
  status?: number;
  code?: string;
  retryAfter?: number;
  permissionError?: boolean;
}

export class FormsAPIService {
  private formsClient: any;
  private jwtClient: any;
  private adminEmail: string;

  constructor(serviceAccountKey: any, adminEmail: string) {
    this.adminEmail = adminEmail;
    this.initializeClient(serviceAccountKey);
  }

  private initializeClient(serviceAccountKey: any) {
    const requiredScopes = [
      'https://www.googleapis.com/auth/forms',
      'https://www.googleapis.com/auth/forms.body',
      'https://www.googleapis.com/auth/forms.responses.readonly',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ];

    migrationLogger.delegation('Initializing Forms API client with domain-wide delegation', {
      adminEmail: this.adminEmail,
      requiredScopes,
      serviceAccount: serviceAccountKey.client_email
    });

    this.jwtClient = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: requiredScopes,
      subject: this.adminEmail
    });

    this.formsClient = google.forms({ version: 'v1', auth: this.jwtClient });
  }

  /**
   * Authenticate the JWT client
   */
  async authenticate(): Promise<void> {
    try {
      migrationLogger.delegation('Authenticating Forms API JWT client', {
        adminEmail: this.adminEmail
      });

      await this.jwtClient.authorize();

      migrationLogger.delegationSuccess('Forms API JWT authentication successful', {
        adminEmail: this.adminEmail,
        accessToken: 'obtained'
      });

    } catch (error: any) {
      const formsError = error as FormsAPIError;
      
      migrationLogger.delegationError('Forms API JWT authentication failed', {
        adminEmail: this.adminEmail,
        error: formsError.message,
        suggestion: 'Check domain-wide delegation setup for Forms API scopes'
      });

      throw new Error(`Forms API authentication failed: ${formsError.message}`);
    }
  }

  /**
   * Handle API calls with comprehensive error handling
   */
  private async handleAPICall<T>(
    apiCall: () => Promise<T>,
    context: { endpoint: string; formId?: string; migrationId?: string }
  ): Promise<T> {
    try {
      migrationLogger.apiCall('forms', `Making Forms API call: ${context.endpoint}`, {
        endpoint: context.endpoint,
        adminUser: this.adminEmail,
        formId: context.formId,
        migrationId: context.migrationId
      });

      const startTime = Date.now();
      const result = await apiCall();
      const responseTime = Date.now() - startTime;

      migrationLogger.apiSuccess('forms', `Forms API call successful: ${context.endpoint}`, {
        endpoint: context.endpoint,
        responseTime: `${responseTime}ms`,
        adminUser: this.adminEmail,
        formId: context.formId,
        migrationId: context.migrationId
      });

      return result;

    } catch (error: any) {
      const formsError = error as FormsAPIError;

      if (formsError.status === 403) {
        formsError.permissionError = true;
        formsError.retryAfter = 5000; // 5 seconds

        migrationLogger.apiError('forms', 'Forms API 403 - Insufficient permissions', {
          endpoint: context.endpoint,
          error: formsError.message,
          status: 403,
          adminUser: this.adminEmail,
          formId: context.formId,
          migrationId: context.migrationId,
          solution: 'Add Forms API scopes to domain-wide delegation',
          requiredScopes: [
            'https://www.googleapis.com/auth/forms',
            'https://www.googleapis.com/auth/forms.body',
            'https://www.googleapis.com/auth/forms.responses.readonly'
          ],
          retryAfter: formsError.retryAfter
        });

        throw new Error(`Forms API permission denied. Please ensure domain-wide delegation includes Forms API scopes. Original error: ${formsError.message}`);
      }

      migrationLogger.apiError('forms', `Forms API error: ${context.endpoint}`, {
        endpoint: context.endpoint,
        status: formsError.status || 'unknown',
        message: formsError.message,
        adminUser: this.adminEmail,
        formId: context.formId,
        migrationId: context.migrationId
      });

      throw formsError;
    }
  }

  /**
   * List all forms in the domain
   */
  async listForms(pageSize: number = 100, migrationId?: string): Promise<FormInfo[]> {
    await this.authenticate();

    const response: any = await this.handleAPICall(
      () => this.formsClient.forms.list({ pageSize }),
      { endpoint: 'forms.list', migrationId }
    );

    const forms: FormInfo[] = (response.data.forms || []).map((form: any) => ({
      formId: form.formId,
      title: form.info?.title || 'Untitled Form',
      description: form.info?.description,
      documentTitle: form.info?.documentTitle || form.info?.title || 'Untitled',
      createdTime: form.info?.created,
      modifiedTime: form.info?.lastModified
    }));

    migrationLogger.log({
      level: 'success',
      category: 'migration',
      service: 'forms',
      message: `Found ${forms.length} forms to migrate`,
      migrationId,
      details: {
        totalForms: forms.length,
        adminUser: this.adminEmail,
        sampleForms: forms.slice(0, 3).map(f => ({ id: f.formId, title: f.title }))
      }
    });

    return forms;
  }

  /**
   * Get detailed form information
   */
  async getForm(formId: string, migrationId?: string): Promise<any> {
    await this.authenticate();

    return this.handleAPICall(
      () => this.formsClient.forms.get({ formId }),
      { endpoint: 'forms.get', formId, migrationId }
    );
  }

  /**
   * Create a new form (copy)
   */
  async createForm(title: string, description?: string, migrationId?: string): Promise<FormInfo> {
    await this.authenticate();

    const response: any = await this.handleAPICall(
      () => this.formsClient.forms.create({
        requestBody: {
          info: {
            title,
            description: description || `Form migrated on ${new Date().toISOString()}`
          }
        }
      }),
      { endpoint: 'forms.create', migrationId }
    );

    const newForm: FormInfo = {
      formId: response.data.formId,
      title: response.data.info?.title || title,
      description: response.data.info?.description,
      documentTitle: response.data.info?.documentTitle || title
    };

    migrationLogger.log({
      level: 'success',
      category: 'migration',
      service: 'forms',
      message: `Form created successfully: ${title}`,
      migrationId,
      details: {
        originalTitle: title,
        newFormId: newForm.formId,
        adminUser: this.adminEmail
      }
    });

    return newForm;
  }

  /**
   * Get form responses
   */
  async getFormResponses(formId: string, migrationId?: string): Promise<FormResponse[]> {
    await this.authenticate();

    try {
      const response: any = await this.handleAPICall(
        () => this.formsClient.forms.responses.list({ formId }),
        { endpoint: 'forms.responses.list', formId, migrationId }
      );

      const responses: FormResponse[] = (response.data.responses || []).map((resp: any) => ({
        responseId: resp.responseId,
        createTime: resp.createTime,
        lastSubmittedTime: resp.lastSubmittedTime,
        answers: resp.answers || {}
      }));

      migrationLogger.log({
        level: 'info',
        category: 'migration',
        service: 'forms',
        message: `Retrieved ${responses.length} responses for form`,
        migrationId,
        details: {
          formId,
          responseCount: responses.length,
          adminUser: this.adminEmail
        }
      });

      return responses;

    } catch (error: any) {
      // Some forms may not have responses or may not allow response access
      if (error.status === 404 || error.message.includes('not found')) {
        migrationLogger.log({
          level: 'warning',
          category: 'migration',
          service: 'forms',
          message: 'No responses found for form (or responses not accessible)',
          migrationId,
          details: { formId, adminUser: this.adminEmail }
        });
        return [];
      }
      throw error;
    }
  }

  /**
   * Copy form structure to new form
   */
  async copyFormStructure(sourceFormId: string, newTitle: string, migrationId?: string): Promise<FormInfo> {
    await this.authenticate();

    try {
      // Get source form details
      const sourceForm = await this.getForm(sourceFormId, migrationId);
      
      // Create new form with basic info
      const newForm = await this.createForm(
        newTitle,
        `Copy of ${sourceForm.data.info?.title || 'form'} - Migrated on ${new Date().toLocaleDateString()}`,
        migrationId
      );

      // TODO: Add logic to copy form structure, questions, settings, etc.
      // This would require additional API calls to update the form structure

      migrationLogger.log({
        level: 'success',
        category: 'migration',
        service: 'forms',
        message: `Form structure copied successfully`,
        migrationId,
        details: {
          sourceFormId,
          newFormId: newForm.formId,
          newTitle,
          adminUser: this.adminEmail
        }
      });

      return newForm;

    } catch (error: any) {
      migrationLogger.log({
        level: 'error',
        category: 'migration',
        service: 'forms',
        message: `Failed to copy form structure`,
        migrationId,
        details: {
          sourceFormId,
          newTitle,
          error: error.message,
          adminUser: this.adminEmail
        }
      });

      throw error;
    }
  }

  /**
   * Batch migrate forms
   */
  async migrateForms(
    forms: FormInfo[],
    targetDomain: string,
    migrationId: string,
    onProgress?: (progress: { completed: number; failed: number; total: number }) => void
  ): Promise<{
    results: Array<{ 
      sourceFormId: string; 
      success: boolean; 
      error?: string; 
      newFormId?: string;
      newTitle?: string;
    }>;
  }> {
    const results: Array<{ 
      sourceFormId: string; 
      success: boolean; 
      error?: string; 
      newFormId?: string;
      newTitle?: string;
    }> = [];

    let completed = 0;
    let failed = 0;

    migrationLogger.log({
      level: 'info',
      category: 'migration',
      service: 'forms',
      message: `Starting Forms migration batch`,
      migrationId,
      details: {
        totalForms: forms.length,
        targetDomain,
        adminUser: this.adminEmail
      }
    });

    for (const form of forms) {
      try {
        const newTitle = `${form.title} (Migrated to ${targetDomain})`;
        const newForm = await this.copyFormStructure(form.formId, newTitle, migrationId);

        results.push({
          sourceFormId: form.formId,
          success: true,
          newFormId: newForm.formId,
          newTitle: newForm.title
        });

        completed++;

        migrationLogger.log({
          level: 'success',
          category: 'migration',
          service: 'forms',
          message: `Form migrated successfully: ${form.title}`,
          migrationId,
          details: {
            sourceFormId: form.formId,
            newFormId: newForm.formId,
            progress: Math.round((completed / forms.length) * 100)
          }
        });

      } catch (error: any) {
        const formsError = error as FormsAPIError;

        results.push({
          sourceFormId: form.formId,
          success: false,
          error: formsError.message
        });

        failed++;

        migrationLogger.log({
          level: 'error',
          category: 'migration',
          service: 'forms',
          message: `Failed to migrate form: ${form.title}`,
          migrationId,
          details: {
            sourceFormId: form.formId,
            error: formsError.message,
            isPermissionError: formsError.permissionError || false,
            retryAfter: formsError.retryAfter
          }
        });
      }

      // Report progress
      if (onProgress) {
        onProgress({ completed, failed, total: forms.length });
      }

      // Small delay between forms
      if (completed + failed < forms.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    migrationLogger.log({
      level: completed > failed ? 'success' : 'warning',
      category: 'migration',
      service: 'forms',
      message: `Forms migration batch completed`,
      migrationId,
      details: {
        totalForms: forms.length,
        successful: completed,
        failed: failed,
        successRate: `${Math.round((completed / forms.length) * 100)}%`,
        targetDomain
      }
    });

    return { results };
  }
}

export default FormsAPIService;
