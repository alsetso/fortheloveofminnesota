import { Suspense } from 'react';
import ContactsPage from '@/features/contacts/ContactsPage';
import SplashScreen from '@/features/welcome/splash/SplashScreen';

/**
 * /contacts — contact book (footer Contacts tab).
 */
export default function ContactsRoutePage() {
  return (
    <Suspense fallback={<SplashScreen status="Loading…" />}>
      <ContactsPage />
    </Suspense>
  );
}
