import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { getServerAuth } from '@/lib/authServer';
import PeoplePageClient from './PeoplePageClient';

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const auth = await getServerAuth();
  
  return (
    <PageWrapper
      headerContent={null}
      searchComponent={<MapSearchInput />}
      searchResultsComponent={<SearchResults />}
      showAccountDropdown
    >
      <PeoplePageClient searchParams={searchParams} isAuthenticated={!!auth} />
    </PageWrapper>
  );
}

