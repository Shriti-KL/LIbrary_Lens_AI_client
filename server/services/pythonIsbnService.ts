/**
 * This module provides a bridge to the Python ISBN lookup service
 * It allows JavaScript code to call the Python book service for enhanced ISBN lookups
 */

import { spawn } from "child_process";
import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";

/**
 * Call the Python ISBN lookup service to get book data
 * @param isbn The ISBN to look up
 * @returns A promise that resolves to the book data
 */
export async function lookupBookByIsbn(isbn: string): Promise<Partial<Book>> {
  const lookupId = `python_isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book with ISBN: ${isbn} using Python Book Service`);
  
  return new Promise((resolve, reject) => {
    // Log the request
    apiLogger.logRequest("Python Book Service", {
      operation: "lookupBookByIsbn",
      isbn
    });
    
    // Run the Python script with the ISBN as an argument
    const pythonProcess = spawn("python", ["python_services/book_service.py", isbn]);
    
    let dataString = "";
    let errorString = "";
    
    // Collect data from stdout
    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
    });
    
    // Collect error data from stderr
    pythonProcess.stderr.on("data", (data) => {
      errorString += data.toString();
      console.error(`[${lookupId}] Python error output:`, data.toString());
    });
    
    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`[${lookupId}] Python process exited with code ${code}`);
        console.error(`[${lookupId}] Error output: ${errorString}`);
        
        apiLogger.logError("Python Book Service", {
          error: "Python process error",
          message: errorString,
          exitCode: code,
          isbn,
          lookupId
        });
        
        // If there's an error, but we got some data, try to parse it anyway
        if (dataString) {
          try {
            const bookData = JSON.parse(dataString);
            console.log(`[${lookupId}] Successfully parsed data despite error code`);
            
            apiLogger.logResponse("Python Book Service", {
              operation: "lookupBookByIsbn",
              isbn,
              status: "partial success",
              dataReceived: true,
              errorCode: code
            });
            
            return resolve(bookData);
          } catch (e) {
            // If we can't parse the data, reject with the error
            reject(new Error(`Python process error: ${errorString || "Unknown error"}`));
          }
        } else {
          reject(new Error(`Python process error: ${errorString || "Unknown error"}`));
        }
      } else {
        try {
          // Parse the JSON output from the Python script
          const bookData = JSON.parse(dataString);
          console.log(`[${lookupId}] Successfully processed book data from Python service`);
          
          apiLogger.logResponse("Python Book Service", {
            operation: "lookupBookByIsbn",
            isbn,
            status: "success",
            dataReceived: true
          });
          
          resolve(bookData);
        } catch (error: any) {
          console.error(`[${lookupId}] Error parsing Python output:`, error?.message);
          
          apiLogger.logError("Python Book Service", {
            error: "JSON parse error",
            message: error?.message || "Unknown error",
            isbn,
            lookupId
          });
          
          reject(new Error(`Error parsing Python output: ${error?.message || "Unknown error"}`));
        }
      }
    });
    
    // Handle process errors
    pythonProcess.on("error", (error) => {
      console.error(`[${lookupId}] Python process error:`, error.message);
      
      apiLogger.logError("Python Book Service", {
        error: "Python process spawn error",
        message: error.message,
        isbn,
        lookupId
      });
      
      reject(new Error(`Python process error: ${error.message}`));
    });
  });
}

/**
 * Test if the Python ISBN lookup service is available
 * @returns A promise that resolves to true if the service is available
 */
export async function isPythonIsbnServiceAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const pythonProcess = spawn("python", ["--version"]);
      
      pythonProcess.on("close", (code) => {
        if (code === 0) {
          // Check if the book_service.py file exists
          const checkFileProcess = spawn("ls", ["python_services/book_service.py"]);
          
          checkFileProcess.on("close", (fileCode) => {
            resolve(fileCode === 0);
          });
        } else {
          resolve(false);
        }
      });
      
      pythonProcess.on("error", () => {
        resolve(false);
      });
    } catch (error) {
      resolve(false);
    }
  });
}