# Legal Policies (ios-2)

Canonical instructions for humans and AI agents updating Terms of Service, Privacy Policy, and future legal docs for For the Love of Minnesota.

## Live backend status

Applied on Supabase project `fortheloveofminnesota` (`hfklpjuiuhbulztsqapv`):

- Tables: `legal_policies`, `legal_policy_versions`, `legal_policy_changes`, `account_policy_acceptances`
- RPCs: `legal_current_version(slug, platform)`, `accept_current_legal_policies(account_id, platform, method)`
- Seeded published versions: Terms + Privacy `2026.04.17` (`platform=all`)
- Existing accounts backfilled to those versions (signup bind) when tracking went live

Staff agreements in `admin.*` remain separate and are not used for consumer ToS/Privacy.

## Live public URLs (source of truth for copy today)

| Policy | Public path | Live URL | Effective |
|--------|-------------|----------|-----------|
| Terms of Service | `/tos` | https://fortheloveofminnesota.com/tos | 2026-04-17 |
| Privacy Policy | `/privacy` | https://fortheloveofminnesota.com/privacy | 2026-04-17 |

Notes from live review (2026-07-30):

- `/terms` does **not** serve Terms — it falls through to the marketing home. Use `/tos`.
- Both docs are OTP/account-aware, cite Stripe/Supabase/Mapbox/OpenAI/Resend/GA/Meta, Minnesota governing law (Hennepin County), and 13+ age floor.
- ios-2 welcome gate already links `/tos` and `/privacy`; those routes must show the **current published version for platform `ios2`** (falling back to `all`).

## Goals

1. **Version control** — every publish is an immutable version with timestamps, full content, and a changelog. Unique on `(policy_id, platform, version_label)` and monotonic `version_seq` per platform lane.
2. **Platform variation** — web, ios2, and future clients can share or diverge policy text without forking the whole system. Resolution: published override for that platform, else published `all`.
3. **Account correspondence** — each `public.accounts` row records which policy versions were in force when the user created/accepted (signup binding), plus a full acceptance history for reconsent (`account_policy_acceptances.source` = platform).

## Repo layout

```
docs/legal/
  LEGAL_POLICIES.md                 ← this file (agent instructions)
  policies/
    terms_of_service/
      2026.04.17.md                 ← shared / platform=all seed
      2026.04.17.ios2.md            ← optional platform override (only if text differs)
    privacy_policy/
      2026.04.17.md
      2026.04.17.ios2.md            ← optional
supabase/migrations/
  20260730_legal_policies.sql       ← schema + seed pointers
src/lib/legal/                      ← runtime helpers for ios-2
```

Markdown in `docs/legal/policies/` is the **authoring** source. The database is the **runtime** source for the app and for account binding.

## Data model (summary)

| Table | Role |
|-------|------|
| `legal_policies` | Stable policy identity (`terms_of_service`, `privacy_policy`) |
| `legal_policy_versions` | Immutable versions: content, effective/published timestamps, **platform**, status |
| `legal_policy_changes` | Changelog bullets for that version (added / updated / removed / clarified) |
| `account_policy_acceptances` | History: account × version × accepted_at × method × source platform |
| `accounts.terms_*` / `privacy_*` | Fast pointers to the versions accepted at signup (or last reconsent) |

### Platforms

Use lowercase slugs:

| Platform | Meaning |
|----------|---------|
| `all` | Default shared text. Used when a platform has no override. |
| `ios2` | Despia / Next ios-2 app (`@ftlomn/ios-2`) |
| `web` | fortheloveofminnesota.com web app |
| (future) | e.g. `admin`, `partner` — add slug, do not invent columns |

**Resolution order** for “current policy” on a platform:

1. Latest `published` version for that `policy.slug` + `platform`
2. Else latest `published` version for that slug + `platform = 'all'`

Never silently mix platforms when recording acceptance — store the exact `legal_policy_versions.id` the user agreed to.

**When to create a platform variation**

| Change type | Platform |
|-------------|----------|
| Shared product rules (accounts, UGC, liability, MN law) | `all` |
| App Store / RevenueCat / Despia / device location copy | `ios2` only |
| Cookies, Meta Pixel, GA browser wording | `web` only (or keep in `all` if both surfaces show it) |

Example filenames:

- `policies/terms_of_service/2026.08.01.md` → platform `all`
- `policies/terms_of_service/2026.08.01.ios2.md` → platform `ios2` (same `version_label`, different `platform` row)

`version_seq` increments **per (policy, platform)** lane independently.

### Version labels

- Format: `YYYY.MM.DD` (effective calendar date), optional suffix for same-day republish: `2026.04.17.b`
- `version_seq` is a monotonic integer **per (policy_id, platform)** — do not reuse
- Status lifecycle: `draft` → `published` → `superseded` (on next publish for same policy+platform)

**Never edit a published row’s `content_md` in place.** Clone → edit draft → publish.

## Agent instructions — updating a policy

When asked to update Terms, Privacy, or another legal policy:

1. **Read this file** and the current markdown under `docs/legal/policies/<slug>/`.
2. **Confirm platform scope.** Ask if omitted: shared (`all`) vs platform-specific (`ios2`, `web`, …). Prefer `all` unless the change is app-only (IAP, Despia, App Store wording) or web-only (cookies, Meta Pixel, etc.).
3. **Diff against live + last seed.** Pull https://fortheloveofminnesota.com/tos and `/privacy` if the change is meant to stay in sync with public web.
4. **Create a new version folder file**, never overwrite a published seed:
   - Shared: `policies/<slug>/YYYY.MM.DD.md`
   - Platform-only: `policies/<slug>/YYYY.MM.DD.<platform>.md`
5. **Write a changelog** at the top of the new file (see template below) and mirror bullets into `legal_policy_changes` in the migration/seed SQL.
6. **Add a Supabase migration** that:
   - Inserts the new `legal_policy_versions` row (`status = 'draft'` then publish, or publish in one step)
   - Sets previous published row for that `(policy_id, platform)` to `superseded` + `retired_at`
   - Inserts `legal_policy_changes` rows
7. **Do not** mutate historical `account_policy_acceptances` or old version content.
8. **ios-2 UI:** `/tos` and `/privacy` must resolve via `getCurrentPolicyVersion(slug, 'ios2')`. No hardcoded stale placeholders.
9. **Material / reconsent:** if the change is material, note in the PR that existing accounts need a reconsent pass (`acceptance_method = 'reconsent'`) — do not auto-rewrite signup pointers without product approval.
10. **Lawyer review:** flag material legal changes; agents draft structure and changelog only unless explicitly told the copy is approved.

### New version markdown template

```md
---
slug: terms_of_service
platform: all          # or ios2 | web
version_label: 2026.08.01
effective_at: 2026-08-01T00:00:00Z
summary: Clarify subscription cancellation for ios IAP.
---

## Changelog

- updated: Subscription Plans & Billing — note App Store / RevenueCat cancellation path for ios2
- clarified: Contact email unchanged

## Content

# Terms of Service
...
```

## Account binding (auth)

On successful ios-2 signup / first OTP verify (and on explicit reconsent):

1. Resolve current published Terms + Privacy for `platform = 'ios2'` (fallback `all`).
2. Insert `account_policy_acceptances` rows for both versions (`acceptance_method = 'signup'`, `source = 'ios2'`).
3. Set on `accounts`:
   - `terms_version_id`, `terms_accepted_at`
   - `privacy_version_id`, `privacy_accepted_at`

That is the correspondence between the public policies and “what this account agreed to when they joined.” Later publishes do **not** rewrite these columns until the user reconsents.

## What agents must not do

- Overwrite published version content
- Delete old versions or acceptances
- Serve web-only cookie/pixel language as the only ios2 copy without an `all`/`ios2` decision
- Point `/terms` as the public Terms URL (use `/tos`)
- Commit secrets or raw PII into legal markdown

## Quick checklist (PR)

- [ ] New markdown under `docs/legal/policies/...` (not an in-place edit of a published file)
- [ ] Platform (`all` / `ios2` / `web`) explicit in frontmatter
- [ ] Migration inserts version + changelog; supersedes prior published for that platform
- [ ] ios-2 still resolves current via lib helpers
- [ ] Signup acceptance still binds exact version IDs
- [ ] Material change → reconsent note in PR
