/**
 * Utilities for detecting hallucinations in AI-generated content
 */

/**
 * Check for potential hallucinations using simple heuristics
 * Ported from Python implementation in libraryLensDeepSeek.py
 * 
 * @param text The text to check for hallucination signs
 * @returns True if hallucination indicators are found, false otherwise
 */
export function detectHallucination(text: string): boolean {
  if (!text) return false;
  
  // Current year for reference
  const currentYear = new Date().getFullYear();
  
  // Check for recent publication dates (future dates)
  const yearRegex = /\b(20[2-9][0-9])\b/g;
  const publicationYears: number[] = [];
  let match;
  while ((match = yearRegex.exec(text)) !== null) {
    publicationYears.push(parseInt(match[1], 10));
  }
  
  // Check for vague language patterns
  const vaguePhrases = [
    "generally considered", 
    "many readers believe",
    "typically described as", 
    "is known to",
    "is said to",
    "is believed to",
    "it appears that",
    "seems to be",
    "may have been",
    "could possibly be"
  ];
  
  // Check if any mentioned year is in the future
  const hasFutureYear = publicationYears.some(year => year > currentYear);
  
  // Check for vague language
  const hasVagueLanguage = vaguePhrases.some(phrase => 
    text.toLowerCase().includes(phrase.toLowerCase())
  );
  
  // Return true if any hallucination indicators are found
  return hasFutureYear || hasVagueLanguage;
}

/**
 * Get a list of potential hallucination indicators in a text
 * Useful for detailed reporting
 * 
 * @param text The text to analyze
 * @returns An array of hallucination indicators found
 */
export function getHallucinationIndicators(text: string): string[] {
  if (!text) return [];
  
  const indicators: string[] = [];
  const currentYear = new Date().getFullYear();
  
  // Check for future years
  const yearRegex = /\b(20[2-9][0-9])\b/g;
  const yearsMatch = [...text.matchAll(yearRegex)];
  const futureYears = yearsMatch
    .map(match => parseInt(match[1], 10))
    .filter(year => year > currentYear);
  
  if (futureYears.length > 0) {
    indicators.push(`Future publication years mentioned: ${futureYears.join(', ')}`);
  }
  
  // Check for vague language
  const vaguePhrases = [
    "generally considered", 
    "many readers believe",
    "typically described as", 
    "is known to",
    "is said to",
    "is believed to",
    "it appears that",
    "seems to be",
    "may have been",
    "could possibly be"
  ];
  
  for (const phrase of vaguePhrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      indicators.push(`Vague language detected: "${phrase}"`);
    }
  }
  
  return indicators;
}