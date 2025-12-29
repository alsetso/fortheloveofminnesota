/**
 * Central Time (CST/CDT) timezone utilities
 * Minnesota is in Central Time, so all date operations should use this timezone
 */

/**
 * Get the current date/time in Central Time
 */
export function getNowInCentral(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

/**
 * Get start of today in Central Time
 */
export function getStartOfTodayCentral(): Date {
  const now = getNowInCentral();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Convert a UTC date string to Central Time and get start of day
 */
export function getStartOfDayCentral(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Convert to Central Time
  const centralDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  // Get start of day in Central Time
  const startOfDay = new Date(centralDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  return startOfDay;
}

/**
 * Check if two dates are the same day in Central Time
 */
export function isSameDayCentral(date1: Date | string, date2: Date | string): boolean {
  const day1 = getStartOfDayCentral(date1);
  const day2 = getStartOfDayCentral(date2);
  
  return day1.getTime() === day2.getTime();
}

/**
 * Convert UTC timestamp to Central Time date string (YYYY-MM-DD)
 */
export function getDateStringCentral(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const centralDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  const year = centralDate.getFullYear();
  const month = String(centralDate.getMonth() + 1).padStart(2, '0');
  const day = String(centralDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get ISO string for start of today in Central Time (for database queries)
 * Returns ISO string that represents midnight Central Time in UTC
 */
export function getTodayStartISOStringCentral(): string {
  // Get today's date components in Central Time
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  // Create a date string for midnight Central Time
  const centralMidnightStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
  
  // Calculate the UTC offset for Central Time
  // We'll create a test date and compare UTC vs Central representations
  const testDate = new Date();
  const utcTime = testDate.getTime();
  
  // Get Central Time representation
  const centralFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const centralParts = centralFormatter.formatToParts(testDate);
  const cYear = centralParts.find(p => p.type === 'year')?.value || '';
  const cMonth = centralParts.find(p => p.type === 'month')?.value || '';
  const cDay = centralParts.find(p => p.type === 'day')?.value || '';
  const cHour = centralParts.find(p => p.type === 'hour')?.value || '';
  const cMinute = centralParts.find(p => p.type === 'minute')?.value || '';
  const cSecond = centralParts.find(p => p.type === 'second')?.value || '';
  
  // Create a date object from the Central Time string (treating it as local)
  // Then calculate the difference
  const centralTimeStr = `${cYear}-${cMonth.padStart(2, '0')}-${cDay.padStart(2, '0')}T${cHour.padStart(2, '0')}:${cMinute.padStart(2, '0')}:${cSecond.padStart(2, '0')}`;
  
  // The offset is the difference between UTC and what Central Time would be if treated as UTC
  // We need to find what UTC time corresponds to midnight Central
  // Use a simpler method: create date at midnight Central, then find UTC equivalent
  const centralMidnight = new Date(`${centralMidnightStr}`);
  
  // Get the UTC offset by using the timezone offset
  // Central Time is UTC-6 (CST) or UTC-5 (CDT)
  // We can determine this by checking the current offset
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdOffset;
  
  // Central Time offset: CST = UTC-6 (360 minutes), CDT = UTC-5 (300 minutes)
  // But we're on the server, so we need to calculate the actual offset
  // Use Intl to get the actual offset
  const utcDate = new Date();
  const centralDateStr = utcDate.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const centralDate = new Date(centralDateStr);
  const offsetMs = utcDate.getTime() - centralDate.getTime();
  
  // Now apply this offset to midnight Central to get UTC
  // If it's midnight Central, we add the offset to get UTC
  const utcMidnight = new Date(centralMidnight.getTime() + offsetMs);
  
  return utcMidnight.toISOString();
}

/**
 * Format date for display in Central Time
 */
export function formatDateCentral(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    ...options,
  });
}

