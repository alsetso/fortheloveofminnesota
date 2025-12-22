'use client';

import { useState } from 'react';
import { FAQ } from '@/types/faq';
import { PencilIcon, CheckIcon, XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface FAQItemProps {
  faq: FAQ;
  isAdmin: boolean;
  onUpdate: (faq: FAQ) => void;
  onDelete: (id: string) => void;
}

export default function FAQItem({ faq, isAdmin, onUpdate, onDelete }: FAQItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer || '');
  const [isVisible, setIsVisible] = useState(faq.is_visible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim() || null,
          is_visible: isVisible,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update FAQ' }));
        throw new Error(errorData.error || 'Failed to update FAQ');
      }

      const updatedFAQ = await response.json();
      onUpdate(updatedFAQ);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update FAQ');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setQuestion(faq.question);
    setAnswer(faq.answer || '');
    setIsVisible(faq.is_visible);
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this FAQ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete FAQ');
      }

      onDelete(faq.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete FAQ');
    }
  };

  const toggleVisibility = async () => {
    if (isEditing) {
      setIsVisible(!isVisible);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: !isVisible }),
      });

      if (!response.ok) {
        throw new Error('Failed to update visibility');
      }

      const updatedFAQ = await response.json();
      onUpdate(updatedFAQ);
      setIsVisible(updatedFAQ.is_visible);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && isAdmin) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-1.5">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-700">Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full text-xs text-gray-900 border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows={2}
            maxLength={2000}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-700">Answer</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full text-xs text-gray-900 border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows={4}
            maxLength={10000}
            placeholder="Enter answer..."
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="w-3 h-3"
            />
            Visible to public
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !question.trim()}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckIcon className="w-3 h-3" />
            Save
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XMarkIcon className="w-3 h-3" />
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs font-semibold text-gray-900 flex-1">{faq.question}</h2>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={toggleVisibility}
              disabled={saving}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              title={isVisible ? 'Hide from public' : 'Show to public'}
            >
              {isVisible ? (
                <EyeIcon className="w-3 h-3" />
              ) : (
                <EyeSlashIcon className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Edit FAQ"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {faq.answer ? (
        <p className="text-xs text-gray-600 leading-relaxed">{faq.answer}</p>
      ) : (
        isAdmin && (
          <p className="text-xs text-gray-500 italic">No answer yet</p>
        )
      )}
      {!isVisible && isAdmin && (
        <p className="text-xs text-gray-500 italic">Hidden from public</p>
      )}
    </section>
  );
}
