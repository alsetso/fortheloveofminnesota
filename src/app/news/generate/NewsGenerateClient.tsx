'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { ParsedArticle } from '@/lib/services/newsGenerationService';
import Image from 'next/image';

export default function NewsGenerateClient() {
  const router = useRouter();
  const { openWelcome } = useAppModalContextSafe();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewArticles, setPreviewArticles] = useState<ParsedArticle[] | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    query: 'Minnesota, MN',
    timePublished: '1d',
    country: 'US',
    lang: 'en',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setPreviewArticles(null);
    setPromptId(null);

    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate news');
      }

      // Show preview instead of redirecting
      setPreviewArticles(data.articles || []);
      setPromptId(data.promptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate news');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!promptId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/news/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ promptId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save articles');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/news');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save articles');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPreviewArticles(null);
    setPromptId(null);
    setError(null);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-surface border border-border-muted dark:border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-lake-blue focus:border-transparent text-foreground placeholder:text-foreground-muted';

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-foreground">Generate News</h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Admin only: Search for news articles using RapidAPI
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="border border-border-muted dark:border-white/10 rounded-md bg-surface p-[10px] space-y-3">
            <div>
              <label htmlFor="query" className="block text-xs font-medium text-foreground mb-1.5">
                Search Query
              </label>
              <input
                type="text"
                id="query"
                value={formData.query}
                onChange={(e) => handleChange('query', e.target.value)}
                required
                className={inputClass}
                placeholder="e.g., Minnesota, MN"
              />
            </div>

            <div>
              <label htmlFor="timePublished" className="block text-xs font-medium text-foreground mb-1.5">
                Time Published
              </label>
              <select
                id="timePublished"
                value={formData.timePublished}
                onChange={(e) => handleChange('timePublished', e.target.value)}
                className={inputClass}
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>

            <div>
              <label htmlFor="country" className="block text-xs font-medium text-foreground mb-1.5">
                Country
              </label>
              <input
                type="text"
                id="country"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className={inputClass}
                placeholder="US"
              />
            </div>

            <div>
              <label htmlFor="lang" className="block text-xs font-medium text-foreground mb-1.5">
                Language
              </label>
              <input
                type="text"
                id="lang"
                value={formData.lang}
                onChange={(e) => handleChange('lang', e.target.value)}
                className={inputClass}
                placeholder="en"
              />
            </div>
          </div>

          {error && (
            <div className="p-[10px] bg-red-500/10 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-[10px] bg-green-500/10 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-md">
              <p className="text-xs text-green-600 dark:text-green-400">
                Articles saved successfully! Redirecting...
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !!previewArticles}
              className="px-4 py-2 text-xs font-semibold text-white bg-lake-blue hover:bg-lake-blue/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate News'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/news')}
              className="px-4 py-2 text-xs font-semibold text-foreground bg-surface border border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/10 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        {previewArticles && previewArticles.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="border border-border-muted dark:border-white/10 rounded-md bg-surface p-[10px]">
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Preview: {previewArticles.length} articles found
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-hide">
                {previewArticles.map((article, idx) => {
                  const imageUrl = article.photo_url || article.thumbnail_url;
                  return (
                    <div
                      key={idx}
                      className="border border-border-muted dark:border-white/10 rounded-md p-[10px] space-y-1.5"
                    >
                      <div className="flex gap-2">
                        {imageUrl && (
                          <div className="flex-shrink-0 w-20 h-20 rounded overflow-hidden bg-surface-accent dark:bg-white/10 relative">
                            <Image
                              src={imageUrl}
                              alt={article.title}
                              fill
                              sizes="80px"
                              className="object-cover"
                              unoptimized
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-medium text-foreground line-clamp-2">
                            {article.title}
                          </h3>
                          {article.source_name && (
                            <p className="text-xs text-foreground-muted mt-0.5">
                              {article.source_name}
                            </p>
                          )}
                          {article.snippet && (
                            <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                              {article.snippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-lake-blue hover:bg-lake-blue/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : `Save ${previewArticles.length} Articles`}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-foreground bg-surface border border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
