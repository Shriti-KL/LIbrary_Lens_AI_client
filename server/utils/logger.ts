/**
 * Logger utility for standardized logging across services
 */

/**
 * API Logger - Handles logging for API calls and errors
 * Provides consistent format for request/response logging
 */
export const apiLogger = {
  /**
   * Log a successful API request/response
   * 
   * @param service Service name (e.g., "OpenAI", "GoogleBooks")
   * @param data Object containing details of the request/response
   */
  logSuccess: (service: string, data: any) => {
    console.log(`[API] ${service} success: ${JSON.stringify(data)}`);
  },

  /**
   * Log an API error
   * 
   * @param service Service name (e.g., "OpenAI", "GoogleBooks")
   * @param error Object containing error details
   */
  logError: (service: string, error: any) => {
    console.error(`[API] Error in ${service}: ${JSON.stringify(error)}`);
  },

  /**
   * Log a debug message
   * 
   * @param service Service name
   * @param message Debug message or data
   */
  logDebug: (service: string, message: any) => {
    if (typeof message === 'object') {
      console.log(`[DEBUG] ${service}: ${JSON.stringify(message)}`);
    } else {
      console.log(`[DEBUG] ${service}: ${message}`);
    }
  }
};

/**
 * Verification Logger - Specifically for book verification processes
 */
export const verificationLogger = {
  /**
   * Log a step in the verification process
   * 
   * @param id Verification ID
   * @param step Step number or name
   * @param message Message to log
   */
  logStep: (id: string, step: string | number, message: string) => {
    console.log(`[verify_${id}] Step ${step}: ${message}`);
  },

  /**
   * Log verification results
   * 
   * @param id Verification ID
   * @param status Status (success, error, etc)
   * @param data Verification data
   */
  logResult: (id: string, status: string, data: any) => {
    console.log(`[verify_${id}] Verification ${status}: ${JSON.stringify(data)}`);
  },

  /**
   * Log a verification error
   * 
   * @param id Verification ID
   * @param error Error message
   * @param data Additional error data
   */
  logError: (id: string, error: string, data?: any) => {
    if (data) {
      console.error(`[verify_${id}] ERROR: ${error} - ${JSON.stringify(data)}`);
    } else {
      console.error(`[verify_${id}] ERROR: ${error}`);
    }
  }
};