/**
 * Date Utilities
 * 
 * Common date manipulation and validation utilities used throughout
 * the application for time-off calculations and business logic.
 * 
 * Why this exists:
 * - Centralizes date manipulation logic
 * - Provides consistent date handling
 * - Enables business rule validation
 * - Prevents date-related bugs
 */

export class DateUtils {
  /**
   * Calculate the number of days between two dates (excluding weekends)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of business days
   */
  static calculateBusinessDays(startDate: Date, endDate: Date): number {
    let businessDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * Calculate the number of calendar days between two dates
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of calendar days (including partial days)
   */
  static calculateCalendarDays(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end dates
  }

  /**
   * Calculate fractional days between two dates
   * @param startDate - Start date
   * @param endDate - End date
   * @param increment - Fractional day increment (e.g., 0.5 for half days)
   * @returns Number of fractional days
   */
  static calculateFractionalDays(startDate: Date, endDate: Date, increment: number = 0.5): number {
    const calendarDays = this.calculateCalendarDays(startDate, endDate);
    return Math.round(calendarDays / increment) * increment;
  }

  /**
   * Check if a date is a weekend
   * @param date - Date to check
   * @returns True if weekend
   */
  static isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  }

  /**
   * Check if a date is a holiday (simplified - in production would use holiday calendar)
   * @param date - Date to check
   * @param holidays - Array of holiday dates
   * @returns True if holiday
   */
  static isHoliday(date: Date, holidays: Date[] = []): boolean {
    return holidays.some(holiday => 
      holiday.getDate() === date.getDate() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getFullYear() === date.getFullYear()
    );
  }

  /**
   * Check if a date is a business day (not weekend or holiday)
   * @param date - Date to check
   * @param holidays - Array of holiday dates
   * @returns True if business day
   */
  static isBusinessDay(date: Date, holidays: Date[] = []): boolean {
    return !this.isWeekend(date) && !this.isHoliday(date, holidays);
  }

  /**
   * Add business days to a date
   * @param date - Starting date
   * @param days - Number of business days to add
   * @param holidays - Array of holiday dates
   * @returns New date with business days added
   */
  static addBusinessDays(date: Date, days: number, holidays: Date[] = []): Date {
    const result = new Date(date);
    let businessDaysAdded = 0;

    while (businessDaysAdded < days) {
      result.setDate(result.getDate() + 1);
      if (this.isBusinessDay(result, holidays)) {
        businessDaysAdded++;
      }
    }

    return result;
  }

  /**
   * Get the start of day (midnight) for a date
   * @param date - Date to process
   * @returns Date at start of day
   */
  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get the end of day (23:59:59.999) for a date
   * @param date - Date to process
   * @returns Date at end of day
   */
  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Check if a date range is valid (start before end)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns True if valid
   */
  static isValidDateRange(startDate: Date, endDate: Date): boolean {
    return startDate <= endDate;
  }

  /**
   * Check if a date is in the past
   * @param date - Date to check
   * @returns True if past
   */
  static isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if a date is in the future
   * @param date - Date to check
   * @returns True if future
   */
  static isFuture(date: Date): boolean {
    return date > new Date();
  }

  /**
   * Check if a date is today
   * @param date - Date to check
   * @returns True if today
   */
  static isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  /**
   * Format date to ISO string (YYYY-MM-DD)
   * @param date - Date to format
   * @returns Formatted date string
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse date from ISO string (YYYY-MM-DD)
   * @param dateString - Date string to parse
   * @returns Parsed date
   */
  static parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    return date;
  }

  /**
   * Get notice period in days between now and a future date
   * @param futureDate - Future date
   * @returns Number of days notice
   */
  static getNoticePeriodDays(futureDate: Date): number {
    const now = new Date();
    return this.calculateCalendarDays(now, futureDate);
  }

  /**
   * Check if sufficient notice is given
   * @param startDate - Start date of time-off
   * @param minNoticeDays - Minimum notice required
   * @returns True if sufficient notice
   */
  static hasSufficientNotice(startDate: Date, minNoticeDays: number): boolean {
    const noticePeriod = this.getNoticePeriodDays(startDate);
    return noticePeriod >= minNoticeDays;
  }

  /**
   * Get all dates in a range (inclusive)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of dates
   */
  static getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  /**
   * Check if two date ranges overlap
   * @param start1 - First range start
   * @param end1 - First range end
   * @param start2 - Second range start
   * @param end2 - Second range end
   * @returns True if ranges overlap
   */
  static dateRangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  /**
   * Get the number of years between two dates
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of years (decimal)
   */
  static getYearsBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return diffTime / (1000 * 60 * 60 * 24 * 365.25);
  }

  /**
   * Get age in years from birth date
   * @param birthDate - Birth date
   * @param currentDate - Current date (defaults to now)
   * @returns Age in years
   */
  static getAge(birthDate: Date, currentDate: Date = new Date()): number {
    return Math.floor(this.getYearsBetween(birthDate, currentDate));
  }
}
