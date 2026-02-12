'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  QuestionMarkCircleIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  MapPinIcon,
  PhotoIcon,
  BookmarkIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface DocItem {
  id: string;
  title: string;
  icon: typeof QuestionMarkCircleIcon;
}

/**
 * Left Sidebar for Documentation page
 * Navigation for 10 documentation articles
 */
export default function DocsLeftSidebar() {
  const searchParams = useSearchParams();
  const selectedDoc = searchParams.get('doc') || 'getting-started';

  const docs: DocItem[] = [
    { id: 'getting-started', title: 'Getting Started', icon: InformationCircleIcon },
    { id: 'create-account', title: 'How to Create an Account?', icon: UserPlusIcon },
    { id: 'email-verification', title: 'Why Email Verification?', icon: ShieldCheckIcon },
    { id: 'create-pin', title: 'How to Create a Pin?', icon: MapPinIcon },
    { id: 'upload-photos', title: 'Uploading Photos', icon: PhotoIcon },
    { id: 'save-content', title: 'Saving Content', icon: BookmarkIcon },
    { id: 'friends-following', title: 'Friends & Following', icon: UserGroupIcon },
    { id: 'privacy-settings', title: 'Privacy Settings', icon: LockClosedIcon },
    { id: 'account-settings', title: 'Account Settings', icon: Cog6ToothIcon },
    { id: 'faq', title: 'Frequently Asked Questions', icon: QuestionMarkCircleIcon },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Documentation</h2>
        <p className="text-xs text-foreground-subtle mt-1">Help & Guides</p>
      </div>

      {/* Navigation */}
      <div className="p-3 space-y-1">
        {docs.map((doc) => {
          const Icon = doc.icon;
          return (
            <Link
              key={doc.id}
              href={`/docs?doc=${doc.id}`}
              className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                selectedDoc === doc.id
                  ? 'bg-surface-accent text-foreground'
                  : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-left">{doc.title}</span>
            </Link>
          );
        })}
      </div>

      {/* Help Link */}
      <div className="mt-auto px-3 pt-3 border-t border-border">
        <div className="bg-surface-accent rounded-md p-3">
          <div className="text-xs text-foreground-subtle mb-1">Need more help?</div>
          <button className="text-xs text-lake-blue hover:text-lake-blue-light underline">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
