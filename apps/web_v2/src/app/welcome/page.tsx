'use client';

import { Suspense } from 'react';
import SplashScreen from '@/features/welcome/splash/SplashScreen';
import WelcomeScreen from '@/features/welcome/screen/WelcomeScreen';

export default function WelcomePage() {
  return (
    <Suspense fallback={<SplashScreen status="Loading…" />}>
      <WelcomeScreen />
    </Suspense>
  );
}
