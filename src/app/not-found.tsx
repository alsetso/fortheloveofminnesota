import PageWrapper from '@/components/layout/PageWrapper';
import { ErrorContent } from '@/components/errors/ErrorContent';

export default function NotFound() {
  return (
    <PageWrapper
      headerContent={null}
      searchComponent={null}
      showAccountDropdown={true}
    >
      <ErrorContent
        statusCode={404}
        title="Page Not Found"
        message="The page you're looking for doesn't exist or may have been removed."
      />
    </PageWrapper>
  );
}
