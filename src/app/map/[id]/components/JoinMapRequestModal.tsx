'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface JoinMapRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: Array<{ question_id: number; answer: string }>) => Promise<void>;
  membershipQuestions: Array<{ id: number; question: string }>;
  membershipRules: string | null;
}

export default function JoinMapRequestModal({
  isOpen,
  onClose,
  onSubmit,
  membershipQuestions,
  membershipRules,
}: JoinMapRequestModalProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validate required questions
    const requiredQuestions = membershipQuestions.filter(q => {
      // Assuming required is true if not specified
      return true;
    });

    const missingAnswers = requiredQuestions.filter(q => !answers[q.id]?.trim());
    if (missingAnswers.length > 0) {
      setError('Please answer all required questions');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const answersArray = membershipQuestions
        .map(q => ({
          question_id: q.id,
          answer: answers[q.id] || '',
        }))
        .filter(a => a.answer.trim());

      await onSubmit(answersArray);
      setAnswers({});
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Request to Join Map</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Membership Rules */}
          {membershipRules && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-500">Membership Rules</div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                <div className="text-xs text-gray-700 whitespace-pre-wrap">
                  {membershipRules}
                </div>
              </div>
            </div>
          )}

          {/* Questions */}
          {membershipQuestions.length > 0 ? (
            <div className="space-y-3">
              <div className="text-[10px] font-medium text-gray-500">Questions</div>
              {membershipQuestions.map((question) => (
                <div key={question.id} className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-900">
                    {question.question}
                  </label>
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(e) =>
                      setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))
                    }
                    placeholder="Your answer..."
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500">No questions required</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
