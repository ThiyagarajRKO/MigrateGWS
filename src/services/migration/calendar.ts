/**
 * Google Calendar Migration Service
 * Handles migration of calendars, events, and settings
 */

import { calendar_v3, google } from 'googleapis';
import { BaseMigrationService, UserMapping, MigrationResult, MigrationProgress, CalendarMigrationOptions } from './types';

export class CalendarMigrationService extends BaseMigrationService {
  private sourceCalendar: calendar_v3.Calendar;
  private targetCalendar: calendar_v3.Calendar;
  private options: CalendarMigrationOptions;

  constructor(credentials: any, config: any, options: CalendarMigrationOptions) {
    super('calendar', credentials, config);
    this.options = options;
    
    this.sourceCalendar = google.calendar({ version: 'v3', auth: credentials.sourceAuth });
    this.targetCalendar = google.calendar({ version: 'v3', auth: credentials.targetAuth });
  }

  async validatePermissions(userMapping: UserMapping): Promise<boolean> {
    try {
      // Check source permissions
      await this.sourceCalendar.calendarList.list();
      
      // Check target permissions
      await this.targetCalendar.calendarList.list();
      
      return true;
    } catch (error) {
      console.error('Calendar permission validation failed:', error);
      return false;
    }
  }

  async estimateItems(userMapping: UserMapping): Promise<number> {
    try {
      let totalEvents = 0;
      
      // Get all calendars
      const calendars = await this.sourceCalendar.calendarList.list();
      
      for (const calendar of calendars.data.items || []) {
        if (!calendar.id) continue;
        
        const events = await this.sourceCalendar.events.list({
          calendarId: calendar.id,
          maxResults: 2500,
          singleEvents: true,
          timeMin: this.options.dateRange?.startDate,
          timeMax: this.options.dateRange?.endDate,
        });
        
        totalEvents += events.data.items?.length || 0;
      }
      
      return totalEvents;
    } catch (error) {
      console.error('Calendar estimation failed:', error);
      return 0;
    }
  }

  async migrateUser(
    userMapping: UserMapping,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    const startTime = new Date().toISOString();
    let progress = this.createProgress(userMapping, 'in-progress', 0, { startTime });
    
    try {
      // Step 1: Get all calendars
      onProgress?.(progress);
      const calendars = await this.getAllCalendars();
      
      let totalEvents = 0;
      const calendarEventCounts = new Map<string, number>();
      
      // Count events in all calendars for progress tracking
      for (const calendar of calendars) {
        if (!calendar.id) continue;
        
        const events = await this.sourceCalendar.events.list({
          calendarId: calendar.id,
          maxResults: 2500,
          singleEvents: true,
          timeMin: this.options.dateRange?.startDate,
          timeMax: this.options.dateRange?.endDate,
        });
        
        const eventCount = events.data.items?.length || 0;
        calendarEventCounts.set(calendar.id, eventCount);
        totalEvents += eventCount;
      }
      
      progress.itemsTotal = totalEvents;
      onProgress?.(progress);
      
      // Step 2: Migrate calendars and their events
      let processed = 0;
      const errors: string[] = [];
      const calendarMapping = new Map<string, string>();
      
      for (const calendar of calendars) {
        if (!calendar.id) continue;
        
        try {
          // Create calendar in target account
          const newCalendarId = await this.migrateCalendar(calendar, userMapping);
          if (newCalendarId) {
            calendarMapping.set(calendar.id, newCalendarId);
            
            // Migrate events for this calendar
            const eventCount = calendarEventCounts.get(calendar.id) || 0;
            if (eventCount > 0 && this.options.includeEvents) {
              const eventResults = await this.migrateCalendarEvents(
                calendar.id,
                newCalendarId,
                userMapping,
                (eventsProcessed) => {
                  const currentProgress = processed + eventsProcessed;
                  progress = this.createProgress(userMapping, 'in-progress',
                    Math.round((currentProgress / totalEvents) * 100), {
                      ...progress,
                      itemsProcessed: currentProgress,
                      itemsFailed: errors.length,
                      details: {
                        currentItem: `Calendar: ${calendar.summary}, Event ${eventsProcessed}/${eventCount}`,
                      }
                    });
                  onProgress?.(progress);
                }
              );
              
              processed += eventCount;
              errors.push(...eventResults.errors);
            }
          }
        } catch (error) {
          const eventCount = calendarEventCounts.get(calendar.id) || 0;
          errors.push(`Failed to migrate calendar ${calendar.summary}: ${error}`);
          processed += eventCount; // Skip events for failed calendar
        }
        
        await this.delay(this.config.options.throttleMs);
      }
      
      const endTime = new Date().toISOString();
      progress = this.createProgress(userMapping, 'completed', 100, {
        ...progress,
        endTime,
        itemsProcessed: processed,
        itemsFailed: errors.length,
      });
      onProgress?.(progress);
      
      return {
        success: errors.length === 0,
        progress,
        summary: {
          totalItems: totalEvents,
          successfulItems: processed - errors.length,
          failedItems: errors.length,
          skippedItems: 0,
        },
        errors,
        warnings: [],
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      progress = this.createProgress(userMapping, 'failed', 0, {
        ...progress,
        error: errorMsg,
        endTime: new Date().toISOString(),
      });
      onProgress?.(progress);
      
      return {
        success: false,
        progress,
        summary: {
          totalItems: 0,
          successfulItems: 0,
          failedItems: 1,
          skippedItems: 0,
        },
        errors: [errorMsg],
        warnings: [],
      };
    }
  }

  async rollback(userMapping: UserMapping): Promise<boolean> {
    try {
      console.warn('Calendar rollback not implemented - manual cleanup required');
      return false;
    } catch (error) {
      console.error('Calendar rollback failed:', error);
      return false;
    }
  }

  private async getAllCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    const calendars: calendar_v3.Schema$CalendarListEntry[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await this.sourceCalendar.calendarList.list({
        pageToken,
        maxResults: 250,
      });
      
      if (response.data.items) {
        calendars.push(...response.data.items);
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    return calendars;
  }

  private async migrateCalendar(
    calendar: calendar_v3.Schema$CalendarListEntry,
    userMapping: UserMapping
  ): Promise<string | null> {
    try {
      // Skip primary calendar (it already exists)
      if (calendar.primary) {
        return 'primary';
      }
      
      // Create new calendar
      const response = await this.targetCalendar.calendars.insert({
        requestBody: {
          summary: calendar.summary,
          description: calendar.description,
          timeZone: calendar.timeZone,
        },
      });
      
      return response.data.id || null;
    } catch (error) {
      console.error(`Failed to create calendar ${calendar.summary}:`, error);
      throw error;
    }
  }

  private async migrateCalendarEvents(
    sourceCalendarId: string,
    targetCalendarId: string,
    userMapping: UserMapping,
    onEventProgress?: (processed: number) => void
  ): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    let pageToken: string | undefined;
    let processed = 0;
    
    do {
      const response = await this.sourceCalendar.events.list({
        calendarId: sourceCalendarId,
        pageToken,
        maxResults: 250,
        singleEvents: true,
        timeMin: this.options.dateRange?.startDate,
        timeMax: this.options.dateRange?.endDate,
      });
      
      for (const event of response.data.items || []) {
        try {
          await this.migrateEvent(event, targetCalendarId, userMapping);
          processed++;
          onEventProgress?.(processed);
        } catch (error) {
          errors.push(`Failed to migrate event ${event.summary}: ${error}`);
        }
        
        await this.delay(this.config.options.throttleMs / 10); // Faster for individual events
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    return { errors };
  }

  private async migrateEvent(
    event: calendar_v3.Schema$Event,
    targetCalendarId: string,
    userMapping: UserMapping
  ): Promise<void> {
    if (!event.id) return;
    
    // Skip recurring event instances (they'll be recreated from the series)
    if (event.recurringEventId && !this.options.includeRecurring) {
      return;
    }
    
    // Map attendee email addresses
    const attendees = event.attendees?.map(attendee => ({
      ...attendee,
      email: this.mapEmailAddress(attendee.email, userMapping),
    }));
    
    // Create event in target calendar
    await this.targetCalendar.events.insert({
      calendarId: targetCalendarId,
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: this.options.preserveAttendees ? attendees : undefined,
        recurrence: event.recurrence,
        reminders: event.reminders,
        visibility: event.visibility,
        transparency: event.transparency,
      },
    });
  }

  private mapEmailAddress(email: string | null | undefined, userMapping: UserMapping): string | undefined {
    if (!email) return undefined;
    
    // Map emails from source domain to target domain
    if (email.includes(userMapping.sourceDomain)) {
      return email.replace(userMapping.sourceDomain, userMapping.targetDomain);
    }
    
    return email;
  }

  // Utility methods for different mapping scenarios
  async migrateOneToOne(sourceUser: string, targetUser: string): Promise<MigrationResult> {
    const userMapping: UserMapping = {
      sourceEmail: sourceUser,
      targetEmail: targetUser,
      sourceDomain: sourceUser.split('@')[1],
      targetDomain: targetUser.split('@')[1],
      status: 'pending',
    };
    
    return this.migrateUser(userMapping);
  }

  async migrateManyToOne(sourceUsers: string[], targetUser: string): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    for (const sourceUser of sourceUsers) {
      const userMapping: UserMapping = {
        sourceEmail: sourceUser,
        targetEmail: targetUser,
        sourceDomain: sourceUser.split('@')[1],
        targetDomain: targetUser.split('@')[1],
        status: 'pending',
      };
      
      const result = await this.migrateUser(userMapping);
      results.push(result);
      
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }

  async migrateOneToMany(sourceUser: string, targetUsers: string[]): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    for (const targetUser of targetUsers) {
      const userMapping: UserMapping = {
        sourceEmail: sourceUser,
        targetEmail: targetUser,
        sourceDomain: sourceUser.split('@')[1],
        targetDomain: targetUser.split('@')[1],
        status: 'pending',
      };
      
      const result = await this.migrateUser(userMapping);
      results.push(result);
      
      await this.delay(this.config.options.throttleMs * 2);
    }
    
    return results;
  }
}
