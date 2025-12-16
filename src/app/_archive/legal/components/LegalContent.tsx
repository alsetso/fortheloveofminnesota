'use client';

import { ReactNode } from 'react';

interface LegalContentProps {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}

export default function LegalContent({ title, lastUpdated, children }: LegalContentProps) {
  const currentDate = lastUpdated || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-black text-black mb-4">{title}</h1>
        <p className="text-sm text-gray-600">Last updated: {currentDate}</p>
      </div>

      {/* Beta Disclaimer */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <p className="text-sm text-gray-500 italic leading-relaxed">
          Please note: MNUDA is currently operating in BETA mode. All terms, policies, and pricing are subject to change. 
          These documents may be incomplete or contain inaccuracies. We reserve the right to modify any terms, conditions, 
          or pricing at any time without prior notice.
        </p>
      </div>

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        {children}
      </div>
    </div>
  );
}

