import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { notFound, redirect } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import EditMentionForm from './EditMentionForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditMentionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClientWithAuth();

  // Auth gate — unauthenticated users cannot reach this page
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/');
  }

  // Single query: fetch pin + account (with user_id for ownership) + mention_type
  const { data: mention, error } = await supabase
    .from('map_pins')
    .select(`
      id, lat, lng, description, visibility, archived,
      image_url, video_url, media_type,
      full_address, view_count, created_at, updated_at, post_date,
      map_meta, account_id, tagged_account_ids,
      accounts:account_id (
        id, username, first_name, image_url, account_taggable, user_id, plan
      ),
      mention_type:mention_type_id (
        id, emoji, name
      )
    `)
    .eq('id', id)
    .eq('archived', false)
    .eq('is_active', true)
    .single();

  if (error || !mention) {
    notFound();
  }

  const mentionData = mention as any;

  // Ownership check — non-owners get 404
  const accountUserId = mentionData.accounts?.user_id ?? null;
  if (!accountUserId || user.id !== accountUserId) {
    notFound();
  }

  // Normalize mention_type (array → object if needed)
  if (Array.isArray(mentionData.mention_type)) {
    mentionData.mention_type = mentionData.mention_type[0] ?? null;
  }

  // Extract plan before stripping private fields
  const accountPlan: string | null = mentionData.accounts?.plan ?? null;

  // Strip user_id from accounts before passing to client
  if (mentionData.accounts) {
    delete mentionData.accounts.user_id;
  }

  // Fetch mention types (static/global, cacheable)
  const { data: mentionTypes } = await supabase
    .from('mention_types')
    .select('id, emoji, name')
    .eq('is_active', true)
    .order('name');

  // Fetch user's collections
  const { data: collections } = await supabase
    .from('collections')
    .select('id, emoji, title')
    .eq('account_id', mentionData.account_id)
    .order('title');

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full max-w-[600px] mx-auto py-3 px-2">
        <EditMentionForm
          mention={mentionData}
          mentionTypes={mentionTypes ?? []}
          collections={collections ?? []}
          accountPlan={accountPlan}
        />
      </div>
    </NewPageWrapper>
  );
}
