import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function BusinessDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { view } = await searchParams;
  
  // Redirect to new /page/:id route
  const searchParamsString = view ? `?view=${view}` : '';
  redirect(`/page/${id}${searchParamsString}`);
}

