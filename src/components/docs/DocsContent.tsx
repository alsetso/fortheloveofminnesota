'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  InformationCircleIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  MapPinIcon,
  PhotoIcon,
  BookmarkIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface DocContent {
  id: string;
  title: string;
  icon: typeof InformationCircleIcon;
  content: React.ReactNode;
}

/**
 * Documentation Content - Displays selected documentation article
 */
export default function DocsContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('doc') || 'getting-started';

  const docs: Record<string, DocContent> = {
    'getting-started': {
      id: 'getting-started',
      title: 'Getting Started',
      icon: InformationCircleIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Welcome to Love of Minnesota! This guide will help you get started with the platform.
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Quick Start</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>Create an account to get started</li>
              <li>Verify your email address</li>
              <li>Explore the map and discover Minnesota locations</li>
              <li>Create your first pin or post</li>
              <li>Connect with other Minnesota lovers</li>
            </ol>
          </div>
        </div>
      ),
    },
    'create-account': {
      id: 'create-account',
      title: 'How to Create an Account?',
      icon: UserPlusIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Creating an account on Love of Minnesota is quick and easy. Follow these steps:
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Steps to Create an Account</h3>
            <ol className="list-decimal list-inside space-y-3 text-sm text-foreground-muted ml-2">
              <li>
                <strong className="text-foreground">Click "Sign Up"</strong> on the homepage or navigation bar
              </li>
              <li>
                <strong className="text-foreground">Enter your email address</strong> - This will be used for account verification and login
              </li>
              <li>
                <strong className="text-foreground">Choose a username</strong> - This will be your unique identifier on the platform
              </li>
              <li>
                <strong className="text-foreground">Create a password</strong> - Use a strong password with at least 8 characters
              </li>
              <li>
                <strong className="text-foreground">Verify your email</strong> - Check your inbox for a verification link
              </li>
              <li>
                <strong className="text-foreground">Complete your profile</strong> - Add a profile photo and bio to personalize your account
              </li>
            </ol>
          </div>
          <div className="bg-surface-accent rounded-md p-3 border border-border">
            <p className="text-xs text-foreground-subtle">
              <strong className="text-foreground">Tip:</strong> You can also sign up using your Google or Apple account for faster registration.
            </p>
          </div>
        </div>
      ),
    },
    'email-verification': {
      id: 'email-verification',
      title: 'Why Email Verification?',
      icon: ShieldCheckIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Email verification is an important security and community feature on Love of Minnesota. Here's why we require it:
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Security Benefits</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li><strong className="text-foreground">Account Protection:</strong> Verifies that you own the email address associated with your account</li>
              <li><strong className="text-foreground">Password Recovery:</strong> Allows you to reset your password if you forget it</li>
              <li><strong className="text-foreground">Prevents Spam:</strong> Reduces fake accounts and spam on the platform</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">Community Benefits</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li><strong className="text-foreground">Authentic Users:</strong> Ensures real people are contributing to the community</li>
              <li><strong className="text-foreground">Better Connections:</strong> Helps you connect with genuine Minnesota lovers</li>
              <li><strong className="text-foreground">Trust & Safety:</strong> Creates a safer environment for sharing personal stories and locations</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">How It Works</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>After signing up, you'll receive an email with a verification link</li>
              <li>Click the link in the email to verify your account</li>
              <li>If you don't see the email, check your spam folder</li>
              <li>You can request a new verification email from your account settings</li>
            </ol>
          </div>
          <div className="bg-surface-accent rounded-md p-3 border border-border">
            <p className="text-xs text-foreground-subtle">
              <strong className="text-foreground">Note:</strong> Some features may be limited until your email is verified. Verification typically takes just a few minutes.
            </p>
          </div>
        </div>
      ),
    },
    'create-pin': {
      id: 'create-pin',
      title: 'How to Create a Pin?',
      icon: MapPinIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Pins are location markers on the map that help you share and discover Minnesota places. Here's how to create one:
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Creating a Pin</h3>
            <ol className="list-decimal list-inside space-y-3 text-sm text-foreground-muted ml-2">
              <li><strong className="text-foreground">Navigate to the map</strong> - Go to the Maps page or Live map view</li>
              <li><strong className="text-foreground">Click "Add Pin"</strong> or use the map controls</li>
              <li><strong className="text-foreground">Select location</strong> - Click on the map where you want to place the pin</li>
              <li><strong className="text-foreground">Add details:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-foreground-muted">
                  <li>Title or name of the location</li>
                  <li>Description or story about the place</li>
                  <li>Photos (optional but recommended)</li>
                  <li>Tags or categories</li>
                </ul>
              </li>
              <li><strong className="text-foreground">Set visibility</strong> - Choose public, friends only, or private</li>
              <li><strong className="text-foreground">Save your pin</strong> - Click "Create Pin" to add it to the map</li>
            </ol>
          </div>
        </div>
      ),
    },
    'upload-photos': {
      id: 'upload-photos',
      title: 'Uploading Photos',
      icon: PhotoIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Photos help bring your Minnesota memories to life. Learn how to upload and manage photos on the platform.
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Supported Formats</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground-muted ml-2">
              <li>JPEG/JPG</li>
              <li>PNG</li>
              <li>WebP</li>
              <li>Maximum file size: 10MB per photo</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">How to Upload</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>When creating a pin, post, or memory, click the photo icon</li>
              <li>Select photos from your device or take a new photo</li>
              <li>Add captions or descriptions (optional)</li>
              <li>Photos are automatically optimized for web viewing</li>
            </ol>

            <h3 className="text-base font-semibold text-foreground mt-4">Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground-muted ml-2">
              <li>Use high-quality photos for better results</li>
              <li>Add captions to provide context</li>
              <li>Respect privacy - don't upload photos of people without permission</li>
            </ul>
          </div>
        </div>
      ),
    },
    'save-content': {
      id: 'save-content',
      title: 'Saving Content',
      icon: BookmarkIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Save pins, posts, and other content from the community to access later. Here's how:
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">How to Save</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>Find content you want to save (pin, post, mention, etc.)</li>
              <li>Click the bookmark/save icon on the content</li>
              <li>The content is added to your Saved collection</li>
              <li>Access saved items from the Saved page in navigation</li>
            </ol>

            <h3 className="text-base font-semibold text-foreground mt-4">Organizing Saved Items</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li><strong className="text-foreground">Collections:</strong> Create collections to organize saved items by topic</li>
              <li><strong className="text-foreground">Filter by type:</strong> View pins, posts, mentions, or photos separately</li>
              <li><strong className="text-foreground">Search:</strong> Use the search bar to find specific saved items</li>
            </ul>
          </div>
        </div>
      ),
    },
    'friends-following': {
      id: 'friends-following',
      title: 'Friends & Following',
      icon: UserGroupIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Connect with other Minnesota lovers by following them. When you both follow each other, you become friends!
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Following vs Friends</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li><strong className="text-foreground">Following:</strong> You follow them, but they don't follow you back</li>
              <li><strong className="text-foreground">Followers:</strong> They follow you, but you don't follow them back</li>
              <li><strong className="text-foreground">Friends:</strong> You both follow each other (mutual follows)</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">How to Follow</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>Visit a user's profile</li>
              <li>Click the "Follow" button</li>
              <li>You'll see their content in your feed</li>
              <li>If they follow you back, you become friends!</li>
            </ol>

            <h3 className="text-base font-semibold text-foreground mt-4">Managing Connections</h3>
            <p className="text-sm text-foreground-muted">
              Visit the Friends page to see all your connections, filter by relationship type, and manage who you follow.
            </p>
          </div>
        </div>
      ),
    },
    'privacy-settings': {
      id: 'privacy-settings',
      title: 'Privacy Settings',
      icon: LockClosedIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Control who can see your content and how your information is shared on Love of Minnesota.
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Privacy Options</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li><strong className="text-foreground">Public:</strong> Everyone can see your content</li>
              <li><strong className="text-foreground">Friends Only:</strong> Only your friends can see your content</li>
              <li><strong className="text-foreground">Private:</strong> Only you can see your content</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">What You Can Control</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>Profile visibility</li>
              <li>Who can follow you</li>
              <li>Who can see your pins and posts</li>
              <li>Who can see your memories</li>
              <li>Location sharing preferences</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">Accessing Privacy Settings</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground-muted ml-2">
              <li>Go to Settings</li>
              <li>Click on "Privacy"</li>
              <li>Adjust your privacy preferences</li>
              <li>Changes are saved automatically</li>
            </ol>
          </div>
        </div>
      ),
    },
    'account-settings': {
      id: 'account-settings',
      title: 'Account Settings',
      icon: Cog6ToothIcon,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Manage your account preferences, profile information, and account security.
          </p>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Profile Settings</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground-muted ml-2">
              <li>Update your username</li>
              <li>Change your profile photo</li>
              <li>Edit your bio</li>
              <li>Update your location</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">Account Security</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground-muted ml-2">
              <li>Change your password</li>
              <li>Update your email address</li>
              <li>Enable two-factor authentication</li>
              <li>View active sessions</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">Notifications</h3>
            <p className="text-sm text-foreground-muted">
              Control what notifications you receive via email or in-app. Customize alerts for likes, comments, follows, and more.
            </p>
          </div>
        </div>
      ),
    },
    'faq': {
      id: 'faq',
      title: 'Frequently Asked Questions',
      icon: QuestionMarkCircleIcon,
      content: (
        <div className="space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">How do I delete my account?</h3>
              <p className="text-sm text-foreground-muted">
                Go to Settings → Account → Delete Account. This action is permanent and cannot be undone.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">Can I change my username?</h3>
              <p className="text-sm text-foreground-muted">
                Yes, you can change your username in Settings → Profile. Usernames must be unique and can only be changed once every 30 days.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">How do I report inappropriate content?</h3>
              <p className="text-sm text-foreground-muted">
                Click the "..." menu on any content and select "Report". Our team reviews all reports promptly.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">Is Love of Minnesota free to use?</h3>
              <p className="text-sm text-foreground-muted">
                Yes! Love of Minnesota is free to use. We offer optional premium features for enhanced functionality.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">How do I contact support?</h3>
              <p className="text-sm text-foreground-muted">
                You can contact support through the Contact page or email support@fortheloveofminnesota.com. We typically respond within 24-48 hours.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  };

  const currentDoc = docs[docId] || docs['getting-started'];
  const Icon = currentDoc.icon;

  return (
    <div className="max-w-[800px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="w-6 h-6 text-foreground-subtle" />
          <h1 className="text-2xl font-bold text-foreground">{currentDoc.title}</h1>
        </div>
        <p className="text-sm text-foreground-subtle">
          Documentation and help guides for Love of Minnesota
        </p>
      </div>

      {/* Content */}
      <div className="bg-surface border border-border rounded-md p-6">
        {currentDoc.content}
      </div>

      {/* Navigation */}
      <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
        <button className="text-sm text-foreground-muted hover:text-foreground transition-colors">
          ← Previous
        </button>
        <button className="text-sm text-foreground-muted hover:text-foreground transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}
