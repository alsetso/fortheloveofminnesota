'use client';

import { useState, useMemo, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  UserCircleIcon, 
  CalendarIcon, 
  ClockIcon, 
  ShareIcon, 
  BookmarkIcon, 
  HeartIcon,
  PencilIcon,
  TrashIcon,
  LockClosedIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { usePage } from '@/hooks/usePage';
import { useAuthStateSafe, type Account } from '@/features/auth';

interface PageDetailContentProps {
  pageId: string;
}

/**
 * Enhanced Page Detail Content - Notion-inspired page view
 * Fetches real data from database with visibility checks
 */
export default function PageDetailContent({ pageId }: PageDetailContentProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const { page, blocks, loading, error, isOwner } = usePage(pageId);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Render blocks from database
  const renderBlocks = () => {
    if (!blocks || blocks.length === 0) {
      return (
        <div className="text-center py-12 text-white/60">
          <p className="text-sm">This page is empty. {isOwner && 'Start adding content!'}</p>
        </div>
      );
    }

    return blocks.map((block) => {
      const content = block.content || {};
      const text = content.text || '';

      switch (block.type) {
        case 'heading_1':
          return (
            <h1 key={block.id} className="text-4xl font-bold text-white mt-12 mb-6 first:mt-0 leading-tight">
              {text}
            </h1>
          );
        case 'heading_2':
          return (
            <h2 key={block.id} className="text-3xl font-semibold text-white mt-10 mb-4 leading-tight">
              {text}
            </h2>
          );
        case 'heading_3':
          return (
            <h3 key={block.id} className="text-2xl font-semibold text-white mt-8 mb-3 leading-tight">
              {text}
            </h3>
          );
        case 'paragraph':
          return (
            <p key={block.id} className="text-base text-white/90 leading-relaxed mb-4">
              {text}
            </p>
          );
        case 'bulleted_list_item':
          return (
            <ul key={block.id} className="list-disc list-inside space-y-2 my-4 text-white/90">
              <li className="leading-relaxed">{text}</li>
            </ul>
          );
        case 'numbered_list_item':
          return (
            <ol key={block.id} className="list-decimal list-inside space-y-2 my-4 text-white/90">
              <li className="leading-relaxed">{text}</li>
            </ol>
          );
        case 'quote':
          return (
            <blockquote key={block.id} className="border-l-4 border-lake-blue pl-4 my-4 italic text-white/80">
              <p>{text}</p>
            </blockquote>
          );
        case 'divider':
          return (
            <hr key={block.id} className="my-8 border-t border-white/10" />
          );
        case 'callout':
          return (
            <div key={block.id} className="bg-surface-accent border border-white/10 rounded-md p-4 my-4">
              <div className="flex items-start gap-3">
                {content.icon && <span className="text-xl">{content.icon}</span>}
                <p className="text-sm text-white/90 flex-1">{text}</p>
              </div>
            </div>
          );
        case 'code':
          return (
            <pre key={block.id} className="bg-surface-accent border border-white/10 rounded-md p-4 my-4 overflow-x-auto">
              <code className="text-sm text-white/90 font-mono whitespace-pre">
                {text}
              </code>
            </pre>
          );
        default:
          return (
            <div key={block.id} className="text-sm text-white/60 italic my-4">
              Unsupported block type: {block.type}
            </div>
          );
      }
    });
  };

  // Legacy markdown parser (for fallback)
  const parseContent = (content: string) => {
    const lines = content.split('\n');
    const blocks: ReactElement[] = [];
    let inList = false;
    let listItems: string[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];
    let inQuote = false;
    let quoteLines: string[] = [];

    lines.forEach((line, idx) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          blocks.push(
            <pre key={`code-${idx}`} className="bg-surface-accent border border-white/10 rounded-md p-4 my-4 overflow-x-auto">
              <code className="text-sm text-white/90 font-mono whitespace-pre">
                {codeLines.join('\n')}
              </code>
            </pre>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }
      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        quoteLines.push(line.slice(2));
        inQuote = true;
        return;
      } else if (inQuote && quoteLines.length > 0) {
        blocks.push(
          <blockquote key={`quote-${idx}`} className="border-l-4 border-lake-blue pl-4 my-4 italic text-white/80">
            {quoteLines.map((q, i) => (
              <p key={i} className="mb-2 last:mb-0">{q}</p>
            ))}
          </blockquote>
        );
        quoteLines = [];
        inQuote = false;
      }

      // Lists
      if (line.match(/^[-*]\s+/)) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(line.replace(/^[-*]\s+/, ''));
        return;
      } else if (line.match(/^\d+\.\s+/)) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(line.replace(/^\d+\.\s+/, ''));
        return;
      } else if (inList && listItems.length > 0) {
        blocks.push(
          <ul key={`list-${idx}`} className="list-disc list-inside space-y-2 my-4 text-white/90">
            {listItems.map((item, i) => {
              // Parse bold text in list items
              const parts = item.split(/(\*\*.*?\*\*)/g);
              return (
                <li key={i} className="leading-relaxed">
                  {parts.map((part, pIdx) => 
                    part.startsWith('**') && part.endsWith('**') ? (
                      <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>
                    ) : (
                      <span key={pIdx}>{part}</span>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        );
        listItems = [];
        inList = false;
      }

      // Headings
      if (line.startsWith('# ')) {
        blocks.push(
          <h1 key={idx} className="text-4xl font-bold text-white mt-12 mb-6 first:mt-0 leading-tight">
            {line.slice(2)}
          </h1>
        );
        return;
      }
      if (line.startsWith('## ')) {
        blocks.push(
          <h2 key={idx} className="text-3xl font-semibold text-white mt-10 mb-4 leading-tight">
            {line.slice(3)}
          </h2>
        );
        return;
      }
      if (line.startsWith('### ')) {
        blocks.push(
          <h3 key={idx} className="text-2xl font-semibold text-white mt-8 mb-3 leading-tight">
            {line.slice(4)}
          </h3>
        );
        return;
      }
      if (line.startsWith('#### ')) {
        blocks.push(
          <h4 key={idx} className="text-xl font-semibold text-white mt-6 mb-2">
            {line.slice(5)}
          </h4>
        );
        return;
      }

      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***') {
        blocks.push(
          <hr key={idx} className="my-8 border-t border-white/10" />
        );
        return;
      }

      // Empty lines
      if (line.trim() === '') {
        return;
      }

      // Regular paragraphs with inline formatting
      const parseInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|\[.*?\]\(.*?\))/g);
        return parts.map((part, pIdx) => {
          // Bold
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('__') && part.endsWith('__')) {
            return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
          }
          // Italic
          if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
            return <em key={pIdx} className="italic">{part.slice(1, -1)}</em>;
          }
          if (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__')) {
            return <em key={pIdx} className="italic">{part.slice(1, -1)}</em>;
          }
          // Code
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code key={pIdx} className="bg-surface-accent px-1.5 py-0.5 rounded text-sm font-mono text-white/90">
                {part.slice(1, -1)}
              </code>
            );
          }
          // Links
          const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
          if (linkMatch) {
            return (
              <a
                key={pIdx}
                href={linkMatch[2]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lake-blue hover:text-lake-blue/80 underline"
              >
                {linkMatch[1]}
              </a>
            );
          }
          return <span key={pIdx}>{part}</span>;
        });
      };

      blocks.push(
        <p key={idx} className="text-base text-white/90 leading-relaxed mb-4">
          {parseInline(line)}
        </p>
      );
    });

    // Handle remaining list or quote
    if (inList && listItems.length > 0) {
      blocks.push(
        <ul key="list-final" className="list-disc list-inside space-y-2 my-4 text-white/90">
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      );
    }
    if (inQuote && quoteLines.length > 0) {
      blocks.push(
        <blockquote key="quote-final" className="border-l-4 border-lake-blue pl-4 my-4 italic text-white/80">
          {quoteLines.map((q, i) => (
            <p key={i} className="mb-2 last:mb-0">{q}</p>
          ))}
        </blockquote>
      );
    }

    return blocks;
  };

  const handleDelete = async () => {
    if (!isOwner || !page) return;
    
    if (!confirm(`Are you sure you want to delete "${page.title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      // Call API route to delete page
      const response = await fetch(`/api/pages/${page.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete page');
      }

      router.push('/page');
    } catch (err) {
      console.error('Error deleting page:', err);
      alert('Failed to delete page');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto w-full px-4 py-12">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-[800px] mx-auto w-full px-4 py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Page Not Found</h2>
          <p className="text-sm text-white/60 mb-4">{error || 'This page does not exist or you do not have permission to view it.'}</p>
          <Link
            href="/page"
            className="inline-block px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
          >
            Browse Pages
          </Link>
        </div>
      </div>
    );
  }

  const ownerName = page.owner.first_name && page.owner.last_name
    ? `${page.owner.first_name} ${page.owner.last_name}`
    : page.owner.username || 'Unknown';

  const visibilityIcon = {
    private: LockClosedIcon,
    public: GlobeAltIcon,
    shared: UserGroupIcon,
  }[page.visibility];

  const VisibilityIcon = visibilityIcon;

  return (
    <div className="max-w-[800px] mx-auto w-full">
      {/* Cover Image */}
      <div className="w-full h-[400px] bg-surface-accent rounded-t-md mb-8 flex items-center justify-center border border-white/10 overflow-hidden relative">
        {page.cover_url ? (
          <img src={page.cover_url} alt={page.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <div className="w-24 h-24 bg-surface rounded-md mx-auto mb-3 flex items-center justify-center border border-white/10">
              <span className="text-4xl">{page.icon || '📄'}</span>
            </div>
            {isOwner && (
              <p className="text-xs text-white/60">Add cover image</p>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="px-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-5xl font-bold text-white mb-4 leading-tight flex-1">
            {page.title}
          </h1>
          {isOwner && (
            <div className="flex items-center gap-2">
              <Link
                href={`/page/${page.id}/edit`}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-accent text-white/70 hover:bg-surface-accent/80 hover:text-white transition-colors text-sm"
              >
                <PencilIcon className="w-4 h-4" />
                <span>Edit</span>
              </Link>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Author & Metadata Bar */}
      <div className="px-4 mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {page.owner.image_url ? (
              <ProfilePhoto account={page.owner as unknown as Account} size="md" editable={false} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-accent flex items-center justify-center border border-white/10">
                <UserCircleIcon className="w-5 h-5 text-white/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-white truncate">
                  {ownerName}
                </div>
                <VisibilityIcon className="w-4 h-4 text-white/50" />
              </div>
              <div className="flex items-center gap-3 text-xs text-white/60">
                {page.owner.username && (
                  <>
                    <span>@{page.owner.username}</span>
                    <span>·</span>
                  </>
                )}
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3 h-3" />
                  <span>{new Date(page.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
                {page.last_edited_at !== page.created_at && (
                  <>
                    <span>·</span>
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="w-3 h-3" />
                      <span>Updated {new Date(page.last_edited_at).toLocaleDateString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isLiked
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-surface-accent text-white/70 hover:bg-surface-accent/80 hover:text-white'
              }`}
            >
              <HeartIcon className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isBookmarked
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-surface-accent text-white/70 hover:bg-surface-accent/80 hover:text-white'
              }`}
            >
              <BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-accent text-white/70 hover:bg-surface-accent/80 hover:text-white transition-colors">
              <ShareIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {page.description && (
          <p className="text-sm text-white/70 mt-4">{page.description}</p>
        )}

        {/* Tags */}
        {page.tags && page.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {page.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-surface-accent text-xs text-white/70 rounded-md border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-16">
        <article className="prose prose-invert max-w-none">
          <div className="text-base text-white/90 leading-relaxed">
            {renderBlocks()}
          </div>
        </article>
      </div>
    </div>
  );
}
