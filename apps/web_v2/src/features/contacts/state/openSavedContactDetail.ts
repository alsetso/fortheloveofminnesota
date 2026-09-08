import type { ConfirmSaveResult } from '@/features/contacts/ui/ContactConfirmSave';

/**
 * After Confirm → Save, open the durable contact record (clean landing).
 */
export function openSavedContactDetail(
  openSubpage: (opts: {
    title: string;
    subtitle?: string;
    kind: string;
    slug?: string;
    query?: string;
  }) => void,
  result: ConfirmSaveResult,
) {
  openSubpage({
    title: result.name,
    subtitle: 'Contact',
    kind: 'contact-detail',
    slug: `${result.kind}:${result.id}`,
  });
}
