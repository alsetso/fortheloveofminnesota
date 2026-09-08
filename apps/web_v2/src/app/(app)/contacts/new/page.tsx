import { Suspense } from 'react';
import ContactsNewPage from '@/features/contacts/ContactsNewPage';
import SplashScreen from '@/features/welcome/splash/SplashScreen';

/**
 * /contacts/new — add ladder (person or property/owner lookup → confirm).
 */
export default function ContactsNewRoutePage() {
  return (
    <Suspense fallback={<SplashScreen status="Loading…" />}>
      <ContactsNewPage />
    </Suspense>
  );
}
