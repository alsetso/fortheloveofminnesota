import type { LaunchPageTypeSlug } from '@/lib/directory/pageTypes';

export type LaunchLocationMode = 'building' | 'city' | 'skip';

export type LaunchFieldKey =
  | 'title'
  | 'description'
  | 'phone'
  | 'email'
  | 'website'
  | 'instagram';

export type LaunchFieldDef = {
  key: LaunchFieldKey;
  label: string;
  placeholder: string;
  hint?: string;
  kind: 'text' | 'textarea' | 'tel' | 'email' | 'url';
  required?: boolean;
};

export type LaunchLocationModeOption = {
  id: LaunchLocationMode;
  label: string;
  hint: string;
};

export type LaunchFormConfig = {
  typeLabel: string;
  headline: string;
  subtitle: string;
  fields: LaunchFieldDef[];
  location: {
    headline: string;
    subtitle: string;
    modes: LaunchLocationModeOption[];
    recommended: LaunchLocationMode;
  };
};

export type PageStatus = 'draft' | 'active';

export type LaunchFormValues = Record<LaunchFieldKey, string> & {
  locationMode: LaunchLocationMode | null;
  categoryId: string;
  categoryName: string;
  homeBased: boolean;
  status: PageStatus;
  /** Creator certifies they are the official entity owner — sets claimed_by. */
  selfClaim: boolean;
};

export const EMPTY_LAUNCH_FORM: LaunchFormValues = {
  title: '',
  description: '',
  phone: '',
  email: '',
  website: '',
  instagram: '',
  locationMode: null,
  categoryId: '',
  categoryName: '',
  homeBased: false,
  status: 'active',
  selfClaim: false,
};

const LAUNCH_FORMS: Record<LaunchPageTypeSlug, LaunchFormConfig> = {
  'local-business': {
    typeLabel: 'Local Business',
    headline: 'Name your business',
    subtitle:
      'Use the name customers already know — the same as your storefront or Google listing.',
    fields: [
      {
        key: 'title',
        label: 'Business name',
        placeholder: 'e.g. Main Street Café',
        kind: 'text',
        required: true,
      },
      {
        key: 'description',
        label: 'What you offer',
        placeholder: 'Coffee, food, or services — what should someone know?',
        kind: 'textarea',
      },
      {
        key: 'phone',
        label: 'Phone',
        placeholder: '(612) 555-0100',
        kind: 'tel',
      },
      {
        key: 'website',
        label: 'Website',
        placeholder: 'yourcafe.com',
        kind: 'url',
      },
    ],
    location: {
      headline: 'Where is your business?',
      subtitle: 'Pin your address or pick the city you’re in.',
      recommended: 'building',
      modes: [
        {
          id: 'building',
          label: 'Pin my address',
          hint: 'Shop, restaurant, clinic — use the map pin.',
        },
        {
          id: 'city',
          label: 'I’m in a city',
          hint: 'No street address — base it in a city or town.',
        },
        {
          id: 'skip',
          label: 'Skip for now',
          hint: 'Add a location later in My pages.',
        },
      ],
    },
  },
  'public-figure': {
    typeLabel: 'Public Figure',
    headline: 'Your public name',
    subtitle: 'How you want to appear — real name, stage name, or band name.',
    fields: [
      {
        key: 'title',
        label: 'Name or public name',
        placeholder: 'e.g. Jordan Lee · The Northwoods',
        kind: 'text',
        required: true,
      },
      {
        key: 'description',
        label: 'Bio or tagline',
        placeholder: 'Role, genre, or what you’re known for.',
        kind: 'textarea',
      },
      {
        key: 'website',
        label: 'Website or link-in-bio',
        placeholder: 'yoursite.com',
        kind: 'url',
      },
      {
        key: 'instagram',
        label: 'Instagram',
        placeholder: '@yourhandle',
        kind: 'text',
      },
    ],
    location: {
      headline: 'Where are you based?',
      subtitle: 'Pick your city or pin a studio address.',
      recommended: 'city',
      modes: [
        {
          id: 'city',
          label: 'I’m in a city',
          hint: 'The city or town you’re most associated with.',
        },
        {
          id: 'building',
          label: 'Pin a studio',
          hint: 'Optional studio or office on the map.',
        },
        {
          id: 'skip',
          label: 'Skip for now',
          hint: 'Add a location later in My pages.',
        },
      ],
    },
  },
  community: {
    typeLabel: 'Community',
    headline: 'Name this place',
    subtitle: 'Park, church, club, lake — pick a name people can search for.',
    fields: [
      {
        key: 'title',
        label: 'Place or project name',
        placeholder: 'e.g. Midtown Farmers Market Friends',
        kind: 'text',
        required: true,
      },
      {
        key: 'description',
        label: 'What it is',
        placeholder: 'What you care about and how people can get involved.',
        kind: 'textarea',
      },
      {
        key: 'website',
        label: 'Website',
        placeholder: 'optional link',
        kind: 'url',
      },
      {
        key: 'email',
        label: 'Contact email',
        placeholder: 'hello@example.org',
        kind: 'email',
      },
    ],
    location: {
      headline: 'Where is it?',
      subtitle: 'Pin the place or pick a city.',
      recommended: 'building',
      modes: [
        {
          id: 'building',
          label: 'Pin the place',
          hint: 'Drop a pin on the map.',
        },
        {
          id: 'city',
          label: 'City or town',
          hint: 'City-wide — pick a home city.',
        },
        {
          id: 'skip',
          label: 'Skip for now',
          hint: 'Add a location later in My pages.',
        },
      ],
    },
  },
  event: {
    typeLabel: 'Event',
    headline: 'Name your event',
    subtitle: 'Festival, market, show, or gathering — match how it’s promoted.',
    fields: [
      {
        key: 'title',
        label: 'Event name',
        placeholder: 'e.g. Midtown Farmers Market',
        kind: 'text',
        required: true,
      },
      {
        key: 'description',
        label: 'What to expect',
        placeholder: 'When, where, and what people should know.',
        kind: 'textarea',
      },
      {
        key: 'website',
        label: 'Event link',
        placeholder: 'tickets or info page',
        kind: 'url',
      },
      {
        key: 'phone',
        label: 'Contact phone',
        placeholder: '(612) 555-0100',
        kind: 'tel',
      },
    ],
    location: {
      headline: 'Where is it happening?',
      subtitle: 'Pin the venue or name the city.',
      recommended: 'building',
      modes: [
        {
          id: 'building',
          label: 'Pin the venue',
          hint: 'Drop a pin on the map where it happens.',
        },
        {
          id: 'city',
          label: 'City or town',
          hint: 'City-wide or roaming — pick a home city.',
        },
        {
          id: 'skip',
          label: 'Skip for now',
          hint: 'Add a location later in My pages.',
        },
      ],
    },
  },
};

export function launchFormConfig(pageType: LaunchPageTypeSlug): LaunchFormConfig {
  return LAUNCH_FORMS[pageType];
}

export function launchDetailsComplete(
  pageType: LaunchPageTypeSlug,
  values: LaunchFormValues,
): boolean {
  const config = launchFormConfig(pageType);
  return config.fields
    .filter((f) => f.required)
    .every((f) => values[f.key].trim().length > 0);
}

export function launchLocationComplete(
  values: LaunchFormValues,
  hasMapPin: boolean,
): boolean {
  if (!values.locationMode) return false;
  if (values.locationMode === 'skip' || values.locationMode === 'city') return true;
  return hasMapPin;
}

export function launchTypeStepComplete(values: LaunchFormValues): boolean {
  return Boolean(values.categoryId.trim() && values.categoryName.trim());
}

/** Single create-form step: required fields + location mode satisfied. */
export function launchFormComplete(
  pageType: LaunchPageTypeSlug,
  values: LaunchFormValues,
  hasMapPin: boolean,
): boolean {
  return (
    launchDetailsComplete(pageType, values) &&
    launchLocationComplete(values, hasMapPin)
  );
}

/** Primary CTA — publish is always allowed; claim is opt-in via selfClaim. */
export function launchCtaLabel(values: LaunchFormValues): string {
  if (values.status === 'draft') {
    return values.selfClaim ? 'Save draft & claim' : 'Save draft';
  }
  return values.selfClaim ? 'Publish & claim' : 'Publish page';
}

export function launchCtaHint(values: LaunchFormValues): string {
  if (values.status === 'draft') {
    return values.selfClaim
      ? 'Saved privately and claimed as yours. Publish later from My pages.'
      : 'Saved privately — not visible on the directory yet.';
  }
  return values.selfClaim
    ? 'Visible on the directory and claimed as yours.'
    : 'Visible on the directory. You can claim ownership later.';
}
