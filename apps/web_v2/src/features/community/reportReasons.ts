/** Why a post isn’t good for the community — kept simple for the report card. */
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'not_relevant',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_OPTIONS: { id: ReportReason; label: string; hint: string }[] = [
  {
    id: 'spam',
    label: 'Spam',
    hint: 'Repetitive, promotional, or misleading posts',
  },
  {
    id: 'harassment',
    label: 'Harassment or hate',
    hint: 'Attacks, bullying, or hateful language',
  },
  {
    id: 'inappropriate',
    label: 'Inappropriate content',
    hint: 'Sexual, violent, or otherwise not suitable',
  },
  {
    id: 'not_relevant',
    label: 'Not good for the community',
    hint: 'Off-topic or doesn’t belong on the map',
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Something else — tell us briefly',
  },
];
