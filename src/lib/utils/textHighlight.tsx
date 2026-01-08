import React from 'react';

/**
 * Highlights matching text in a string
 * @param text - The text to search in
 * @param query - The search query to highlight
 * @returns React node with highlighted match
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);
  
  return (
    <>
      {before}
      <span className="bg-yellow-200 font-semibold">{match}</span>
      {after}
    </>
  );
}





