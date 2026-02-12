'use client';

import { useEffect } from 'react';
import { ErrorContent } from '@/components/errors/ErrorContent';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Analytics] Error:', error);
  }, [error]);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full py-6">
        <div className="max-w-[600px] mx-auto px-4">
          <ErrorContent
            statusCode={500}
            title="Analytics unavailable"
            message="We couldn't load your analytics. Please try again or contact support if the problem persists."
            error={process.env.NODE_ENV === 'development' ? error : undefined}
            showHomeButton={true}
            homeButtonText="Go to Homepage"
          />
          <div className="mt-4 flex justify-center">
            <button
              onClick={reset}
              className="text-xs text-foreground-muted hover:text-foreground underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </NewPageWrapper>
  );
}
