'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import WeatherSubNav from '@/components/sub-nav/WeatherSubNav';
import WeatherDashboard from '@/components/weather/WeatherDashboard';

export default function WeatherPageClient() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 896 : true
  );

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<WeatherSubNav />}
      subSidebarLabel="Weather"
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
    >
      <WeatherDashboard />
    </NewPageWrapper>
  );
}
