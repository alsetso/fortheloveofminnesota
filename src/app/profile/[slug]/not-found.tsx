import PageWrapper from '@/components/layout/PageWrapper';
import { ErrorContent } from '@/components/errors/ErrorContent';

export default function ProfileNotFound() {
  return (
    <PageWrapper
      headerContent={null}
      searchComponent={null}
      showAccountDropdown={true}
    >
      <ErrorContent
        statusCode={404}
        title="Profile Not Found"
        message="The profile you're looking for doesn't exist or may have been removed."
        homeButtonText="Back to Home"
      />
    </PageWrapper>
  );
}







