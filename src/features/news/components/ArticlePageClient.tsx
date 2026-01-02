'use client';

import { useState, useEffect } from 'react';
import { ClockIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import Link from 'next/link';
import { format, startOfDay } from 'date-fns';
import Image from 'next/image';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import type { NewsArticle, ArticleComment } from '@/types/news';
import { getSourceInitials, getSourceColor, formatFullDateTime } from '@/features/news/utils/newsHelpers';

interface ArticlePageClientProps {
  articleId: string;
}

export default function ArticlePageClient({ articleId }: ArticlePageClientProps) {
  const { account, user } = useAuthStateSafe();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch article and comments
  useEffect(() => {
    fetchArticle();
    fetchComments();
    fetchLatestNews();
  }, [articleId]);

  const fetchArticle = async () => {
    try {
      const response = await fetch(`/api/news/${articleId}`);
      const data = await response.json();
      
      if (data.success && data.data?.article) {
        setArticle(data.data.article);
      } else {
        setError(data.error || 'Article not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/article/${articleId}/comments`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setComments(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  const fetchLatestNews = async () => {
    try {
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const response = await fetch(`/api/news/by-date?startDate=${today}&endDate=${today}&limit=50`);
      const data = await response.json();
      
      if (data.success && data.data?.articles) {
        // Exclude the current article
        const filtered = data.data.articles
          .filter((a: NewsArticle) => a.id !== articleId && a.article_id !== articleId)
          .slice(0, 50);
        setLatestNews(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch latest news:', err);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !account || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/article/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setNewComment('');
        await fetchComments();
      } else {
        alert(data.error || 'Failed to post comment');
      }
    } catch (err) {
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">Loading article...</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="bg-white border border-red-200 rounded-md p-[10px]">
        <p className="text-xs text-red-600">{error || 'Article not found'}</p>
        <Link href="/" className="text-xs text-gray-600 hover:text-gray-900 mt-2 inline-block">
          ← Back to Home
        </Link>
      </div>
    );
  }

  const sourceInitials = getSourceInitials(article.source.name);
  const sourceColor = getSourceColor(article.source.name);
  const topLevelComments = comments.filter(c => !c.parent_comment_id);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column - Article Summary */}
        <div className="lg:col-span-8 space-y-3">
          {/* Breadcrumb */}
          <nav className="text-xs text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span> / </span>
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span> / </span>
            <span className="text-gray-900">Article</span>
          </nav>

          {/* Article Content - Inline */}
          <div className="space-y-3">
            {/* Headline */}
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 leading-tight">{article.title}</h1>
            
            {/* Snippet */}
            {article.snippet && (
              <p className="text-xs text-gray-700 leading-relaxed">{article.snippet}</p>
            )}

            {/* Hero Image - Full Width */}
            {article.photoUrl && (
              <div className="relative w-full aspect-video bg-gray-100 overflow-hidden rounded-md">
                <Image
                  src={article.photoUrl}
                  alt={article.title}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority
                  unoptimized={article.photoUrl?.startsWith('http')}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>

      {/* Right Column - Comments */}
      <div className="lg:col-span-4 space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="flex items-center gap-2">
            <ChatBubbleLeftIcon className="w-4 h-4 text-gray-700" />
            <h2 className="text-xs font-semibold text-gray-900">Do you know anything about this? Let the community know. ({comments.length})</h2>
          </div>

          {/* Comment Form */}
          {user && account ? (
            <form onSubmit={handleSubmitComment} className="space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="w-full px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          ) : (
            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded-md">
              <Link href="/" className="text-gray-900 hover:underline">Sign in</Link> to comment
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {topLevelComments.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
            ) : (
              topLevelComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Disclaimer */}
        <div className="text-center space-y-0.5 pt-2">
          <p className="text-[10px] text-gray-500">Share your knowledge, experiences, or insights about this story.</p>
          <p className="text-[10px] text-gray-500">Help build a more informed Minnesota community.</p>
        </div>
      </div>
      </div>

      {/* Latest News Section - Full Width */}
      {latestNews.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-gray-900">LATEST NEWS</h2>
            <p className="text-xs text-gray-600">
              We take the top 100 news articles (everyday) from every source talking about our great state of Minnesota and give the people a community to expand others knowledge of the news event.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {latestNews.map((newsArticle) => {
              const sourceInitials = getSourceInitials(newsArticle.source.name);
              const sourceColor = getSourceColor(newsArticle.source.name);
              
              return (
                <Link
                  key={newsArticle.id}
                  href={`/news/${newsArticle.id}`}
                  className="bg-white border border-gray-200 rounded-md overflow-hidden hover:bg-gray-50 transition-colors"
                >
                  {/* Photo Image */}
                  {newsArticle.photoUrl ? (
                    <div className="relative w-full aspect-video overflow-hidden bg-gray-100">
                      <Image
                        src={newsArticle.photoUrl}
                        alt={newsArticle.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`w-full aspect-video ${sourceColor.bg} flex items-center justify-center border-b border-gray-200`}>
                      <span className={`text-xs font-semibold ${sourceColor.text} leading-none`}>
                        {sourceInitials}
                      </span>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="p-[10px] space-y-1.5">
                    <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">
                      {newsArticle.title}
                    </h3>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-gray-600">{newsArticle.source.name}</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <ClockIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="line-clamp-1">{formatFullDateTime(newsArticle.publishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, allComments }: { comment: ArticleComment; allComments: ArticleComment[] }) {
  const replies = allComments.filter(c => c.parent_comment_id === comment.id);
  const account = comment.accounts;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {account ? (
          <ProfilePhoto
            account={{
              id: account.id,
              username: account.username,
              first_name: account.first_name,
              image_url: account.image_url,
            } as any}
            size="xs"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] text-gray-500">?</span>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-900">
              {account?.username || account?.first_name || 'Loading...'}
            </span>
            <span className="text-[10px] text-gray-500">
              {format(new Date(comment.created_at), 'MMM d, h:mm a')}
            </span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{comment.content}</p>
        </div>
      </div>
      
      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-6 space-y-2 pl-2 border-l border-gray-200">
          {replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} allComments={allComments} />
          ))}
        </div>
      )}
    </div>
  );
}

