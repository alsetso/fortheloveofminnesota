'use client';

import { useEffect, useState } from 'react';
import { FAQ } from '@/types/faq';
import FAQItem from '@/features/faqs/components/FAQItem';
import QuestionSubmissionForm from '@/features/faqs/components/QuestionSubmissionForm';
import { supabase } from '@/lib/supabase';

export default function FAQsSecondaryContent() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFAQs() {
      try {
        setLoading(true);
        setError(null);

        // Check if user is admin
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: account } = await supabase
            .from('accounts')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          if (account?.role === 'admin') {
            setIsAdmin(true);
          }
        }

        // Fetch FAQs (admin sees all, public sees only visible)
        const response = await fetch('/api/faqs');
        if (!response.ok) {
          throw new Error('Failed to fetch FAQs');
        }

        const data = await response.json();
        // Ensure data is always an array
        setFaqs(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load FAQs');
      } finally {
        setLoading(false);
      }
    }

    fetchFAQs();
  }, []);

  const handleUpdate = (updatedFAQ: FAQ) => {
    setFaqs((prev) => prev.map((faq) => (faq.id === updatedFAQ.id ? updatedFAQ : faq)));
  };

  const handleDelete = (id: string) => {
    setFaqs((prev) => prev.filter((faq) => faq.id !== id));
  };

  const handleQuestionSubmitted = async () => {
    // Refresh FAQs list
    try {
      const response = await fetch('/api/faqs');
      if (!response.ok) {
        throw new Error('Failed to fetch FAQs');
      }
      const data = await response.json();
      // Ensure data is always an array
      setFaqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error refreshing FAQs:', err);
    }
  };

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
