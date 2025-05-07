import fs from 'fs';
import path from 'path';
import { format as formatDate } from 'date-fns';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const apiLogFile = path.join(logsDir, 'api-logs.txt');

/**
 * Redacts sensitive information from an object or string
 * @param data Data to redact
 * @returns Redacted data
 */
export function redactSensitiveInfo(data: any): any {
  if (typeof data === 'string') {
    // Redact API keys
    return data
      .replace(/(?<=Bearer\s)[a-zA-Z0-9-_.]{20,}/g, '[REDACTED]')
      .replace(/(?<=api[kK]ey=)[a-zA-Z0-9-_.]{20,}/g, '[REDACTED]')
      .replace(/(?<=api_key=)[a-zA-Z0-9-_.]{20,}/g, '[REDACTED]')
      .replace(/(?<=apiKey=)[a-zA-Z0-9-_.]{20,}/g, '[REDACTED]')
      .replace(/(?<=Authorization:\s*Bearer\s+)[a-zA-Z0-9-_.]{20,}/g, '[REDACTED]')
      .replace(/"api_key":\s*"[^"]+"/g, '"api_key":"[REDACTED]"')
      .replace(/"apiKey":\s*"[^"]+"/g, '"apiKey":"[REDACTED]"');
  }

  if (typeof data === 'object' && data !== null) {
    const redacted = { ...data };
    
    // Sensitive keys that should be redacted
    const sensitiveKeys = [
      'api_key', 'apiKey', 'key', 'secret', 'password', 'token', 
      'access_token', 'refresh_token', 'Authorization', 'authorization'
    ];
    
    for (const key in redacted) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = redactSensitiveInfo(redacted[key]);
      } else if (typeof redacted[key] === 'string') {
        redacted[key] = redactSensitiveInfo(redacted[key]);
      }
    }
    
    return redacted;
  }
  
  return data;
}

/**
 * Logs API requests and responses
 */
export const apiLogger = {
  /**
   * Log an API request
   * @param source API source (e.g., "Google Books", "OpenAI")
   * @param requestInfo Request information
   */
  logRequest: (source: string, requestInfo: any) => {
    const timestamp = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const redactedInfo = redactSensitiveInfo(requestInfo);
    
    const logEntry = `\n[${timestamp}] REQUEST TO ${source}\n${JSON.stringify(redactedInfo, null, 2)}\n`;
    
    // Append to log file
    fs.appendFileSync(apiLogFile, logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[API] ${source} Request:`, redactedInfo);
    }
  },
  
  /**
   * Log an API response
   * @param source API source (e.g., "Google Books", "OpenAI")
   * @param responseData Response data
   */
  logResponse: (source: string, responseData: any) => {
    const timestamp = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    // Truncate very long responses to prevent excessively large log files
    let redactedData = redactSensitiveInfo(responseData);
    let truncated = false;
    
    // Convert to string to measure length
    const responseStr = JSON.stringify(redactedData, null, 2);
    if (responseStr.length > 10000) {
      truncated = true;
      redactedData = {
        _truncated: true,
        _originalSize: responseStr.length,
        _note: 'Response too large, showing partial data',
        ...JSON.parse(responseStr.substring(0, 9500)) // Keep beginning of the response
      };
    }
    
    const logEntry = `\n[${timestamp}] RESPONSE FROM ${source}${truncated ? ' (TRUNCATED)' : ''}\n${JSON.stringify(redactedData, null, 2)}\n`;
    
    // Append to log file
    fs.appendFileSync(apiLogFile, logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[API] ${source} Response${truncated ? ' (truncated)' : ''}:`, redactedData);
    }
  },
  
  /**
   * Log an API error
   * @param source API source (e.g., "Google Books", "OpenAI")
   * @param error Error object or message
   */
  logError: (source: string, error: any) => {
    const timestamp = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const redactedError = redactSensitiveInfo(error);
    
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = `${error.name}: ${error.message}\n${error.stack || ''}`;
    } else if (typeof error === 'object') {
      errorMessage = JSON.stringify(redactedError, null, 2);
    } else {
      errorMessage = String(redactedError);
    }
    
    const logEntry = `\n[${timestamp}] ERROR FROM ${source}\n${errorMessage}\n`;
    
    // Append to log file
    fs.appendFileSync(apiLogFile, logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`\n[API] ${source} Error:`, redactedError);
    }
  }
};