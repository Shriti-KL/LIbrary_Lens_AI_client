import React from 'react';

type BookCoverPlaceholderProps = {
  title: string;
  author: string;
  className?: string;
};

// Generate a deterministic pastel color based on title
function generateColorFromTitle(title: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Pastel color palette (values chosen to create soft, pleasant colors)
  const h = Math.abs(hash) % 360; // 0-359 hue
  const s = 65 + (Math.abs(hash) % 20); // 65-85% saturation
  const l = 75 + (Math.abs(hash) % 10); // 75-85% lightness
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function getContrastTextColor(backgroundColor: string): string {
  // Extract hue, saturation, lightness values from HSL color
  const hslMatch = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!hslMatch) return 'rgba(0, 0, 0, 0.85)'; // Default to dark text
  
  const h = parseInt(hslMatch[1]);
  const s = parseInt(hslMatch[2]);
  const l = parseInt(hslMatch[3]);
  
  // For most pastel colors, a dark text works well
  // But adjust based on lightness
  return l > 70 ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';
}

export default function BookCoverPlaceholder({ title, author, className = '' }: BookCoverPlaceholderProps) {
  const backgroundColor = generateColorFromTitle(title || 'Book Title');
  const textColor = getContrastTextColor(backgroundColor);
  const displayTitle = title || 'Untitled';
  const displayAuthor = author || 'Unknown Author';
  
  // Format the title and author for display
  const formattedTitle = displayTitle.length > 30 
    ? displayTitle.substring(0, 28) + '...' 
    : displayTitle;
    
  const formattedAuthor = displayAuthor.length > 30 
    ? displayAuthor.substring(0, 28) + '...' 
    : displayAuthor;
  
  return (
    <div 
      className={`w-full h-full rounded-lg shadow-md border border-neutral-200 flex flex-col items-center justify-center ${className}`}
      style={{ 
        background: backgroundColor,
        color: textColor,
        fontFamily: '"Georgia", serif',
      }}
    >
      <div className="text-center p-6 flex flex-col items-center justify-center h-full">
        <div className="mb-1 opacity-70 text-sm font-light">
          {/* Book icon */}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-12 w-12 mx-auto mb-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
            />
          </svg>
        </div>
        
        <div className="uppercase tracking-wide font-bold mb-1 text-lg text-center">
          {formattedTitle}
        </div>
        
        <div className="text-sm font-medium opacity-80 text-center">
          by {formattedAuthor}
        </div>
      </div>
    </div>
  );
}