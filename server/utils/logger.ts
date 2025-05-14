/**
 * API Logger utility
 * 
 * Provides consistent logging for all API interactions
 */

export const apiLogger = {
  logRequest: (service: string, params: any) => {
    console.log(`[API] Request to ${service}:`, JSON.stringify(params));
  },
  
  logResponse: (service: string, data: any) => {
    console.log(`[API] ${service} response:`, JSON.stringify(data));
  },
  
  logError: (service: string, error: any) => {
    console.error(`[API] Error in ${service}:`, JSON.stringify(error));
  }
};