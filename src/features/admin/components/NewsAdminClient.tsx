'use client';

import { useState } from 'react';

export default function NewsAdminClient() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate news');
      }

      setSuccess(data.message || 'News generated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate news');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px]">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-600">
            Generate news articles from Minnesota sources. This will fetch the latest news and save it to the database.
          </p>
        </div>

        {error && (
          <div className="p-[10px] bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-[10px] bg-green-50 border border-green-200 rounded-md">
            <p className="text-xs text-green-700">{success}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? 'Generating...' : 'Generate News'}
        </button>
      </div>
    </div>
  );
}

