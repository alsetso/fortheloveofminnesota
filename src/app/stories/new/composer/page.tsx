import NewPageWrapper from '@/components/layout/NewPageWrapper';
import StoryComposer from '@/components/stories/StoryComposer';

/**
 * Story Composer Page
 * Route: /stories/new/composer
 * Allows users to create and manage slides for a story
 */
export default function StoryComposerPage() {
  return (
    <NewPageWrapper>
      <StoryComposer />
    </NewPageWrapper>
  );
}
