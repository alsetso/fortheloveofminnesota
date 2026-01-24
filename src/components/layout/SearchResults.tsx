'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EyeIcon, UserGroupIcon, DocumentTextIcon, RssIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { supabase } from '@/lib/supabase';
import type { Mention } from '@/types/mention';
import type { Post } from '@/types/post';
import type { Group } from '@/types/group';
import ProfilePhoto from '../shared/ProfilePhoto';
import { Account } from '@/features/auth';

type ContentType = 'posts' | 'mentions' | 'groups' | 'users' | 'news';

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  snippet: string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
  published_at: string;
  published_date: string;
  authors: string[];
  source_name: string | null;
  source_logo_url: string | null;
  related_topics: string[];
  created_at: string;
}

interface SearchResultsData {
  posts: Post[];
  mentions: Mention[];
  groups: Group[];
  users: any[]; // TODO: Add User type
  news: NewsArticle[];
}

export default function SearchResults() {
  const searchParams = useSearchParams();
  const contentType = searchParams.get('content_type');
  const [results, setResults] = useState<SearchResultsData>({
    posts: [],
    mentions: [],
    groups: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get content type filters from URL
        const contentTypeParam = searchParams.get('content_type');
        const contentTypesParam = searchParams.get('content_types');
        let selectedTypes: ContentType[] = [];

        if (contentTypesParam) {
          const types = contentTypesParam.split(',').map(s => s.trim()) as ContentType[];
          selectedTypes = types.filter(t => ['posts', 'mentions', 'groups', 'users', 'news'].includes(t));
        } else if (contentTypeParam) {
          if (['posts', 'mentions', 'groups', 'users', 'news'].includes(contentTypeParam)) {
            selectedTypes = [contentTypeParam as ContentType];
          }
        } else {
          // Default to all types if none selected
          selectedTypes = ['posts', 'mentions', 'groups', 'users', 'news'];
        }

        const newResults: SearchResultsData = {
          posts: [],
          mentions: [],
          groups: [],
          users: [],
          news: [],
        };

        // Fetch Posts
        if (selectedTypes.includes('posts')) {
          try {
            const response = await fetch('/api/posts?limit=20', { credentials: 'include' });
            if (response.ok) {
              const data = await response.json();
              newResults.posts = data.posts || [];
            }
          } catch (err) {
            console.error('Error fetching posts:', err);
          }
        }

        // Fetch Mentions
        if (selectedTypes.includes('mentions')) {
          try {
            // Get mention type filters from URL (legacy support)
            const typeParam = searchParams.get('type');
            const typesParam = searchParams.get('types');
            let mentionTypeIds: string[] | undefined;

            if (typesParam) {
              const slugs = typesParam.split(',').map(s => s.trim());
              const { data: allTypes } = await supabase
                .from('mention_types')
                .select('id, name')
                .eq('is_active', true);
              
              if (allTypes) {
                const matchingIds = slugs
                  .map(slug => {
                    const matchingType = allTypes.find(type => {
                      const typeSlug = mentionTypeNameToSlug(type.name);
                      return typeSlug === slug;
                    });
                    return matchingType?.id;
                  })
                  .filter(Boolean) as string[];
                
                if (matchingIds.length > 0) {
                  mentionTypeIds = matchingIds;
                }
              }
            } else if (typeParam) {
              const { data: allTypes } = await supabase
                .from('mention_types')
                .select('id, name')
                .eq('is_active', true);
              
              if (allTypes) {
                const matchingType = allTypes.find(type => {
                  const typeSlug = mentionTypeNameToSlug(type.name);
                  return typeSlug === typeParam;
                });
                
                if (matchingType) {
                  mentionTypeIds = [matchingType.id];
                }
              }
            }

            const filters: any = {
              timeFilter: 'all',
              visibility: 'public', // Only show public mentions in search results
            };

            if (mentionTypeIds && mentionTypeIds.length > 0) {
              filters.mention_type_ids = mentionTypeIds;
            }

            const mentionResults = await MentionService.getMentions(filters);
            newResults.mentions = mentionResults;
          } catch (err) {
            console.error('Error fetching mentions:', err);
          }
        }

        // Fetch Groups
        if (selectedTypes.includes('groups')) {
          try {
            const response = await fetch('/api/groups?limit=20', { credentials: 'include' });
            if (response.ok) {
              const data = await response.json();
              newResults.groups = data.groups || [];
            }
          } catch (err) {
            console.error('Error fetching groups:', err);
          }
        }

        // Fetch Users (accounts with usernames)
        if (selectedTypes.includes('users')) {
          try {
            const { data: accounts, error: accountsError } = await supabase
              .from('accounts')
              .select(`
                id,
                username,
                first_name,
                last_name,
                image_url,
                bio,
                created_at
              `)
              .not('username', 'is', null)
              .order('created_at', { ascending: false })
              .limit(20);
            
            if (!accountsError && accounts) {
              newResults.users = accounts;
            }
          } catch (err) {
            console.error('Error fetching users:', err);
          }
        }

        // Fetch News
        if (selectedTypes.includes('news')) {
          try {
            const response = await fetch('/api/news?limit=20', { credentials: 'include' });
            if (response.ok) {
              const data = await response.json();
              newResults.news = data.articles || [];
            }
          } catch (err) {
            console.error('Error fetching news:', err);
          }
        }

        setResults(newResults);
      } catch (err) {
        console.error('Error fetching search results:', err);
        setError('Failed to load search results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [searchParams]);

  const totalResults = results.posts.length + results.mentions.length + results.groups.length + results.users.length + results.news.length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center scrollbar-hide">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading search results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center scrollbar-hide">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (totalResults === 0) {
    return (
      <div className="h-full flex items-center justify-center scrollbar-hide">
        <div className="text-center">
          <p className="text-sm text-gray-500">No results found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Search Results ({totalResults})
          </h2>
        </div>
        
        <div className="space-y-8">
          {/* Posts Section */}
          {results.posts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <DocumentTextIcon className="w-5 h-5 text-gray-600" />
                <h3 className="text-md font-semibold text-gray-900">Posts ({results.posts.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-2">
                      {post.title && (
                        <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
                          {post.title}
                        </h4>
                      )}
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        {post.account && (
                          <div className="flex items-center gap-2">
                            <ProfilePhoto 
                              account={post.account as unknown as Account} 
                              size="xs" 
                              editable={false} 
                            />
                            <span>@{post.account.username}</span>
                          </div>
                        )}
                        <span>
                          {new Date(post.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      {(post as any).group && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 pt-1">
                          <UserGroupIcon className="w-3 h-3" />
                          <span>{(post as any).group.name}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Mentions Section */}
          {results.mentions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <EyeIcon className="w-5 h-5 text-gray-600" />
                <h3 className="text-md font-semibold text-gray-900">Mentions ({results.mentions.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.mentions.map((mention) => (
                  <Link
                    key={mention.id}
                    href={`/mention/${mention.id}`}
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {mention.image_url && (
                      <div className="relative w-full h-48 rounded-md overflow-hidden bg-gray-200 mb-3">
                        <img
                          src={mention.image_url}
                          alt="Mention"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      {mention.mention_type && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{mention.mention_type.emoji}</span>
                          <span className="text-xs font-medium text-gray-600">
                            {mention.mention_type.name}
                          </span>
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-900 line-clamp-3">
                        {mention.description || 'No description'}
                      </p>
                      
                      {contentType === 'mentions' ? (
                        // Enhanced details when mentions filter is selected
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <EyeIcon className="w-3 h-3" />
                              <span>{mention.view_count || 0} views</span>
                            </div>
                            <span>
                              {new Date(mention.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          
                          {mention.account && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                              <ProfilePhoto 
                                account={mention.account as unknown as Account} 
                                size="xs" 
                                editable={false} 
                              />
                              <div className="flex-1">
                                <span className="text-xs font-medium text-gray-900">
                                  @{mention.account.username}
                                </span>
                                {((mention.account as any).first_name || (mention.account as any).last_name) && (
                                  <p className="text-xs text-gray-500">
                                    {[(mention.account as any).first_name, (mention.account as any).last_name].filter(Boolean).join(' ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {mention.lat && mention.lng && (
                            <div className="text-xs text-gray-500 pt-1">
                              📍 {mention.lat.toFixed(4)}, {mention.lng.toFixed(4)}
                            </div>
                          )}
                        </div>
                      ) : (
                        // Compact details when other filters are selected
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <EyeIcon className="w-3 h-3" />
                            <span>{mention.view_count || 0} views</span>
                          </div>
                          <span>
                            {new Date(mention.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                      
                      {contentType !== 'mentions' && mention.account && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                          <ProfilePhoto 
                            account={mention.account as unknown as Account} 
                            size="xs" 
                            editable={false} 
                          />
                          <span className="text-xs text-gray-600">
                            @{mention.account.username}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Groups Section */}
          {results.groups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <UserGroupIcon className="w-5 h-5 text-gray-600" />
                <h3 className="text-md font-semibold text-gray-900">Groups ({results.groups.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/group/${group.slug}`}
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {group.image_url ? (
                          <img
                            src={group.image_url}
                            alt={group.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                            <UserGroupIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {group.name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {group.member_count || 0} members
                          </p>
                        </div>
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <span className={`px-2 py-1 rounded-full ${
                          group.visibility === 'public' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {group.visibility}
                        </span>
                        <span>
                          {new Date(group.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Users Section */}
          {results.users.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <UserGroupIcon className="w-5 h-5 text-gray-600" />
                <h3 className="text-md font-semibold text-gray-900">Users ({results.users.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.users.map((user: any) => (
                  <Link
                    key={user.id}
                    href={`/@${user.username}`}
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <ProfilePhoto 
                          account={user as unknown as Account} 
                          size="sm" 
                          editable={false} 
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            @{user.username}
                          </h4>
                          {(user.first_name || user.last_name) && (
                            <p className="text-xs text-gray-600">
                              {[user.first_name, user.last_name].filter(Boolean).join(' ')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {contentType === 'users' && user.bio && (
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {user.bio}
                        </p>
                      )}
                      
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                        Joined {new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* News Section */}
          {results.news.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <RssIcon className="w-5 h-5 text-gray-600" />
                <h3 className="text-md font-semibold text-gray-900">News ({results.news.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.news.map((article) => (
                  <a
                    key={article.id}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-3">
                      {article.photo_url || article.thumbnail_url ? (
                        <div className="relative w-full h-48 rounded-md overflow-hidden bg-gray-200">
                          <img
                            src={article.photo_url || article.thumbnail_url || ''}
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                          {article.title}
                        </h4>
                        {article.snippet && (
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {article.snippet}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          {article.source_logo_url && (
                            <img
                              src={article.source_logo_url}
                              alt={article.source_name || 'Source'}
                              className="w-4 h-4 object-contain"
                            />
                          )}
                          <span className="line-clamp-1">
                            {article.source_name || 'News'}
                          </span>
                        </div>
                        <span>
                          {new Date(article.published_at || article.published_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
