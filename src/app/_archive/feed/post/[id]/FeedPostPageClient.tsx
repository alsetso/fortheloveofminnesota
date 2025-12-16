'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { formatDistanceToNow } from 'date-fns';
import { EllipsisHorizontalIcon, PencilIcon, TrashIcon, ShareIcon, GlobeAltIcon, LockClosedIcon, MapPinIcon, XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import FeedPost, { FeedPostData } from '@/components/feed/FeedPost';
import PostDetailView from '@/components/feed/PostDetailView';
import LoginOverlayModal from '@/components/feed/LoginOverlayModal';
import EditPostModal from '@/components/feed/EditPostModal';
import { useAuth, AccountService, Account } from '@/features/auth';
import Views from '@/components/ui/Views';
import NavigationCard from '@/components/feed/NavigationCard';
import FeedStatsCard from '@/components/feed/FeedStatsCard';
import Footer from '@/features/ui/components/Footer';
import ProfilePhoto from '@/components/ProfilePhoto';
import PostMapRenderer from '@/components/feed/PostMapRenderer';

interface City {
  id: string;
  name: string;
  slug: string;
  population: string;
  county: string;
}

interface County {
  id: string;
  name: string;
  slug: string;
  population: string;
  area: string;
}

interface FeedPostPageClientProps {
  postId: string;
  initialPost?: FeedPostData;
  requiresAuth?: boolean;
  cities?: City[];
  counties?: County[];
}

export default function FeedPostPageClient({ 
  postId, 
  initialPost,
  requiresAuth = false,
  cities = [],
  counties = [],
}: FeedPostPageClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);

  // Load account data
  useEffect(() => {
    const loadAccount = async () => {
      if (!user) {
        setAccount(null);
        return;
      }
      try {
        const accountData = await AccountService.getCurrentAccount();
        setAccount(accountData);
      } catch (error) {
        console.error('Error loading account:', error);
        setAccount(null);
      }
    };
    loadAccount();
  }, [user]);

  const [post, setPost] = useState<FeedPostData | null>(initialPost || null);
  const [isLoading, setIsLoading] = useState(!initialPost);
  const [showLoginModal, setShowLoginModal] = useState(requiresAuth);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const authDropdownRef = useRef<HTMLDivElement>(null);

  // Check if current user owns this post
  const canEdit = user && post && account?.id === (post as { account_id?: string }).account_id;

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        setShowAuthDropdown(false);
      }
    };

    if (showDropdown || showAuthDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, showAuthDropdown]);

  const handleDelete = async () => {
    if (!post || !canEdit || isDeleting) return;
    
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/feed/${post.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      router.push('/');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
      setIsDeleting(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/feed/post/${postId}` : '';

  // Post toolbar data
  const postAccount = useMemo(() => post?.accounts, [post?.accounts]);
  const displayName = useMemo(() => {
    if (postAccount?.first_name || postAccount?.last_name) {
      return `${postAccount.first_name || ''} ${postAccount.last_name || ''}`.trim();
    }
    return 'User';
  }, [postAccount?.first_name, postAccount?.last_name]);

  const timeAgo = useMemo(() => {
    if (!post?.created_at) return 'recently';
    try {
      return formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'recently';
    }
  }, [post?.created_at]);

  // Location and map data
  const locationText = useMemo(() => {
    if (!post) return null;
    // If hidePin is true, only show city
    if (post.map_hide_pin) {
      return post.city || null;
    }
    // Otherwise show city, county, state as normal
    const parts: string[] = [];
    if (post.city) parts.push(post.city);
    if (post.county) parts.push(post.county);
    if (post.state) parts.push(post.state);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [post?.city, post?.county, post?.state, post?.map_hide_pin]);

  const hasMap = useMemo(() => !!(post?.map_geometry || post?.map_data || post?.map_screenshot), [post?.map_geometry, post?.map_data, post?.map_screenshot]);
  
  // Check if post has media
  const hasMedia = useMemo(() => {
    if (!post?.images) return false;
    const validMedia = post.images.filter(img => {
      const url = img?.url;
      return url && (url.startsWith('http://') || url.startsWith('https://')) && !url.startsWith('blob:');
    });
    return validMedia.length > 0;
  }, [post?.images]);
  
  // Show map in second column only when there is media
  const showMapInSecondColumn = hasMap && hasMedia;

  const mapData = useMemo(() => {
    if (!post || !hasMap) return null;
    return {
      type: (() => {
        if (post.map_data?.type) return post.map_data.type;
        if (post.map_type) return post.map_type;
        return 'pin' as const;
      })(),
      geometry: post.map_geometry || post.map_data?.geometry,
      center: post.map_data?.center || undefined,
      screenshot: post.map_screenshot || post.map_data?.screenshot,
      hidePin: post.map_hide_pin || post.map_data?.hidePin || false,
      polygon: post.map_data?.polygon,
    };
  }, [post, hasMap]);

  const mapType = useMemo(() => {
    if (!post) return null;
    if (post.map_data?.type) return post.map_data.type;
    if (post.map_type) return post.map_type;
    return null;
  }, [post?.map_data?.type, post?.map_type]);

  const handlePostUpdate = async () => {
    // Refresh the post data after update
    try {
      const response = await fetch(`/api/feed/${postId}`);
      if (response.ok) {
        const data = await response.json();
        setPost(data.post);
      }
    } catch (error) {
      console.error('Error refreshing post:', error);
    }
    router.refresh();
  };

  useEffect(() => {
    if (initialPost) {
      setPost(initialPost);
      setIsLoading(false);
      return;
    }

    if (requiresAuth) {
      setIsLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/feed/${postId}`);
        
        if (response.status === 401) {
          setShowLoginModal(true);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch post');
        }

        const data = await response.json();
        setPost(data.post);
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [postId, initialPost, requiresAuth]);

  useEffect(() => {
    // If user logs in, refresh the post
    if (user && showLoginModal) {
      setShowLoginModal(false);
      router.refresh();
    }
  }, [user, showLoginModal, router]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-xs text-gray-600">Loading post...</div>
        </div>
      </div>
    );
  }

  if (requiresAuth && !user) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-[10px] py-3 w-full">
            <div className="bg-white border border-gray-200 rounded-md p-[10px] text-center">
              <h1 className="text-sm font-semibold text-gray-900 mb-3">Members Only Post</h1>
              <p className="text-xs text-gray-600 mb-3">
                This post is only available to MNUDA members. Please sign in to view.
              </p>
              <Link
                href="/?modal=account&tab=settings"
                className="inline-block px-[10px] py-[10px] bg-gray-900 text-white font-medium rounded-md hover:bg-gray-700 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
        <LoginOverlayModal 
          isOpen={showLoginModal} 
          onClose={() => {
            setShowLoginModal(false);
            router.push('/');
          }}
          onLogin={() => router.refresh()}
        />
      </>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-sm font-semibold text-gray-900 mb-3">Post Not Found</h1>
          <p className="text-xs text-gray-600 mb-3">The post you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link
            href="/"
            className="inline-block px-[10px] py-[10px] bg-gray-900 text-white font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            Go to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Structured Data for SEO - removed, using simple posts only */}
      
      {/* Inline Page Design - Unique Format */}
      <div className="min-h-screen bg-gray-50">
        {/* Header Bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-[10px]">
            <div className="flex items-center justify-between h-12">
              {/* Left: Go to Feed */}
              <div className="flex items-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Go to Feed
                </Link>
              </div>

              {/* Center: Logo */}
              <div className="absolute left-1/2 transform -translate-x-1/2">
                <Link
                  href="/"
                  className="flex items-center transition-opacity hover:opacity-80"
                  aria-label="MNUDA Home"
                >
                  <Image
                    src="/logo.png"
                    alt="MNUDA Emblem"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                    priority
                  />
                </Link>
              </div>

              {/* Right: Auth/Options */}
              <div className="flex items-center gap-2">
                {/* Auth Dropdown - Sign In or Me */}
                <div className="relative" ref={authDropdownRef}>
                  {user && account ? (
                    <>
                      <button
                        onClick={() => setShowAuthDropdown(!showAuthDropdown)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                        aria-label="Account menu"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                          {account.image_url ? (
                            <Image
                              src={account.image_url}
                              alt={AccountService.getDisplayName(account) || 'User'}
                              width={24}
                              height={24}
                              className="w-full h-full object-cover"
                              unoptimized={account.image_url.includes('supabase.co')}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                              <span className="text-[10px] text-gray-600 font-medium">
                                {AccountService.getDisplayName(account)?.charAt(0).toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Auth Dropdown Menu */}
                      {showAuthDropdown && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                          <div className="py-1">
                            <Link
                              href={`/profile/${account.username || account.id}`}
                              onClick={() => setShowAuthDropdown(false)}
                              className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              View Profile
                            </Link>
                            <Link
                              href="/account/settings"
                              onClick={() => setShowAuthDropdown(false)}
                              className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Settings
                            </Link>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                              onClick={async () => {
                                try {
                                  await signOut();
                                  router.push('/');
                                } catch (error) {
                                  console.error('Sign out error:', error);
                                }
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-gray-50"
                            >
                              Sign Out
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href="/?modal=account&tab=settings"
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Sign In
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Post Toolbar - Below Nav */}
        {post && (
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-[10px]">
              <div className="flex items-center justify-between h-10">
                {/* Left: Profile, Timestamp, Visibility */}
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  {/* Profile Photo and Username */}
                  <Link href={postAccount?.username ? `/profile/${postAccount.username}` : '#'} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                    <ProfilePhoto
                      account={postAccount ? {
                        id: postAccount.id,
                        image_url: postAccount.image_url,
                        first_name: postAccount.first_name,
                        last_name: postAccount.last_name,
                      } : null}
                      size="xs"
                    />
                    <span className="font-medium text-gray-900 hover:underline">
                      {displayName}
                    </span>
                  </Link>
                  
                  <span aria-hidden="true">·</span>
                  
                  {/* Timestamp */}
                  <time dateTime={post.created_at} className="text-xs text-gray-500">
                    {timeAgo}
                  </time>
                </div>

                {/* Right: Views, Share, and Three Dots */}
                <div className="flex items-center gap-2">
                  {/* Page Views */}
                  {post.view_count !== undefined && post.view_count !== null && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <EyeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{(post.view_count || 0).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Share Button - Gold Compact */}
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="px-2 py-1 bg-[#D4AF37] text-white text-xs font-semibold rounded hover:bg-[#B8941F] transition-colors flex-shrink-0"
                    aria-label="Share post"
                  >
                    Share
                  </button>

                  {/* Three Dots Menu - Only for post owner */}
                  {canEdit && (
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                        aria-label="Post options"
                      >
                        <EllipsisHorizontalIcon className="w-4 h-4 text-gray-500" aria-hidden="true" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showDropdown && (
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setShowEditModal(true);
                                setShowDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <PencilIcon className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDelete();
                                setShowDropdown(false);
                              }}
                              disabled={isDeleting}
                              className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                            >
                              <TrashIcon className="w-4 h-4" />
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content - Two Column Layout */}
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* First Column - Wide: Post Content */}
            <div className="lg:col-span-8">
              <PostDetailView 
                post={post} 
                mapData={mapData}
                onMapClick={() => setShowMapModal(true)}
              />
            </div>

            {/* Second Column - Narrow: Explore Cards */}
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-20 space-y-3">
                {/* Location and Map Card - At Top - Show location text always, map only when there is media */}
                {(locationText || showMapInSecondColumn) && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    {/* Location Text */}
                    {locationText && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                        <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{locationText}</span>
                      </div>
                    )}
                    
                    {/* Map Preview - Clickable - Only show in second column when there is media */}
                    {showMapInSecondColumn && mapData && (
                      <>
                        <div 
                          className="w-full rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity mb-3"
                          onClick={() => setShowMapModal(true)}
                        >
                          <PostMapRenderer 
                            mapData={mapData}
                            height="200px"
                          />
                        </div>
                        
                        {/* Map Information Below Screenshot */}
                        {post && (
                          <div className="space-y-2 pt-3 border-t border-gray-200 text-xs">
                            {/* Full Address - Hidden if hidePin is true */}
                            {post.full_address && !post.map_hide_pin && (
                              <div>
                                <span className="font-medium text-gray-700">Address:</span>
                                <p className="text-gray-600 mt-0.5">{post.full_address}</p>
                              </div>
                            )}
                            
                            {/* Address Components - Only show city if hidePin is true, otherwise show all */}
                            {post.map_hide_pin ? (
                              post.city && (
                                <div>
                                  <span className="font-medium text-gray-700">City:</span>{' '}
                                  <span className="text-gray-600">{post.city}</span>
                                </div>
                              )
                            ) : (
                              (post.city || post.county || post.state || post.zip) && (
                                <div className="space-y-1">
                                  {post.city && (
                                    <div>
                                      <span className="font-medium text-gray-700">City:</span>{' '}
                                      <span className="text-gray-600">{post.city}</span>
                                    </div>
                                  )}
                                  {post.county && (
                                    <div>
                                      <span className="font-medium text-gray-700">County:</span>{' '}
                                      <span className="text-gray-600">{post.county}</span>
                                    </div>
                                  )}
                                  {post.state && (
                                    <div>
                                      <span className="font-medium text-gray-700">State:</span>{' '}
                                      <span className="text-gray-600">{post.state}</span>
                                    </div>
                                  )}
                                  {post.zip && (
                                    <div>
                                      <span className="font-medium text-gray-700">ZIP:</span>{' '}
                                      <span className="text-gray-600">{post.zip}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                            
                            {/* Coordinates - Hidden if hidePin is true */}
                            {post.map_data?.center && Array.isArray(post.map_data.center) && post.map_data.center.length === 2 && !post.map_hide_pin && (
                              <div>
                                <span className="font-medium text-gray-700">Coordinates:</span>{' '}
                                <span className="text-gray-600">
                                  {post.map_data.center[1].toFixed(6)}, {post.map_data.center[0].toFixed(6)}
                                </span>
                              </div>
                            )}
                            
                            {/* Map Type */}
                            {mapType && (
                              <div>
                                <span className="font-medium text-gray-700">Map Type:</span>{' '}
                                <span className="text-gray-600">
                                  {mapType === 'both' ? 'Pin + Area' : mapType === 'area' ? 'Area' : 'Pin'}
                                </span>
                              </div>
                            )}
                            
                            {/* Explore Links */}
                            {(post.city || post.county) && (
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                {post.city && (
                                  <Link
                                    href={`/explore/city/${post.city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                                  >
                                    Explore {post.city} →
                                  </Link>
                                )}
                                {post.county && (
                                  <Link
                                    href={`/explore/county/${post.county.toLowerCase().replace(/\s+county$/, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                                  >
                                    Explore {post.county.includes('County') ? post.county : `${post.county} County`} →
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <FeedStatsCard />
                
                {/* Post Metadata - Timestamp, Visibility, Page Views */}
                {post && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                      {/* Timestamp */}
                      <div className="flex items-center gap-1">
                        <time dateTime={post.created_at} className="text-gray-500">
                          {timeAgo}
                        </time>
                      </div>
                      
                      {/* Visibility */}
                      {post.visibility && (
                        <>
                          <span aria-hidden="true">·</span>
                          <div className="flex items-center gap-1">
                            {post.visibility === 'public' ? (
                              <GlobeAltIcon className="w-3 h-3 text-gray-400" aria-hidden="true" />
                            ) : (
                              <LockClosedIcon className="w-3 h-3 text-gray-400" aria-hidden="true" />
                            )}
                            <span className="text-gray-500 capitalize">{post.visibility}</span>
                          </div>
                        </>
                      )}
                      
                      {/* Page Views */}
                      {post.view_count !== undefined && post.view_count !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <div className="flex items-center gap-1">
                            <EyeIcon className="w-3 h-3 text-gray-400" aria-hidden="true" />
                            <span className="text-gray-500">{(post.view_count || 0).toLocaleString()} views</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <NavigationCard />
              </div>
            </div>
          </div>
        </div>

        {/* Edit Post Modal */}
        {post && (
          <EditPostModal
            isOpen={showEditModal}
            post={post}
            onClose={() => setShowEditModal(false)}
            onUpdate={handlePostUpdate}
          />
        )}

        {/* Share Modal */}
        {showShareModal && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setShowShareModal(false)}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
              <div
                className="bg-white rounded-md shadow-xl max-w-sm w-full pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/logo.png"
                        alt="MNUDA Emblem"
                        width={20}
                        height={20}
                        className="h-5 w-5"
                      />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Share Post
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowShareModal(false)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      aria-label="Close"
                    >
                      <XMarkIcon className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Share URL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-gray-700"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl);
                            alert('Link copied to clipboard!');
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Share this link to let others view this post.
                    </p>
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowShareModal(false)}
                      className="px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Full Screen Map Modal */}
        {showMapModal && hasMap && mapData && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-4xl w-full max-h-[90vh] flex flex-col bg-white rounded-lg overflow-hidden shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  {locationText && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-900">
                      <MapPinIcon className="w-4 h-4" />
                      <span>{locationText}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowMapModal(false)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Close map"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Map Container - Fits Content */}
              <div className="relative bg-gray-100" style={{ aspectRatio: '16/9' }}>
                <PostMapRenderer 
                  mapData={mapData}
                  height="100%"
                />
              </div>

              {/* Location Details Footer */}
              {post && (
                <div className="bg-gray-50 border-t border-gray-200 p-4 text-gray-700 text-xs space-y-2 max-h-[200px] overflow-y-auto">
                  {/* Full Address - Hidden if hidePin is true */}
                  {post.full_address && !post.map_hide_pin && (
                    <div>
                      <span className="font-medium">Address:</span>
                      <p className="mt-0.5 opacity-90">{post.full_address}</p>
                    </div>
                  )}
                  
                  {/* Address Components - Only show city if hidePin is true, otherwise show all */}
                  {post.map_hide_pin ? (
                    post.city && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <div><span className="font-medium">City:</span> {post.city}</div>
                      </div>
                    )
                  ) : (
                    (post.city || post.county || post.state || post.zip) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {post.city && <div><span className="font-medium">City:</span> {post.city}</div>}
                        {post.county && <div><span className="font-medium">County:</span> {post.county}</div>}
                        {post.state && <div><span className="font-medium">State:</span> {post.state}</div>}
                        {post.zip && <div><span className="font-medium">ZIP:</span> {post.zip}</div>}
                      </div>
                    )
                  )}
                  
                  {/* Coordinates - Hidden if hidePin is true */}
                  {post.map_data?.center && Array.isArray(post.map_data.center) && post.map_data.center.length === 2 && !post.map_hide_pin && (
                    <div>
                      <span className="font-medium">Coordinates:</span>{' '}
                      {post.map_data.center[1].toFixed(6)}, {post.map_data.center[0].toFixed(6)}
                    </div>
                  )}
                  
                  {/* Map Type */}
                  {mapType && (
                    <div>
                      <span className="font-medium">Map Type:</span>{' '}
                      {mapType === 'both' ? 'Pin + Area' : mapType === 'area' ? 'Area' : 'Pin'}
                    </div>
                  )}
                  
                  {/* Explore Links */}
                  {(post.city || post.county) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                      {post.city && (
                        <Link
                          href={`/explore/city/${post.city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                        >
                          Explore {post.city} →
                        </Link>
                      )}
                      {post.county && (
                        <Link
                          href={`/explore/county/${post.county.toLowerCase().replace(/\s+county$/, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                        >
                          Explore {post.county.includes('County') ? post.county : `${post.county} County`} →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Large Footer */}
        <Footer variant="light" />
      </div>
    </>
  );
}


