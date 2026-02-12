import NewPageWrapper from '@/components/layout/NewPageWrapper';
import CreatePageForm from '@/components/pages/CreatePageForm';

/**
 * Create new page
 * Route: /pages/new
 */
export default function NewPagePage() {
  return (
    <NewPageWrapper>
      <CreatePageForm />
    </NewPageWrapper>
  );
}
