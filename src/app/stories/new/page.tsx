import NewPageWrapper from '@/components/layout/NewPageWrapper';
import CreateStoryForm from '@/components/stories/CreateStoryForm';

/**
 * Create new story
 * Route: /stories/new
 */
export default function NewStoryPage() {
  return (
    <NewPageWrapper>
      <CreateStoryForm />
    </NewPageWrapper>
  );
}
