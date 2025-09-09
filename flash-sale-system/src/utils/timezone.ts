import logger from './logger';

export class TimezoneUtils {
  /**
   * Convert UTC time to user's timezone
   * @param utcTimeString UTC time in 'YYYY-MM-DD HH:MM:SS' format
   * @param userTimezone User's timezone (e.g., 'America/New_York', 'Asia/Kolkata')
   * @returns Time in user's timezone as ISO string
   */
  static convertUTCToUserTimezone(utcTimeString: string, userTimezone: string): string {
    try {
      // Parse UTC time and explicitly set it as UTC
      const utcDate = new Date(utcTimeString + 'Z');
      
      // Convert to user's timezone
      const userTime = new Date(utcDate.toLocaleString('en-US', { 
        timeZone: userTimezone 
      }));
      
      return userTime.toISOString();
    } catch (error) {
      logger.error('Error converting UTC to user timezone', { 
        error, 
        utcTimeString, 
        userTimezone 
      });
      // Fallback to original UTC time
      return utcTimeString + 'Z';
    }
  }

  /**
   * Convert user's local time to UTC
   * @param localTimeString Time in user's timezone
   * @param userTimezone User's timezone
   * @returns UTC time in 'YYYY-MM-DD HH:MM:SS' format
   */
  static convertUserTimezoneToUTC(localTimeString: string, userTimezone: string): string {
    try {
      // Create date object assuming it's in user's timezone
      const localDate = new Date(localTimeString);
      
      // Get the timezone offset for the user's timezone at this date
      const utcTime = new Date(localDate.toLocaleString('en-US', { 
        timeZone: 'UTC' 
      }));
      
      // Format as SQLite datetime format
      return utcTime.toISOString().slice(0, 19).replace('T', ' ');
    } catch (error) {
      logger.error('Error converting user timezone to UTC', { 
        error, 
        localTimeString, 
        userTimezone 
      });
      // Fallback - assume it's already UTC format
      return localTimeString;
    }
  }

  /**
   * Format UTC time for display in user's timezone
   * @param utcTimeString UTC time in 'YYYY-MM-DD HH:MM:SS' format
   * @param userTimezone User's timezone
   * @param options Intl.DateTimeFormatOptions for formatting
   * @returns Formatted time string in user's timezone
   */
  static formatTimeForUser(
    utcTimeString: string, 
    userTimezone: string, 
    options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }
  ): string {
    try {
      const utcDate = new Date(utcTimeString + 'Z');
      return utcDate.toLocaleString('en-US', { 
        ...options,
        timeZone: userTimezone 
      });
    } catch (error) {
      logger.error('Error formatting time for user', { 
        error, 
        utcTimeString, 
        userTimezone 
      });
      return utcTimeString;
    }
  }

  /**
   * Get current time in user's timezone
   * @param userTimezone User's timezone
   * @returns Current time as ISO string in user's timezone
   */
  static getCurrentTimeInUserTimezone(userTimezone: string): string {
    try {
      const now = new Date();
      return now.toLocaleString('en-US', { 
        timeZone: userTimezone 
      });
    } catch (error) {
      logger.error('Error getting current time in user timezone', { 
        error, 
        userTimezone 
      });
      return new Date().toISOString();
    }
  }

  /**
   * Validate timezone string
   * @param timezone Timezone to validate
   * @returns true if valid timezone
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      // Try to create a date with the timezone
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get timezone offset in minutes from UTC
   * @param timezone User's timezone
   * @param date Optional date to check offset for (defaults to now)
   * @returns Offset in minutes (positive = ahead of UTC, negative = behind UTC)
   */
  static getTimezoneOffset(timezone: string, date: Date = new Date()): number {
    try {
      // Get UTC time
      const utcTime = date.getTime();
      
      // Get local time in user's timezone
      const localTime = new Date(date.toLocaleString('en-US', { 
        timeZone: timezone 
      })).getTime();
      
      // Calculate offset in minutes
      return (localTime - utcTime) / (1000 * 60);
    } catch (error) {
      logger.error('Error getting timezone offset', { 
        error, 
        timezone 
      });
      return 0; // Default to UTC
    }
  }

  /**
   * Detect common timezone from offset
   * This is a helper for frontend timezone detection
   * @param offsetMinutes Timezone offset in minutes
   * @returns Common timezone name or 'UTC'
   */
  static detectTimezoneFromOffset(offsetMinutes: number): string {
    // Common timezone mappings based on offset
    const timezoneMap = new Map<number, string>([
      [0, 'UTC'],
      [60, 'Europe/London'],      // GMT+1
      [120, 'Europe/Berlin'],     // GMT+2
      [330, 'Asia/Kolkata'],      // GMT+5:30 (IST)
      [480, 'Asia/Shanghai'],     // GMT+8
      [540, 'Asia/Tokyo'],        // GMT+9
      [-300, 'America/New_York'], // GMT-5 (EST)
      [-360, 'America/Chicago'],  // GMT-6 (CST)
      [-420, 'America/Denver'],   // GMT-7 (MST)
      [-480, 'America/Los_Angeles'] // GMT-8 (PST)
    ]);

    return timezoneMap.get(offsetMinutes) || 'UTC';
  }
}

export default TimezoneUtils;
