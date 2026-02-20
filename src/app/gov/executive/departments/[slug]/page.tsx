import { redirect } from 'next/navigation';

type Props = { params: Promise<{ slug: string }> };

export default async function ExecutiveDepartmentPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/gov/org/${slug}`);
}
