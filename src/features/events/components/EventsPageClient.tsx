'use client';

import { useState, useEffect } from 'react';
import { CalendarIcon, PlusIcon, MapPinIcon, ClockIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { EventService } from '../services/eventService';
import type { Event, UpdateEventData, EventTag } from '@/types/event';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import CreateEventModal from './CreateEventModal';

export default function EventsPageClient() {
  const { account, user } = useAuthStateSafe();
  const [events, setEvents] = useState<Event[]>([]);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMyEvents, setLoadingMyEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Edit state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateEventData>({});
  const [editingTags, setEditingTags] = useState<EventTag[]>([]);
  const [updating, setUpdating] = useState(false);
  
  // Delete state
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Predefined tags (same as create form)
  const predefinedTags: EventTag[] = [
    { emoji: '🎉', text: 'Celebration' },
    { emoji: '🎵', text: 'Music' },
    { emoji: '🍕', text: 'Food' },
    { emoji: '🏃', text: 'Sports' },
    { emoji: '🎨', text: 'Arts' },
    { emoji: '📚', text: 'Education' },
    { emoji: '🌳', text: 'Outdoor' },
    { emoji: '👨‍👩‍👧‍👦', text: 'Family' },
    { emoji: '💼', text: 'Business' },
    { emoji: '🏛️', text: 'Government' },
    { emoji: '🗺️', text: 'Explore' },
    { emoji: '📍', text: 'Mention' },
    { emoji: '🏪', text: 'Garage Sale' },
    { emoji: '🎪', text: 'Festival' },
    { emoji: '🍺', text: 'Social' },
  ];

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch user's events when account changes
  useEffect(() => {
    if (account) {
      fetchMyEvents();
      } else {
      setMyEvents([]);
    }
  }, [account]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get public events
      const publicEvents = await EventService.getEvents({ 
        visibility: 'public',
        archived: false 
      });

      // Combine and sort by start_date
      const allEvents = [...publicEvents].sort((a, b) => {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });

      setEvents(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyEvents = async () => {
    if (!account) return;
    
    setLoadingMyEvents(true);
    try {
      // Get all user's events (both public and private)
      const userPublicEvents = await EventService.getEvents({ 
        account_id: account.id,
        visibility: 'public',
        archived: false 
      });
      
      const userPrivateEvents = await EventService.getEvents({ 
        account_id: account.id,
        visibility: 'only_me',
        archived: false 
      });

      // Combine and sort by start_date
      const allMyEvents = [...userPublicEvents, ...userPrivateEvents].sort((a, b) => {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });

      setMyEvents(allMyEvents);
    } catch (err) {
      console.error('Failed to load user events:', err);
      setMyEvents([]);
    } finally {
      setLoadingMyEvents(false);
    }
  };

  const handleEventCreated = async () => {
    await fetchEvents();
    if (account) {
      await fetchMyEvents();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateRange = (start: string, end: string | null) => {
    try {
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : null;
      
      if (!endDate) {
        return formatDate(start);
      }

      // Check if it's an all-day event
      // All-day events have start at 00:00:00 and end at 23:59:XX on the same day
      const isSameDay = startDate.toDateString() === endDate.toDateString();
      const startHours = startDate.getHours();
      const startMinutes = startDate.getMinutes();
      const startSeconds = startDate.getSeconds();
      const endHours = endDate.getHours();
      const endMinutes = endDate.getMinutes();
      
      // Check if start is midnight (00:00:00) and end is 23:59 (any seconds)
      const isAllDay = isSameDay && 
        startHours === 0 && startMinutes === 0 && startSeconds === 0 &&
        endHours === 23 && endMinutes === 59;

      // Same day
      if (isSameDay) {
        if (isAllDay) {
          // Show "All Day" for all-day events
          return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - All Day`;
        }
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }

      // Different days
      return `${formatDate(start)} - ${end ? formatDate(end) : ''}`;
    } catch {
      return `${start}${end ? ` - ${end}` : ''}`;
    }
  };

  const isPastEvent = (startDate: string) => {
    return new Date(startDate) < new Date();
  };

  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const startEditing = (event: Event) => {
    setEditingEventId(event.id);
    setEditFormData({
      title: event.title,
      description: event.description || null,
      start_date: event.start_date,
      end_date: event.end_date || null,
      location_name: event.location_name || null,
      location_address: event.location_address || null,
      visibility: event.visibility,
    });
    setEditingTags(event.tags || []);
  };

  const cancelEditing = () => {
    setEditingEventId(null);
    setEditFormData({});
    setEditingTags([]);
  };

  const toggleEditTag = (tag: EventTag) => {
    const isSelected = editingTags.some(t => t.emoji === tag.emoji && t.text === tag.text);
    if (isSelected) {
      setEditingTags(editingTags.filter(t => !(t.emoji === tag.emoji && t.text === tag.text)));
    } else {
      setEditingTags([...editingTags, tag]);
    }
  };

  const handleUpdateEvent = async (eventId: string) => {
    if (!account) return;

    setUpdating(true);
    setError(null);

    try {
      if (!editFormData.title?.trim()) {
        throw new Error('Title is required');
      }

      await EventService.updateEvent(eventId, {
        ...editFormData,
        title: editFormData.title.trim(),
        description: editFormData.description?.trim() || null,
        tags: editingTags.length > 0 ? editingTags : undefined,
    });

      setEditingEventId(null);
      setEditFormData({});
      setEditingTags([]);
      await fetchMyEvents();
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!account) return;
    if (!confirm('Are you sure you want to delete this event?')) return;

    setDeletingEventId(eventId);
    setError(null);

    try {
      await EventService.deleteEvent(eventId);
      await fetchMyEvents();
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeletingEventId(null);
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content - Events Feed */}
          <div className="lg:col-span-8 space-y-4">
            {/* Header with Create Button */}
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">Events</h1>
        {user && account && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create Event
                </button>
            )}
          </div>

        {/* Loading State */}
        {loading && (
              <div className="bg-white border border-gray-200 rounded-md p-6">
                <p className="text-xs text-gray-600 text-center">Loading events...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
              <div className="bg-white border border-red-200 rounded-md p-4">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Events List */}
        {!loading && events.length > 0 && (
              <div className="space-y-4">
              {events.map((event) => {
                const isPast = isPastEvent(event.start_date);
                const accountData = event.accounts;
                
                return (
                  <div
                    key={event.id}
                      className={`bg-white border border-gray-200 rounded-md overflow-hidden hover:shadow-sm transition-shadow ${
                      isPast ? 'opacity-75' : ''
                    }`}
                  >
                      <div className="p-4 space-y-3">
                        {/* Event Header */}
                        <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">
                            {event.title}
                          </h3>
                          {event.description && (
                              <p className="text-xs text-gray-600 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        {event.visibility === 'only_me' && account && event.account_id === account.id && (
                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded flex-shrink-0">
                            Private
                          </span>
                        )}
                      </div>

                        {/* Event Details */}
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <ClockIcon className="w-4 h-4 flex-shrink-0" />
                          <span>{formatDateRange(event.start_date, event.end_date)}</span>
                        </div>

                        {(event.location_name || event.location_address) && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="line-clamp-1">
                              {event.location_name || event.location_address}
                            </span>
                          </div>
                        )}

                          {/* Tags */}
                          {event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {event.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded border border-gray-200"
                                >
                                  <span>{tag.emoji}</span>
                                  <span>{tag.text}</span>
                                </span>
                              ))}
                            </div>
                          )}

                        {accountData && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <ProfilePhoto 
                                account={{
                                  id: accountData.id,
                                  username: accountData.username,
                                  first_name: accountData.first_name,
                                  image_url: accountData.image_url,
                                } as any}
                                size="xs"
                              />
                            <span>
                              {accountData.username || accountData.first_name || 'User'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && events.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-md p-12">
                <div className="flex flex-col items-center justify-center space-y-3 text-center">
                  <CalendarIcon className="w-12 h-12 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">No events yet</p>
                    <p className="text-xs text-gray-600 mt-1">
                {user 
                  ? 'Create an event to get started.'
                  : 'Sign in to create events or view community events.'}
              </p>
            </div>
          </div>
              </div>
            )}
          </div>

          {/* Sidebar - My Events */}
          <div className="lg:col-span-4 space-y-4">
            {user && account ? (
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">My Events</h2>
                
                {loadingMyEvents ? (
                  <p className="text-xs text-gray-600">Loading...</p>
                ) : myEvents.length === 0 ? (
                  <p className="text-xs text-gray-600">You haven't created any events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {myEvents.map((event) => {
                      const isEditing = editingEventId === event.id;
                      const isDeleting = deletingEventId === event.id;
                      const isPast = isPastEvent(event.start_date);

                      return (
                        <div
                          key={event.id}
                          className={`border border-gray-200 rounded-md p-3 space-y-2 ${
                            isPast ? 'opacity-75' : ''
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editFormData.title || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none"
                                placeholder="Event title"
                                disabled={updating}
                              />
                              <textarea
                                value={editFormData.description || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none resize-none"
                                placeholder="Description"
                                rows={2}
                                disabled={updating}
                              />
                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="datetime-local"
                                  value={formatDateForInput(editFormData.start_date)}
                                  onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                  className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none"
                                  disabled={updating}
                                />
                                <input
                                  type="datetime-local"
                                  value={formatDateForInput(editFormData.end_date)}
                                  onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                  className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none"
                                  disabled={updating}
                                />
                              </div>
                              {/* Tags */}
                              <div>
                                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                  Tags
                                </label>
                                <div className="flex flex-wrap gap-1">
                                  {predefinedTags.map((tag, index) => {
                                    const isSelected = editingTags.some(t => t.emoji === tag.emoji && t.text === tag.text);
                                    return (
                                      <button
                                        key={index}
                                        type="button"
                                        onClick={() => toggleEditTag(tag)}
                                        disabled={updating}
                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                                          isSelected
                                            ? 'bg-gray-900 text-white border-gray-900'
                                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                        } disabled:opacity-50`}
                                      >
                                        <span>{tag.emoji}</span>
                                        <span>{tag.text}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex items-center justify-between p-1.5 border border-gray-200 rounded-md">
                                <span className="text-[10px] text-gray-700">Visibility</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditFormData({ ...editFormData, visibility: 'public' })}
                                    className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                                      editFormData.visibility === 'public'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                    disabled={updating}
                                  >
                                    Public
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditFormData({ ...editFormData, visibility: 'only_me' })}
                                    className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                                      editFormData.visibility === 'only_me'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                    disabled={updating}
                                  >
                                    Only Me
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateEvent(event.id)}
                                  disabled={updating || !editFormData.title?.trim()}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
                                >
                                  <CheckIcon className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  disabled={updating}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                                >
                                  <XMarkIcon className="w-3 h-3" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-semibold text-gray-900 line-clamp-2">
                                    {event.title}
                                  </h4>
                                  {event.description && (
                                    <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                {event.visibility === 'only_me' && (
                                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                    Private
                                  </span>
        )}
      </div>

                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                  <ClockIcon className="w-3 h-3" />
                                  <span>{formatDateRange(event.start_date, event.end_date)}</span>
                                </div>
                                {(event.location_name || event.location_address) && (
                                  <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                    <MapPinIcon className="w-3 h-3" />
                                    <span className="line-clamp-1">
                                      {event.location_name || event.location_address}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
                                <button
                                  onClick={() => startEditing(event)}
                                  disabled={isDeleting}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                                >
                                  <PencilIcon className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  disabled={isDeleting}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                                >
                                  {isDeleting ? (
                                    <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <TrashIcon className="w-3 h-3" />
                                  )}
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-900">About Events</h3>
          <div className="space-y-1.5 text-xs text-gray-600">
            <p>
              Share events with the Minnesota community or keep them private.
            </p>
            <p>
              Public events are visible to everyone. Private events are only visible to you.
            </p>
              <div className="pt-1.5 border-t border-gray-200">
                <p className="font-medium text-gray-900 mb-0.5">Sign In Required</p>
                <p className="text-gray-600">Sign in to create and manage your events.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={handleEventCreated}
      />
    </>
  );
}
