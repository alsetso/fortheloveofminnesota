-- Legal policies: version control + platform variation + account acceptance binding
-- See docs/legal/LEGAL_POLICIES.md

-- ---------------------------------------------------------------------------
-- Policies (stable identity)
-- ---------------------------------------------------------------------------
create table if not exists public.legal_policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  public_path text not null,
  public_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_policies_slug_format check (slug ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.legal_policies is
  'Stable legal document identity (terms_of_service, privacy_policy, …).';

-- ---------------------------------------------------------------------------
-- Versions (immutable publishes, scoped by platform)
-- platform = 'all' is the shared default; 'ios2' | 'web' | … override when needed.
-- ---------------------------------------------------------------------------
create table if not exists public.legal_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.legal_policies (id) on delete cascade,
  platform text not null default 'all',
  version_label text not null,
  version_seq integer not null,
  status text not null default 'draft',
  effective_at timestamptz not null,
  published_at timestamptz,
  retired_at timestamptz,
  title text not null,
  summary text not null default '',
  content_md text not null,
  created_at timestamptz not null default now(),
  constraint legal_policy_versions_platform_format check (platform ~ '^[a-z][a-z0-9_]*$'),
  constraint legal_policy_versions_status_check check (status in ('draft', 'published', 'superseded')),
  constraint legal_policy_versions_label_unique unique (policy_id, platform, version_label),
  constraint legal_policy_versions_seq_unique unique (policy_id, platform, version_seq),
  constraint legal_policy_versions_published_ts check (
    status <> 'published' or published_at is not null
  )
);

create index if not exists legal_policy_versions_current_idx
  on public.legal_policy_versions (policy_id, platform, status, version_seq desc);

comment on table public.legal_policy_versions is
  'Immutable policy versions. Never update content_md after published; supersede instead.';
comment on column public.legal_policy_versions.platform is
  'all = shared default; ios2/web/… = platform-specific variation.';

-- ---------------------------------------------------------------------------
-- Changelog bullets per version
-- ---------------------------------------------------------------------------
create table if not exists public.legal_policy_changes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.legal_policy_versions (id) on delete cascade,
  sort_order integer not null default 0,
  change_kind text not null,
  section text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint legal_policy_changes_kind_check check (
    change_kind in ('added', 'updated', 'removed', 'clarified')
  )
);

create index if not exists legal_policy_changes_version_idx
  on public.legal_policy_changes (version_id, sort_order);

-- ---------------------------------------------------------------------------
-- Account acceptance history (exact version IDs at accept time)
-- ---------------------------------------------------------------------------
create table if not exists public.account_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  policy_id uuid not null references public.legal_policies (id),
  policy_version_id uuid not null references public.legal_policy_versions (id),
  accepted_at timestamptz not null default now(),
  acceptance_method text not null,
  source text not null default 'ios2',
  created_at timestamptz not null default now(),
  constraint account_policy_acceptances_method_check check (
    acceptance_method in ('signup', 'reconsent', 'notice')
  ),
  constraint account_policy_acceptances_source_format check (source ~ '^[a-z][a-z0-9_]*$'),
  constraint account_policy_acceptances_unique unique (account_id, policy_version_id)
);

create index if not exists account_policy_acceptances_account_idx
  on public.account_policy_acceptances (account_id, accepted_at desc);

comment on table public.account_policy_acceptances is
  'What each account agreed to, and when. Bind signup to the exact published version IDs.';

-- ---------------------------------------------------------------------------
-- Fast pointers on accounts (signup / last reconsent)
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists terms_version_id uuid references public.legal_policy_versions (id),
  add column if not exists privacy_version_id uuid references public.legal_policy_versions (id),
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Resolve current published version for a platform (platform → fallback all)
-- ---------------------------------------------------------------------------
create or replace function public.legal_current_version(
  p_slug text,
  p_platform text default 'all'
)
returns setof public.legal_policy_versions
language plpgsql
stable
as $$
declare
  v_policy_id uuid;
  r public.legal_policy_versions;
begin
  select id into v_policy_id from public.legal_policies where slug = p_slug;
  if v_policy_id is null then
    return;
  end if;

  select * into r
  from public.legal_policy_versions
  where policy_id = v_policy_id
    and platform = coalesce(nullif(p_platform, ''), 'all')
    and status = 'published'
  order by version_seq desc
  limit 1;

  if found then
    return next r;
    return;
  end if;

  if coalesce(nullif(p_platform, ''), 'all') <> 'all' then
    select * into r
    from public.legal_policy_versions
    where policy_id = v_policy_id
      and platform = 'all'
      and status = 'published'
    order by version_seq desc
    limit 1;

    if found then
      return next r;
    end if;
  end if;

  return;
end;
$$;

grant execute on function public.legal_current_version(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Accept current Terms + Privacy for an account (signup / reconsent)
-- ---------------------------------------------------------------------------
create or replace function public.accept_current_legal_policies(
  p_account_id uuid,
  p_platform text default 'ios2',
  p_method text default 'signup'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms public.legal_policy_versions;
  v_privacy public.legal_policy_versions;
  v_now timestamptz := now();
  v_source text := coalesce(nullif(p_platform, ''), 'ios2');
  v_method text := coalesce(nullif(p_method, ''), 'signup');
begin
  if v_method not in ('signup', 'reconsent', 'notice') then
    raise exception 'invalid acceptance_method: %', v_method;
  end if;

  if not exists (select 1 from public.accounts a where a.id = p_account_id) then
    raise exception 'account not found';
  end if;

  select * into v_terms from public.legal_current_version('terms_of_service', v_source) limit 1;
  select * into v_privacy from public.legal_current_version('privacy_policy', v_source) limit 1;

  if v_terms.id is null or v_privacy.id is null then
    raise exception 'published legal policies missing for platform %', v_source;
  end if;

  insert into public.account_policy_acceptances (
    account_id, policy_id, policy_version_id, accepted_at, acceptance_method, source
  ) values
    (p_account_id, v_terms.policy_id, v_terms.id, v_now, v_method, v_source),
    (p_account_id, v_privacy.policy_id, v_privacy.id, v_now, v_method, v_source)
  on conflict (account_id, policy_version_id) do nothing;

  -- signup/notice: bind once (preserve original acceptance timestamps)
  -- reconsent: advance pointers to the newly accepted current versions
  if v_method = 'reconsent' then
    update public.accounts
    set
      terms_version_id = v_terms.id,
      privacy_version_id = v_privacy.id,
      terms_accepted_at = v_now,
      privacy_accepted_at = v_now,
      updated_at = v_now
    where id = p_account_id;
  else
    update public.accounts
    set
      terms_version_id = coalesce(terms_version_id, v_terms.id),
      privacy_version_id = coalesce(privacy_version_id, v_privacy.id),
      terms_accepted_at = coalesce(terms_accepted_at, v_now),
      privacy_accepted_at = coalesce(privacy_accepted_at, v_now),
      updated_at = v_now
    where id = p_account_id;
  end if;

  return jsonb_build_object(
    'account_id', p_account_id,
    'platform', v_source,
    'method', v_method,
    'accepted_at', v_now,
    'terms_version_id', v_terms.id,
    'privacy_version_id', v_privacy.id,
    'terms_version_label', v_terms.version_label,
    'privacy_version_label', v_privacy.version_label,
    'terms_platform', v_terms.platform,
    'privacy_platform', v_privacy.platform
  );
end;
$$;

revoke all on function public.accept_current_legal_policies(uuid, text, text) from public;
grant execute on function public.accept_current_legal_policies(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: public read of published policies; acceptances only own account
-- ---------------------------------------------------------------------------
alter table public.legal_policies enable row level security;
alter table public.legal_policy_versions enable row level security;
alter table public.legal_policy_changes enable row level security;
alter table public.account_policy_acceptances enable row level security;

drop policy if exists legal_policies_read on public.legal_policies;
create policy legal_policies_read on public.legal_policies
  for select to anon, authenticated using (true);

drop policy if exists legal_policy_versions_read_published on public.legal_policy_versions;
create policy legal_policy_versions_read_published on public.legal_policy_versions
  for select to anon, authenticated using (status = 'published' or status = 'superseded');

drop policy if exists legal_policy_changes_read on public.legal_policy_changes;
create policy legal_policy_changes_read on public.legal_policy_changes
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.legal_policy_versions v
      where v.id = version_id and v.status in ('published', 'superseded')
    )
  );

drop policy if exists account_policy_acceptances_own_read on public.account_policy_acceptances;
create policy account_policy_acceptances_own_read on public.account_policy_acceptances
  for select to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );

-- Table privileges (Supabase does not auto-grant on newly created tables)
grant select on public.legal_policies to anon, authenticated, service_role;
grant select on public.legal_policy_versions to anon, authenticated, service_role;
grant select on public.legal_policy_changes to anon, authenticated, service_role;
grant select on public.account_policy_acceptances to authenticated, service_role;
grant insert, update, delete on public.legal_policies to service_role;
grant insert, update, delete on public.legal_policy_versions to service_role;
grant insert, update, delete on public.legal_policy_changes to service_role;
grant insert, update, delete on public.account_policy_acceptances to service_role;

-- ---------------------------------------------------------------------------
-- Seed: policy identities + v2026.04.17 platform=all
-- Content authored in docs/legal/policies/**; mirrored here for runtime binding.
-- ---------------------------------------------------------------------------
insert into public.legal_policies (slug, title, public_path, public_url)
values
  (
    'terms_of_service',
    'Terms of Service',
    '/tos',
    'https://fortheloveofminnesota.com/tos'
  ),
  (
    'privacy_policy',
    'Privacy Policy',
    '/privacy',
    'https://fortheloveofminnesota.com/privacy'
  )
on conflict (slug) do update set
  title = excluded.title,
  public_path = excluded.public_path,
  public_url = excluded.public_url,
  updated_at = now();

-- Terms v2026.04.17 (all)
insert into public.legal_policy_versions (
  policy_id, platform, version_label, version_seq, status,
  effective_at, published_at, title, summary, content_md
)
select
  p.id,
  'all',
  '2026.04.17',
  1,
  'published',
  '2026-04-17T00:00:00Z',
  '2026-04-17T00:00:00Z',
  'Terms of Service',
  'Initial public Terms of Service as published on fortheloveofminnesota.com/tos.',
  $terms_md$
# Terms of Service

**Effective:** April 17, 2026

## 1. Introduction & Acceptance

Welcome to For the Love of Minnesota (“Platform,” “Service,” “we,” “us,” or “our”). We operate an interactive, community-driven platform at fortheloveofminnesota.com focused on Minnesota maps, local discovery, community content, and civic information.

These Terms of Service (“Terms”) govern your access to and use of the Platform. By creating an account, using any feature, or simply browsing the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.

If you do not agree, you must discontinue use of the Platform immediately. You must be at least 13 years old to use this Service. If you are under 18, you represent that a parent or legal guardian has reviewed and agreed to these Terms on your behalf.

## 2. Accounts & Registration

**Guest Accounts.** You may browse limited areas of the Platform without registering. Guest sessions are stored locally in your browser and are not synced to our servers. Guest-saved content (such as map bookmarks) is tied to your device and may be lost if you clear your browser data.

**Authenticated Accounts.** Full access requires creating an account verified via a one-time passcode (OTP) sent to your email address. You agree to provide accurate, current information and to keep it up to date.

**Account Roles.** Accounts are assigned a role of General (standard access) or Admin (platform moderation and data management). Admin access is granted solely at our discretion.

**Account Security.** You are responsible for all activity that occurs under your account. You agree to notify us immediately at loveofminnesota@gmail.com if you suspect unauthorized access. We are not liable for losses resulting from your failure to safeguard your credentials. One account per person; creating duplicate accounts to circumvent restrictions is prohibited.

## 3. Subscription Plans & Billing

**Plans.** We offer multiple subscription tiers. The free Hobby plan provides basic access. Paid plans — including Contributor, Professional, and Executive — unlock additional features such as unlimited custom maps, visitor analytics, visitor identity insights, video uploads, extended text, civic edits, and higher map-member limits. Feature availability by plan is described on our Pricing page.

**Billing.** All payments are processed securely through Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis (monthly or annually, as selected). Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date.

**Cancellation & Refunds.** You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period; you retain access through that date. Refunds are evaluated case-by-case and are not guaranteed except where required by applicable law.

**Price Changes.** We reserve the right to modify pricing with at least 30 days’ notice. Continued use of the Service after a price change takes effect constitutes acceptance of the new pricing.

## 4. User-Generated Content

**Content Types.** The Platform allows you to create and share pins, custom maps, posts, mentions, pages, stories, memories, and collections (collectively, “Your Content”).

**Ownership.** You retain all ownership rights in Your Content. We do not claim ownership of anything you create on the Platform.

**License Grant.** By posting or publishing Your Content, you grant For the Love of Minnesota a non-exclusive, worldwide, royalty-free, sublicensable license to use, display, reproduce, distribute, and promote Your Content in connection with operating and improving the Platform. This license remains in effect for content that has been shared publicly or embedded elsewhere, even after you delete it.

**Your Representations.** You represent and warrant that (a) you have all rights necessary to share Your Content; (b) Your Content does not infringe the intellectual property, privacy, or other rights of any third party; and (c) Your Content complies with these Terms and all applicable laws.

**Visibility.** Content may be set to Public, Only Me, or Archived. Public content is visible to all visitors. Unauthenticated visitors may see a limited preview of public content. You control visibility settings and can update them at any time.

## 5. Acceptable Use

You agree to use the Platform lawfully and in a manner consistent with its purpose as a community resource celebrating Minnesota.

You may not:

- Post content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or discriminatory on the basis of race, ethnicity, religion, gender, disability, or other protected characteristic.
- Impersonate any person, organization, or government entity.
- Upload content that infringes copyrights, trademarks, or other intellectual property rights.
- Introduce malware, viruses, or any code designed to disrupt or damage the Platform.
- Use automated tools (bots, scrapers, crawlers) to access or collect data without our prior written consent.
- Attempt to bypass authentication, circumvent plan restrictions, or access data you are not authorized to view.
- Harvest or collect other users’ personal information without their consent.
- Submit false, misleading, or fabricated civic or government data through community-edit features.
- Use the Platform to send unsolicited commercial messages or spam.

We reserve the right to remove any content and suspend or terminate any account that violates these standards, at our sole discretion, without prior notice.

## 6. Location & Map Data

**User-Initiated Location Only.** We do not collect your device location silently. Location access is requested only when you explicitly initiate a location-dependent action (such as finding nearby places or placing a pin). You may deny this permission at any time through your device or browser settings.

**Pin Coordinates.** When you place a pin or create a map element, the geographic coordinates of that content are stored and associated with your account. Public pins are visible to all visitors.

**Mapbox.** Map tiles, geocoding (address search), and static map imagery are powered by Mapbox. By using map features, you also agree to Mapbox’s Terms of Service. Map data is © Mapbox and © OpenStreetMap contributors.

## 7. Civic & Government Data

The Platform displays publicly available Minnesota government data — including elected officials, government buildings, budget and payroll records, contracts, legislative districts, school districts, and county boundaries — sourced from official state and local government databases and APIs.

**No Accuracy Guarantee.** We make no representation or warranty as to the accuracy, completeness, or timeliness of civic data. Government records may be outdated, incomplete, or contain errors. Users should verify important information through official government sources before relying on it.

**Community Edits.** Authenticated users may submit edits to the government directory. Submitted edits are user-contributed and reviewed before publication. By submitting a community edit, you represent that the information is accurate to the best of your knowledge.

**News Content.** News articles aggregated on the Platform are sourced from third-party publishers. We do not author, verify, or endorse third-party news content. All rights to news articles remain with their respective publishers.

## 8. AI-Powered Features

Certain features of the Platform — including page chat, content suggestions, and leadership data extraction — are powered by OpenAI language models. Use of these features is also subject to OpenAI’s Terms of Use.

**No Professional Advice.** AI-generated content on this Platform is provided for informational and community purposes only. It does not constitute legal, financial, medical, civic, or any other form of professional advice. You should not rely solely on AI outputs for decisions in any of these areas.

**Accuracy.** AI-generated responses may be incomplete, outdated, or incorrect. We make no warranty as to the accuracy or reliability of any AI output and accept no liability for decisions made based on such output.

## 9. Marketing, Diamond Partnerships & Advertising

**Diamond Partnership Program.** The Platform offers a Diamond partnership designation for qualifying businesses and organizations. Diamond partners receive enhanced visibility and promotional tools. Eligibility, obligations, and program terms are set forth in a separate Diamond Partnership Agreement, which governs in the event of any conflict with these Terms.

**Ad Center.** Eligible accounts may access Platform advertising tools through the Ad Center, including promoted content placements and credit-based advertising. Advertising is subject to our Ad Center Policies, which are incorporated into these Terms by reference.

**Promoted Content.** Promoted or sponsored content displayed on the Platform will be labeled as such. We are not responsible for the accuracy or legality of advertiser content.

**Marketplace.** Where buy/sell marketplace features are available, transactions are between users. We are not a party to marketplace transactions and accept no liability for disputes between buyers and sellers.

## 10. Third-Party Services

The Platform integrates with the following third-party services. Your use of these services is subject to their respective terms and privacy policies.

- Stripe — Payment processing and subscription management
- Mapbox — Interactive maps, geocoding, and static map imagery
- Supabase — Database infrastructure and authentication
- OpenAI — AI-powered features and content generation
- Google Analytics — Aggregated usage analytics
- Meta (Facebook) Pixel — Advertising attribution and reach measurement
- Resend — Transactional and notification email delivery

We are not responsible for the practices, availability, or content of third-party services. Outages or changes to third-party services may affect Platform functionality without constituting a breach of these Terms.

## 11. Privacy & Data Collection

Our collection, use, and protection of your personal information is described in detail in our Privacy Policy, which is incorporated into these Terms by reference.

By using the Platform, you consent to the data practices described in the Privacy Policy, including:

- First-party analytics tracking page views, pin views, map views, and session identifiers.
- Profile data including email address, username, biography, and optionally phone number and location.
- Geographic coordinates associated with user-placed pins and map content.
- Third-party analytics and advertising attribution via Google Analytics and Meta Pixel.

## 12. Intellectual Property

**Platform IP.** The Platform — including its design, interface, source code, logo, trademarks, and all original content we create — is owned by For the Love of Minnesota and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, reverse-engineer, or create derivative works from any part of the Platform without our express written permission.

**Your Content.** As described in Section 4, you retain ownership of Your Content. The license you grant us survives termination for content that was shared publicly or incorporated into distributed features (e.g., embedded maps).

**Feedback.** Any suggestions, ideas, or feedback you provide regarding the Platform may be used by us without restriction, obligation, or compensation to you.

**DMCA.** If you believe your copyrighted work has been posted on the Platform without authorization, please contact us at loveofminnesota@gmail.com with a DMCA takedown notice.

## 13. Disclaimers & Limitation of Liability

**As-Is Service.** THE PLATFORM IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES.

**Content Accuracy.** We do not verify the accuracy of user-generated content, civic data, news articles, or AI-generated output. You use all content on the Platform at your own risk.

**Limitation of Liability.** TO THE FULLEST EXTENT PERMITTED BY MINNESOTA LAW, FOR THE LOVE OF MINNESOTA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM. OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM OR (B) ONE HUNDRED DOLLARS ($100.00).

Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so the above limitations may not apply to you in full.

## 14. Account Termination

**By You.** You may delete your account at any time through your account Settings page. Upon deletion, your profile and private content will be removed from public view. Some data may be retained for a limited period as required by law or for legitimate operational purposes (e.g., fraud prevention, billing records).

**By Us.** We reserve the right to suspend or permanently terminate your account, with or without notice, if we determine you have violated these Terms, engaged in fraudulent activity, or if continued access poses a risk to the Platform or other users.

**Effect of Termination.** Upon termination: (a) your right to access the Platform ceases immediately; (b) paid subscription access ends at the conclusion of the current billing period (for voluntary cancellations); and (c) sections of these Terms that by their nature should survive — including Sections 4 (license grant), 12 (IP), 13 (liability), and 15 (governing law) — remain in full force.

## 15. Governing Law & Dispute Resolution

These Terms are governed by and construed in accordance with the laws of the State of Minnesota, United States, without regard to its conflict-of-law provisions.

Any dispute, claim, or controversy arising out of or relating to these Terms or the Platform shall be resolved exclusively in the state or federal courts located in Hennepin County, Minnesota. You consent to personal jurisdiction and venue in those courts and waive any objection to such jurisdiction.

Before initiating formal legal proceedings, we encourage you to contact us at loveofminnesota@gmail.com to attempt informal resolution.

## 16. Changes to These Terms

We may revise these Terms at any time. When we make material changes, we will update the effective date at the top of this page and, where appropriate, provide additional notice (such as a notification within the Platform or an email to your registered address).

Your continued use of the Platform after revised Terms take effect constitutes your acceptance of the updated Terms. If you do not agree to the revised Terms, you must stop using the Platform.

## 17. Contact

If you have questions, concerns, or requests regarding these Terms, please contact us:

For the Love of Minnesota  
Website: fortheloveofminnesota.com  
Email: loveofminnesota@gmail.com

By using For the Love of Minnesota, you acknowledge that you have read and agree to these Terms of Service, effective April 17, 2026.
$terms_md$
from public.legal_policies p
where p.slug = 'terms_of_service'
on conflict (policy_id, platform, version_label) do nothing;

-- Privacy v2026.04.17 (all)
insert into public.legal_policy_versions (
  policy_id, platform, version_label, version_seq, status,
  effective_at, published_at, title, summary, content_md
)
select
  p.id,
  'all',
  '2026.04.17',
  1,
  'published',
  '2026-04-17T00:00:00Z',
  '2026-04-17T00:00:00Z',
  'Privacy Policy',
  'Initial public Privacy Policy as published on fortheloveofminnesota.com/privacy.',
  $privacy_md$
# Privacy Policy

**Effective:** April 17, 2026

## 1. Introduction & Scope

For the Love of Minnesota (“we,” “us,” or “our”) operates the community platform at fortheloveofminnesota.com — an interactive service for Minnesota maps, local discovery, civic information, and community content.

This Privacy Policy explains what personal information we collect, how we use it, who we share it with, and the choices you have. It applies to our website, web application, and any related services we provide (collectively, the “Platform”).

By accessing or using the Platform, you agree to the practices described in this policy. If you do not agree, please discontinue use. This Policy should be read alongside our Terms of Service, which govern your use of the Platform overall.

## 2. Information We Collect

**Account & Profile Information.** When you create an authenticated account, we collect your email address (required for OTP verification) and any profile information you choose to provide — including username, display name, biography, profile photo, city or location, and phone number.

**Content You Create.** We store all content you publish on the Platform, including pins, custom maps, posts, mentions, pages, stories, memories, and collections, along with any associated text, images, and videos.

**Location Data.** When you place a pin, create a map element, or use a location-based feature, we store the geographic coordinates associated with that content. Device location is accessed only when you explicitly initiate a location-based action — never silently in the background.

**Usage & Analytics Data.** We automatically collect information about how you interact with the Platform, including pages visited, pins and maps viewed, session identifiers, and a persistent device identifier stored in your browser’s local storage (`lom_device_id`). Admin accounts are excluded from analytics collection.

**Device & Technical Information.** We may collect your IP address, browser type and version, operating system, referring URL, and user-agent string to operate and secure the Platform.

**Payment Information.** Billing is handled entirely by Stripe. We do not store your full card number or sensitive payment details. We receive and retain a Stripe customer ID, subscription status, and plan information.

**Guest Account Data.** If you use the Platform as a guest, limited data (such as map bookmarks) is stored in your browser’s local storage only. This data is not transmitted to our servers and is lost if you clear your browser data.

## 3. How We Collect Information

We collect information through three primary channels:

**Directly From You.** When you register, update your profile, create content, submit community edits, contact support, or complete a subscription purchase.

**Automatically.** As you use the Platform, we collect usage data through our first-party analytics system and through cookies and similar tracking technologies operated by Google Analytics and Meta Pixel (described further in Section 6).

**From Third Parties.** We receive limited information from Stripe (subscription and billing status) and from Mapbox (geocoding responses when you use location search). We do not purchase or receive personal data from data brokers.

## 4. How We Use Your Information

We use the information we collect to:

- Provide, maintain, and improve the Platform and its features.
- Authenticate your identity and secure your account via OTP verification.
- Process subscription payments and manage your billing relationship through Stripe.
- Personalize your experience, such as surfacing local content relevant to your location.
- Send transactional communications — account verification, billing receipts, and security alerts — via Resend.
- Measure and analyze Platform usage to understand how features are used and where to improve.
- Detect, investigate, and prevent fraudulent activity, abuse, and security incidents.
- Comply with applicable legal obligations.
- Operate AI-powered features (page chat, content suggestions) through OpenAI.

We do not sell your personal information to third parties, and we do not use your data to serve targeted advertising outside of the limited attribution tracking described in Section 6.

## 5. How We Share Your Information

**Public Content.** Content you publish with a “Public” visibility setting is accessible to all visitors, including unauthenticated users. Unauthenticated visitors see a limited preview of public content.

**Service Providers.** We share information with trusted third-party vendors who help us operate the Platform. Each provider receives only the data necessary for their specific function and are prohibited from using it for other purposes. See Section 7 for the full list.

**Admin Access.** Platform administrators may access account and content data for moderation and operational purposes. Admin access is limited in scope and subject to confidentiality obligations.

**Legal Requirements.** We may disclose your information if required by law, subpoena, court order, or other legal process, or when we believe disclosure is necessary to protect the rights, property, or safety of For the Love of Minnesota, our users, or the public.

**Business Transfers.** If For the Love of Minnesota is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email or a prominent notice on the Platform before your data is transferred and becomes subject to a different privacy policy.

**With Your Consent.** We may share your information in other ways when you have given us explicit permission to do so.

## 6. Cookies & Tracking Technologies

**First-Party Analytics.** We use a custom analytics system to track page views, pin views, and map views. A device identifier (`lom_device_id`) is stored in your browser’s local storage to correlate sessions across visits. No cross-site tracking occurs through this system.

**Google Analytics (GA4).** We use Google Analytics 4 to understand aggregate usage patterns. Google may set cookies and collect data subject to Google’s Privacy Policy. You can opt out using the Google Analytics Opt-out Browser Add-on.

**Meta (Facebook) Pixel.** We use the Meta Pixel to measure the effectiveness of advertising and to understand how visitors reach our Platform. Meta may collect data subject to Meta’s Privacy Policy. You can manage your ad preferences through Meta’s Ad Preferences.

**Essential Cookies.** We use session cookies required for authentication and core Platform functionality. These cannot be disabled without impairing your ability to use the Platform.

## 7. Third-Party Service Providers

The following providers process data on our behalf. Each is bound by data processing agreements and their own privacy commitments.

- Stripe — Payment processing; stores billing and subscription data
- Supabase — Database infrastructure, authentication, and row-level security
- Mapbox — Map rendering, geocoding, and location search
- OpenAI — AI-powered features; processes content you submit to AI tools
- Resend — Transactional email delivery (verification, billing, alerts)
- Google Analytics — Aggregated usage analytics
- Meta Pixel — Advertising attribution and reach measurement

We do not sell data to these providers beyond what is necessary for the services they render.

## 8. Data Retention

We retain your personal information for as long as your account is active or as needed to provide the Platform. Specifically:

- Account data is retained until you delete your account, after which it is removed or anonymized within 30 days, except where retention is required by law.
- Public content (pins, maps, posts) you delete is removed from public view immediately; copies in backups are purged on a rolling schedule.
- Billing records are retained for up to 7 years as required by tax and financial regulations.
- Analytics data is retained in aggregate or anonymized form indefinitely for Platform improvement.
- Guest data stored in browser local storage is never transmitted to our servers and is controlled entirely by you.

## 9. Your Privacy Rights & Choices

**Access & Correction.** You may review and update your account information at any time through your Settings page.

**Deletion.** You may delete your account through Settings. Upon deletion, your profile and private content are removed from public view. Some data may be retained as described in Section 8.

**Discoverability.** You may control whether your profile appears in Platform search results and recommendations through your Privacy Settings.

**Location Permissions.** You may revoke location access at any time through your device or browser settings. Revoking permission disables location-based features but does not affect previously stored pin coordinates.

**Analytics Opt-Out.** You may opt out of Google Analytics using the browser add-on linked in Section 6. You may opt out of Meta tracking through Meta’s Ad Preferences.

**Minnesota Residents.** Minnesota law may afford you additional rights regarding your personal data. To exercise any of these rights, contact us at loveofminnesota@gmail.com. We will respond within 45 days.

**California Residents.** If you are a California resident, you may have rights under the California Consumer Privacy Act (CCPA), including the right to know, delete, and opt out of the sale of personal information. We do not sell personal information. To submit a CCPA request, contact us at the email above.

## 10. Data Security

We take reasonable technical and organizational measures to protect your personal information against unauthorized access, disclosure, alteration, and destruction. These measures include:

- Row-Level Security (RLS) enforced at the database layer via Supabase — ensuring users can only access data they are authorized to view.
- Encrypted data transmission over HTTPS for all Platform communications.
- OTP-based authentication — no persistent passwords stored on our servers.
- Access controls limiting data access to personnel with a legitimate operational need.

No security system is impenetrable. In the event of a data breach that affects your rights or freedoms, we will notify you as required by applicable law.

## 11. Children's Privacy

The Platform is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at loveofminnesota@gmail.com and we will take steps to delete that information promptly.

Users between the ages of 13 and 17 must have a parent or legal guardian review this Privacy Policy and agree to it on their behalf before using the Platform.

## 12. Third-Party Links & Content

The Platform may contain links to third-party websites, including news articles aggregated from external publishers and government data sources. This Privacy Policy does not apply to those third-party sites. We encourage you to review the privacy policies of any external sites you visit.

Civic and government data displayed on the Platform is sourced from public Minnesota databases. The privacy practices of those government sources are governed by their own policies and applicable Minnesota public records law.

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date at the top of this page and, where appropriate, provide additional notice — such as a notification within the Platform or an email to your registered address.

Your continued use of the Platform after a revised Privacy Policy takes effect constitutes your acceptance of the updated policy. We encourage you to review this page periodically.

## 14. Contact

If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

For the Love of Minnesota  
Website: fortheloveofminnesota.com  
Email: loveofminnesota@gmail.com

This Privacy Policy is effective as of April 17, 2026.
$privacy_md$
from public.legal_policies p
where p.slug = 'privacy_policy'
on conflict (policy_id, platform, version_label) do nothing;

-- Changelog seed
insert into public.legal_policy_changes (version_id, sort_order, change_kind, section, body)
select v.id, 0, 'added', 'Initial', 'Initial Terms of Service (platform=all), effective 2026-04-17'
from public.legal_policy_versions v
join public.legal_policies p on p.id = v.policy_id
where p.slug = 'terms_of_service' and v.platform = 'all' and v.version_label = '2026.04.17'
  and not exists (select 1 from public.legal_policy_changes c where c.version_id = v.id);

insert into public.legal_policy_changes (version_id, sort_order, change_kind, section, body)
select v.id, 0, 'added', 'Initial', 'Initial Privacy Policy (platform=all), effective 2026-04-17'
from public.legal_policy_versions v
join public.legal_policies p on p.id = v.policy_id
where p.slug = 'privacy_policy' and v.platform = 'all' and v.version_label = '2026.04.17'
  and not exists (select 1 from public.legal_policy_changes c where c.version_id = v.id);
