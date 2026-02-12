'use client';

import Link from 'next/link';
import { extractUsernames } from '@/lib/posts/parseUsernames';
import { buildUrlRegex, normalizeUrl } from '@/lib/posts/parseUrls';

interface PostContentProps {
  content: string;
  taggedAccounts?: Array<{
    id: string;
    username: string | null;
  }> | null;
  className?: string;
  backgroundColor?: 'black' | 'red' | 'blue' | null;
  /** When true, @username is always rendered as a link to /username even when not in taggedAccounts (e.g. profile bio). */
  linkUnresolvedMentions?: boolean;
}

/**
 * Component to render post content with clickable @username links
 * Only renders links for accounts that are actually tagged (in taggedAccounts)
 */
export default function PostContent({ content, taggedAccounts = [], className = '', backgroundColor = null, linkUnresolvedMentions = false }: PostContentProps) {
  // Create a map of lowercase usernames to account IDs for quick lookup
  const usernameToIdMap = new Map<string, string>();
  if (taggedAccounts) {
    for (const account of taggedAccounts) {
      if (account.username) {
        usernameToIdMap.set(account.username.toLowerCase(), account.id);
      }
    }
  }

  // Extract all usernames from content
  const usernames = extractUsernames(content);
  
  // Split content into parts (text, @username mentions, and URLs)
  interface ContentPart {
    type: 'text' | 'mention' | 'url';
    content: string;
    accountId?: string;
    url?: string;
  }
  
  const parts: ContentPart[] = [];
  
  // Collect all matches (mentions and URLs) with their positions
  interface Match {
    type: 'mention' | 'url';
    start: number;
    end: number;
    content: string;
    accountId?: string;
    url?: string;
  }
  
  const matches: Match[] = [];
  
  // Find all mentions
  const usernameRegex = /@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;
  let match;
  usernameRegex.lastIndex = 0;
  while ((match = usernameRegex.exec(content)) !== null) {
    const username = match[1].toLowerCase();
    const accountId = usernameToIdMap.get(username);
    
    matches.push({
      type: 'mention',
      start: match.index,
      end: match.index + match[0].length,
      content: match[0],
      accountId,
    });
  }
  
  // Find all URLs (excluding those that are part of mentions)
  const urlRegex = buildUrlRegex();
  urlRegex.lastIndex = 0;
  while ((match = urlRegex.exec(content)) !== null) {
    // Check if this URL is part of a mention (e.g., @username.com)
    const beforeMatch = content.substring(Math.max(0, match.index! - 1), match.index!);
    if (!beforeMatch.endsWith('@')) {
      // match[1] is the captured URL, match[0] includes preceding character
      const urlContent = match[1] || match[0];
      const urlStart = match.index! + (match[0].length - urlContent.length);
      matches.push({
        type: 'url',
        start: urlStart,
        end: urlStart + urlContent.length,
        content: urlContent,
        url: normalizeUrl(urlContent),
      });
    }
  }
  
  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);
  
  // Remove overlapping matches (prefer mentions over URLs if they overlap)
  const filteredMatches: Match[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    let overlaps = false;
    
    // Check if this match overlaps with any previous match
    for (const prev of filteredMatches) {
      if (
        (current.start >= prev.start && current.start < prev.end) ||
        (current.end > prev.start && current.end <= prev.end) ||
        (current.start <= prev.start && current.end >= prev.end)
      ) {
        overlaps = true;
        // If current is a mention and prev is a URL, replace the URL
        if (current.type === 'mention' && prev.type === 'url') {
          const index = filteredMatches.indexOf(prev);
          filteredMatches[index] = current;
        }
        break;
      }
    }
    
    if (!overlaps) {
      filteredMatches.push(current);
    }
  }
  
  // Build parts array
  let lastIndex = 0;
  
  for (const match of filteredMatches) {
    // Add text before the match
    if (match.start > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.start),
      });
    }
    
    // Add the match
    parts.push({
      type: match.type,
      content: match.content,
      accountId: match.accountId,
      url: match.url,
    });
    
    lastIndex = match.end;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }
  
  // Calculate dynamic font size based on content length when background color is present
  const getFontSizeClass = (textLength: number): string => {
    if (!backgroundColor) return '';
    
    // Scale font size based on text length
    // Shorter text = larger font, longer text = smaller font
    if (textLength <= 20) return 'text-4xl'; // Very short: 36px
    if (textLength <= 40) return 'text-3xl'; // Short: 30px
    if (textLength <= 80) return 'text-2xl'; // Medium: 24px
    if (textLength <= 150) return 'text-xl';  // Long: 20px
    return 'text-lg'; // Very long: 18px
  };
  
  const fontSizeClass = backgroundColor ? getFontSizeClass(content.length) : '';
  
  // Build background color classes
  // Note: p-4 (1rem) padding for background colored areas - forces text to wrap
  // Transition classes for smooth state changes
  const backgroundColorClasses = backgroundColor
    ? backgroundColor === 'black'
      ? `bg-black text-white min-h-[333px] max-h-[333px] h-[333px] font-bold text-center block w-full flex items-center justify-center p-4 break-words box-border transition-all ${fontSizeClass}`
      : backgroundColor === 'red'
      ? `bg-red-600 text-white min-h-[333px] max-h-[333px] h-[333px] font-bold text-center block w-full flex items-center justify-center p-4 break-words box-border transition-all ${fontSizeClass}`
      : `bg-blue-600 text-white min-h-[333px] max-h-[333px] h-[333px] font-bold text-center block w-full flex items-center justify-center p-4 break-words box-border transition-all ${fontSizeClass}`
    : 'transition-all';

  const combinedClassName = `${className} ${backgroundColorClasses}`.trim();

  // If no mentions or URLs found, just return the content as-is
  if (parts.length === 1 && parts[0].type === 'text') {
    return <span className={combinedClassName}>{content}</span>;
  }

  return (
    <span className={combinedClassName} style={backgroundColor ? { 
      wordWrap: 'break-word', 
      overflowWrap: 'break-word',
      maxWidth: '100%',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    } : {}}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index} style={backgroundColor ? { wordWrap: 'break-word', overflowWrap: 'break-word', textAlign: 'center', width: '100%' } : {}}>{part.content}</span>;
        }
        
        if (part.type === 'mention') {
          // Render as link if accountId exists or linkUnresolvedMentions (e.g. profile bio)
          const username = part.content.substring(1);
          if (part.accountId || linkUnresolvedMentions) {
            return (
              <Link
                key={index}
                href={`/${encodeURIComponent(username)}`}
                className={backgroundColor ? "text-white hover:text-gray-200 hover:underline font-medium" : "text-blue-600 hover:text-blue-800 hover:underline font-medium"}
                style={backgroundColor ? { textAlign: 'center' } : {}}
              >
                {part.content}
              </Link>
            );
          }
          return <span key={index} style={backgroundColor ? { textAlign: 'center', width: '100%' } : {}}>{part.content}</span>;
        }
        
        if (part.type === 'url' && part.url) {
          return (
            <a
              key={index}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className={backgroundColor ? "text-white hover:text-gray-200 hover:underline font-medium" : "text-blue-600 hover:text-blue-800 hover:underline font-medium"}
              style={backgroundColor ? { textAlign: 'center' } : {}}
            >
              {part.content}
            </a>
          );
        }
        
        // Fallback: render as plain text
        return <span key={index} style={backgroundColor ? { textAlign: 'center', width: '100%' } : {}}>{part.content}</span>;
      })}
    </span>
  );
}
