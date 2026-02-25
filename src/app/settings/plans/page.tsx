import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Plans | Settings | Love of Minnesota',
  description: 'Compare plans and their features',
};

export default function PlansPage() {
  redirect('/pricing');
}
