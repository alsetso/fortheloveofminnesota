import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function MapSettingsPage({ params }: Props) {
  const { id } = await params;
  // Legacy settings page is deprecated – redirect to main map view
  redirect(`/map/${id}`);
}
