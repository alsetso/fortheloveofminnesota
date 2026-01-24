import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/authServer';
import LandingPage from '@/components/landing/LandingPage';

export default async function Home() {
  // Check if user is authenticated
  const auth = await getServerAuth();
  
  // If authenticated, redirect to feed
  if (auth) {
    redirect('/feed');
  }
  
  // If not authenticated, show landing page
  return <LandingPage />;
}
