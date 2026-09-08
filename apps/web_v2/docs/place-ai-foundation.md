# Place AI foundation (territory About fields)

North star: **Place AI may research place facts, but it never silently overwrites the unit record.** Admin/dev review Existing vs New line by line, then approve.

## Objective

1. **Chat extracts facts; it does not write units.** Assistant replies may include an `ftlom-facts` fenced JSON block. The server strips it from displayed Markdown, builds compare rows, and stores them on `subject_messages.meta.foundation` with `status: 'pending'`.
2. **Review is the only write from chat.** `POST /api/ai/territory/[unitId]` with `action: 'review_foundation'` applies only the fields the operator accepts.
3. **Fill About is a prompt tool, not a writer.** The floating control in Place AI starts/sends a research prompt for overview, website, email, phone, population, and best/worst features; persistence still goes through the review table.
4. **Manual About edit stays available** on localhost/dev (and staff who can apply) via `PATCH /api/territory/units/[id]/profile`.

## Fields

| UI label | Storage |
|----------|---------|
| Overview | `units.description` |
| Website | `units.website_url` |
| Email | `units.contact_email` |
| Phone | `units.contact_phone` |
| Population | `units.attrs.population` |
| Best features | `units.attrs.features.best` |
| Challenges | `units.attrs.features.worst` |

Kind-native attrs (county codes, etc.) are never touched by this path.

## Flow

```
Fill About / free-form chat
        ↓
  OpenAI subject response (+ optional web search)
        ↓
  extractUnitFoundationFromAnswer  →  strip fence, parse JSON
        ↓
  buildFoundationCompareRows(unit, facts)  →  Existing vs New
        ↓
  subject_messages.meta.foundation.rows  (pending — no unit write)
        ↓
  Place AI UI: Approve / Skip per row (or Approve all)
        ↓
  review_foundation  →  applyUnitFoundationFacts(autoApply: true)
        ↓
  units columns / attrs + change_proposals (audit)
```

## Access

| Surface | Who |
|---------|-----|
| Place AI chat | Local/dev, or production staff/admin (`resolveAiAccess`) |
| Coming-soon gate (details: seats + Place AI) | Hidden for general users; unlocked for local/dev and admins with Preview as user **Off** |
| Approve foundation rows | Same as `aiAccessCanApply` (localhost/dev or staff/admin) |

Preview as user: `?asUser=1|0` or Account card toggle (`ftlomn:preview-as-user`). See `src/lib/comingSoonGate.ts`.

## Message meta shape

```ts
meta.foundation = {
  from_block: boolean;
  applied: boolean;
  status: 'pending' | 'applied' | 'dismissed';
  labels: string[];
  proposal_ids: string[];
  source_urls: string[];
  rows: Array<{
    key: 'description' | 'website_url' | 'contact_email' | 'contact_phone'
      | 'population' | 'features.best' | 'features.worst';
    label: string;
    existing: string;   // display
    proposed: string;   // display
    proposedValue: string | number | string[];
    status: 'pending' | 'accepted' | 'rejected';
  }>;
};
```

Compare rows include **overwrites** when the model proposes a value different from the current unit (not only empty fills). Skipped rows never write.

## API

| Endpoint | Role |
|----------|------|
| `GET /api/ai/territory/[unitId]` | Unit + seats context for Place AI |
| `POST …/subjects/territory_unit/[unitId]/threads` | List / create chats |
| `POST /api/ai/threads/[threadId]/messages` | Send message; extract facts → pending rows only |
| `POST /api/ai/territory/[unitId]` `review_foundation` | Body: `{ messageId, decisions: [{ key, decision: 'accept' \| 'reject' }] }` |
| `PATCH /api/territory/units/[id]/profile` | Manual About editor |

## Related code

- `src/features/map/explore/panes/DockTerritoryAiPane.tsx` — chat UI, Fill About, Existing vs New table
- `src/features/map/explore/panes/DockUnitProfileSection.tsx` — About display / manual edit
- `src/features/map/explore/TerritoryDetailsOpsMenu.tsx` — details ⋯ (highlight, Open Place AI)
- `src/lib/ai/unitProfileFacts.ts` — extract, compare rows, approved → facts
- `src/lib/ai/applyUnitFoundation.ts` — proposals + apply
- `src/lib/ai/runSubjectResponses.ts` — system prompt + `ftlom-facts` contract
- `src/app/api/ai/threads/[threadId]/messages/route.ts`
- `src/app/api/ai/territory/[unitId]/route.ts`

## Anti-goals

- Auto-applying chat extracts to `units` for admin/dev without review
- Inventing emails/phones when sources are missing
- Clobbering kind-native attrs while merging population/features
- Showing Place AI / seats to gated general users
