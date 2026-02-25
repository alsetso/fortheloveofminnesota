'use client';

import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import WeatherDashboard from '@/components/weather/WeatherDashboard';

export default function WeatherPageClient() {
  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <WeatherDashboard />
    </NewPageWrapper>
  );
}
