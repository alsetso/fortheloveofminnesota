'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { FAQ } from '@/types/faq';
import FAQItem from '@/features/faqs/components/FAQItem';
import QuestionSubmissionForm from '@/features/faqs/components/QuestionSubmissionForm';
import { useAuthStateSafe } from '@/features/auth';

export default function FAQsSecondaryContent() {
  const { user, account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchFAQs = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Fetch FAQs (admin sees all, public sees only visible)
      const response = await fetch('/api/faqs');
      if (!response.ok) {
        throw new Error('Failed to fetch FAQs');
      }

      const data = await response.json();
      // Ensure data is always an array
      setFaqs(Array.isArray(data) ? data : []);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FAQs');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Only fetch once on mount
  useEffect(() => {
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchFAQs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleUpdate = (updatedFAQ: FAQ) => {
    setFaqs((prev) => prev.map((faq) => (faq.id === updatedFAQ.id ? updatedFAQ : faq)));
  };

  const handleDelete = (id: string) => {
    setFaqs((prev) => prev.filter((faq) => faq.id !== id));
  };

  const handleQuestionSubmitted = useCallback(async () => {
    // Refresh FAQs list after question submission
    await fetchFAQs();
  }, [fetchFAQs]);

  const handleManualRefresh = useCallback(async () => {
    // Manual refresh - reset the fetched flag to allow refetch
    hasFetchedRef.current = false;
    await fetchFAQs();
  }, [fetchFAQs]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Loading FAQs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-red-200 rounded-md p-[10px]">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Filter FAQs for display (ensure faqs is always an array)
  const faqsArray = Array.isArray(faqs) ? faqs : [];
  
  // Public users: Only visible FAQs with answers
  const publicFAQs = !isAdmin 
    ? faqsArray.filter((faq) => faq.is_visible && faq.answer)
    : [];
  
  // Admin: Separate lists - no combination
  const answeredFAQs = isAdmin 
    ? faqsArray.filter((faq) => faq.answer)
    : [];
  const unansweredFAQs = isAdmin 
    ? faqsArray.filter((faq) => !faq.answer)
    : [];

  return (
    <div className="space-y-3">
      {/* Question Submission Form */}
      <QuestionSubmissionForm onSubmitted={handleQuestionSubmitted} />

      {/* Public Section: Visible FAQs with answers */}
      {!isAdmin && (
        <>
          {publicFAQs.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-900">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {publicFAQs.map((faq) => (
                  <FAQItem
                    key={faq.id}
                    faq={faq}
                    isAdmin={false}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ) : (
            !loading && (
              <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                <p className="text-xs text-gray-600">No FAQs available yet. Check back soon!</p>
              </div>
            )
          )}
        </>
      )}

      {/* Admin Section: Answered FAQs */}
      {isAdmin && answeredFAQs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-900">Answered FAQs ({answeredFAQs.length})</h2>
          <div className="space-y-2">
            {answeredFAQs.map((faq) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                isAdmin={isAdmin}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admin Section: Unanswered Questions */}
      {isAdmin && unansweredFAQs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-900">Unanswered Questions ({unansweredFAQs.length})</h2>
          <div className="space-y-2">
            {unansweredFAQs.map((faq) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                isAdmin={isAdmin}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admin: Empty state if no FAQs at all */}
      {isAdmin && answeredFAQs.length === 0 && unansweredFAQs.length === 0 && !loading && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">No FAQs yet. Questions submitted by users will appear here.</p>
        </div>
      )}
    </div>
  );
}

