import StripeEventsSettingsClient from './StripeEventsSettingsClient';

export const metadata = {
  title: 'Stripe Events | Pricing | Settings | Love of Minnesota',
  description: 'Admin: Stripe webhook events and subscription tracking',
};

export default function StripeEventsSettingsPage() {
  return <StripeEventsSettingsClient />;
}
