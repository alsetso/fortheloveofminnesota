'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { 
  DocumentTextIcon,
  LockClosedIcon,
  GlobeAltIcon,
  UserGroupIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

/**
 * Create Page Form - Simple form to create a new page
 */
export default function CreatePageForm() {
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public' | 'shared'>('private');
  const [icon, setIcon] = useState('');
  const [shortcutColor, setShortcutColor] = useState('');
  const [isShortcut, setIsShortcut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibilityOptions = [
    { value: 'private' as const, label: 'Private', icon: LockClosedIcon, description: 'Only you can see this page' },
    { value: 'public' as const, label: 'Public', icon: GlobeAltIcon, description: 'Anyone can view this page' },
    { value: 'shared' as const, label: 'Shared', icon: UserGroupIcon, description: 'People with permission can view' },
  ];

  const colorOptions = [
    { value: 'bg-blue-500', label: 'Blue', color: 'bg-blue-500' },
    { value: 'bg-purple-500', label: 'Purple', color: 'bg-purple-500' },
    { value: 'bg-green-500', label: 'Green', color: 'bg-green-500' },
    { value: 'bg-orange-500', label: 'Orange', color: 'bg-orange-500' },
    { value: 'bg-cyan-500', label: 'Cyan', color: 'bg-cyan-500' },
    { value: 'bg-pink-500', label: 'Pink', color: 'bg-pink-500' },
    { value: 'bg-red-500', label: 'Red', color: 'bg-red-500' },
    { value: 'bg-yellow-500', label: 'Yellow', color: 'bg-yellow-500' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !account) {
      setError('Please sign in to create pages');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          icon: icon.trim() || null,
          shortcut_color: isShortcut ? (shortcutColor || null) : null,
          is_shortcut: isShortcut,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to create page');
      }

      const data = await response.json();
      
      // Redirect to the new page
      const pageUrl = data.slug ? `/page/${data.slug}` : `/page/${data.id}`;
      router.push(pageUrl);
    } catch (err: any) {
      console.error('Error creating page:', err);
      setError(err.message || 'Failed to create page');
      setIsSubmitting(false);
    }
  };

  if (!user || !account) {
    return (
      <div className="max-w-[600px] mx-auto w-full px-4 py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-sm text-white/60 mb-4">
            Please sign in to create pages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Create New Page</h1>
        <p className="text-sm text-white/60">
          Create a new page to share knowledge and organize information
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-white mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter page title..."
            className="w-full px-3 py-2 bg-surface border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-lake-blue"
            required
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of your page..."
            rows={3}
            className="w-full px-3 py-2 bg-surface border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-lake-blue resize-none"
            maxLength={500}
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Visibility
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visibilityOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                  className={`p-3 rounded-md border-2 transition-colors text-left ${
                    visibility === option.value
                      ? 'border-lake-blue bg-lake-blue/10'
                      : 'border-white/10 bg-surface hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-sm font-medium text-white">{option.label}</span>
                  </div>
                  <p className="text-xs text-white/60">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcut Settings */}
        <div className="p-4 bg-surface-accent rounded-md border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <input
              id="isShortcut"
              type="checkbox"
              checked={isShortcut}
              onChange={(e) => setIsShortcut(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-surface text-lake-blue focus:ring-lake-blue"
            />
            <label htmlFor="isShortcut" className="text-sm font-medium text-white flex items-center gap-2">
              <SparklesIcon className="w-4 h-4" />
              Add to shortcuts
            </label>
          </div>

          {isShortcut && (
            <div className="space-y-4 pl-6 border-l-2 border-white/10">
              {/* Icon */}
              <div>
                <label htmlFor="icon" className="block text-sm font-medium text-white mb-2">
                  Icon (emoji)
                </label>
                <input
                  id="icon"
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🏙️"
                  maxLength={2}
                  className="w-full px-3 py-2 bg-surface border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-lake-blue text-center text-2xl"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setShortcutColor(color.value)}
                      className={`h-10 rounded-md border-2 transition-all ${
                        shortcutColor === color.value
                          ? 'border-white scale-110'
                          : 'border-white/20 hover:border-white/40'
                      } ${color.color}`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? 'Creating...' : 'Create Page'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-surface-accent text-white/70 rounded-md hover:bg-surface-accent/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
