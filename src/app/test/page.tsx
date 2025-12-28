import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import SalesPage from './components/SalesPage';
import {
  SalesPageMinimal,
  SalesPageGrid,
  SalesPageEmotional,
  SalesPageCommunity,
  SalesPageUtility,
  SalesPageBenefits,
} from './components/SalesPageVariations';
import {
  SalesPageQuestions,
  SalesPageProblemSolution,
  SalesPageBeforeAfter,
  SalesPageSocialProof,
  SalesPageDetailed,
  SalesPagePunchy,
} from './components/MoreSalesVariations';
import {
  StatsSection,
  TestimonialsSection,
  FeatureComparison,
  CTASection,
  UseCasesSection,
  ProcessSection,
  HighlightBox,
  FAQPreview,
} from './components/NewComponentTypes';
import {
  FeatureGrid,
  ValuePropsList,
  SplitContent,
  TimelineSection,
  ComparisonTable,
  IconShowcase,
  BenefitsGrid,
  SimpleCTA,
} from './components/MoreComponentTypes';
import SectionAccordion from './components/SectionAccordion';
import UIPlayground from './components/UIPlayground';

export const metadata: Metadata = {
  title: 'Test | For the Love of Minnesota',
  description: 'Test homepage for For the Love of Minnesota',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TestPage() {
  return (
    <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <div className="space-y-3">
        {/* Original Sales Page - 4 Sections */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Original Sales Page</h2>
          <SalesPage />
        </div>

        {/* Sales Page Variations - Set 1 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Sales Page Variations - Set 1</h2>
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V1: Minimal Text-Heavy</h3>
              <SalesPageMinimal />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V2: Feature Grid Layout</h3>
              <SalesPageGrid />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V3: Emotional Story-Driven</h3>
              <SalesPageEmotional />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V4: Community-Focused</h3>
              <SalesPageCommunity />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V5: Utility Function-First</h3>
              <SalesPageUtility />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V6: Benefits-Focused</h3>
              <SalesPageBenefits />
            </div>
          </div>
        </div>

        {/* Sales Page Variations - Set 2 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Sales Page Variations - Set 2</h2>
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V7: Question-Based Approach</h3>
              <SalesPageQuestions />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V8: Problem-Solution Format</h3>
              <SalesPageProblemSolution />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V9: Before/After Comparison</h3>
              <SalesPageBeforeAfter />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V10: Social Proof Approach</h3>
              <SalesPageSocialProof />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V11: Feature-Rich Detailed</h3>
              <SalesPageDetailed />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">V12: Short & Punchy</h3>
              <SalesPagePunchy />
            </div>
          </div>
        </div>

        {/* Component Types - Set 1 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Component Types - Set 1</h2>
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C1: Stats/Metrics Display</h3>
              <StatsSection />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C2: Testimonials/Quotes</h3>
              <TestimonialsSection />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C3: Feature Comparison Checklist</h3>
              <FeatureComparison />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C4: Dark CTA Section</h3>
              <CTASection />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C5: Use Cases List</h3>
              <UseCasesSection />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C6: Step-by-Step Process</h3>
              <ProcessSection />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C7: Highlight Box (Gradient)</h3>
              <HighlightBox />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C8: FAQ Preview</h3>
              <FAQPreview />
            </div>
          </div>
        </div>

        {/* Component Types - Set 2 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Component Types - Set 2</h2>
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C9: Feature Grid with Icons</h3>
              <FeatureGrid />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C10: Value Props List</h3>
              <ValuePropsList />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C11: Split Content Layout</h3>
              <SplitContent />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C12: Timeline/Progression</h3>
              <TimelineSection />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C13: Comparison Table</h3>
              <ComparisonTable />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C14: Icon Showcase</h3>
              <IconShowcase />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C15: Benefits Grid</h3>
              <BenefitsGrid />
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-1">C16: Simple CTA</h3>
              <SimpleCTA />
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="space-y-1.5">
            <h1 className="text-sm font-semibold text-gray-900">For the Love of Minnesota</h1>
            <p className="text-xs text-gray-600 leading-relaxed">
              Connecting residents, neighbors, and professionals across the state. Archive special parts of your life in Minnesota.
            </p>
          </div>
        </section>

        {/* UI Playground */}
        <UIPlayground />

        {/* Accordion Section */}
        <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-gray-900">Website Sections</h2>
            <p className="text-xs text-gray-600">
              Explore different UI styles for each main section of the website.
            </p>
          </div>
          <SectionAccordion />
        </section>
      </div>
    </SimplePageLayout>
  );
}

