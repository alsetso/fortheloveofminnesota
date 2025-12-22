'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface QuestionSubmissionFormProps {
  onSubmitted?: () => void;
}

export default function QuestionSubmissionForm({ onSubmitted }: QuestionSubmissionFormProps) {
  const { user } = useAuth();
  const { openWelcome } = useAppModalContextSafe();
  const [isExpanded, setIsExpanded] = useState(false);
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!user) {
      openWelcome();
      return;
    }
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (question.length > 2000) {
      setError('Question must be 2000 characters or less');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(false);

      const response = await fetch('/api/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit question' }));
        throw new Error(errorData.error || 'Failed to submit question');
      }

      setSuccess(true);
      setQuestion('');
      setIsExpanded(false);
      
      if (onSubmitted) {
        onSubmitted();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit question');
    } finally {
      setSubmitting(false);
    }
  };

  // If not expanded, show just a button
  if (!isExpanded) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <button
          onClick={() => {
            if (!user) {
              openWelcome();
              return;
            }
            setIsExpanded(true);
          }}
          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
        >
          Ask a Question
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-900">Ask a Question</h2>
        <button
          onClick={() => {
            setIsExpanded(false);
            setQuestion('');
            setError(null);
            setSuccess(false);
          }}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-1.5">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-1.5">
            Question submitted! We'll review it and add an answer soon.
          </div>
        )}
        <textarea
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setError(null);
          }}
          placeholder="Enter your question..."
          className="w-full text-xs text-gray-900 border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
          rows={3}
          maxLength={2000}
          disabled={submitting}
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {question.length}/2000 characters
          </span>
          <button
            type="submit"
            disabled={submitting || !question.trim()}
            className="px-3 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
