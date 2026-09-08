# Contacts foundation (ios-2)

North star: **one intentional contact book, fed by explicit confirm — never by search side effects.**

Lookups are disposable evidence. Contacts are durable identity. Keep those layers separate so free checks, paid public records, map save, and Find Me all share one write ladder.

## Objective

Ship the simplest stack that makes this true end-to-end:

1. **Search never writes a contact.** Name / email / phone / address lookups may archive for cache, credits, and reopen — they do not insert `contacts.people` or `contacts.addresses`.
2. **Credits buy depth, not a book row.** Free account check and 1-credit public records differ only in source + cost. Both end at the same identify → confirm path.
3. **Confirm is the only create.** `POST /api/contacts` with `confirm: true` (via `ContactConfirmSave`) is the sole writer of person/address rows from tool + map flows.
4. **Enrich after you own them.** Durable `contacts.enrichments` attach only to an already-saved contact id — not to a bare Find Someone compose.
5. **Full-screen contact UI is a shell.** List / detail / tag sub-pages swap content inside `ContactsSheetShell`; root stays full-bleed; footer opts into `--keyboard-inset`.

## Write ladder (invariant)

```
compose / map / spend
        ↓
   lookup API  →  tools.*_lookups archive  (TTL / cache / credits)
        ↓
   tool result  →  identify candidates
        ↓
   ContactConfirmSave  →  contacts.people | contacts.addresses
        ↓
   optional enrich / enhance (saved id required)
```

Do **not** short-circuit: no silent upsert on search, no “Save” chip that only opens results while implying a write, no auto-create on credit spend.

## Surfaces

| Intent | Surface | Notes |
|--------|---------|--------|
| Find someone | Dock subpage `people` (`PeopleLookupPane`) | Free check → optional public records → `tool-result` |
| Tool result | Dock subpage `tool-result` (`ToolResultSheet`) | Identify → confirm; never auto-save |
| Confirm (map / search / Find Me) | Dock subpage `contact-confirm` | Same `ContactConfirmSave` |
| Contact book | Full-screen `ContactsSheet` + `ContactsSheetShell` | People / addresses / tag / detail |
| Enrich from book | Contact detail → public records with contact id | Writes enrichment trail |

## Persistence map

| Artifact | Table / store | When |
|----------|---------------|------|
| Lookup archive | `tools.people_lookups` (etc.) | Every successful search |
| Wallet spend | wallet ledger | Paid pulls only |
| Confirm draft | in-memory `contactConfirmDraft` | Transient UI |
| Pending tag | `sessionStorage` | Prefill only |
| Person / address | `contacts.people` / `contacts.addresses` | Confirm save only |
| Enrichments | `contacts.enrichments` | Saved contact subject only |

## Anti-goals

- Auto-saving every free or paid search into the contact book
- Separate save semantics per entry point (map vs tools vs Find Me)
- Shrinking full-screen sheets with the keyboard (Despia prevent-autoscroll: sheet stays put; chrome lifts)
- Growing a second “recent lookups as contacts” product without an explicit UX decision

## Related code

- `src/features/contacts/ContactConfirmSave.tsx`
- `src/features/contacts/ContactsSheetShell.tsx`
- `src/features/contacts/identifyCandidates.ts` (`identifyAccountPerson` for free account archives)
- `src/features/tools/panes/PeopleLookupPane.tsx`
- `src/features/tools/panes/ToolResultSheet.tsx`
- `src/app/api/people/lookup/route.ts` (archive required for confirm-save ladder)
- `src/app/api/contacts/route.ts`
- `src/lib/despia/safeArea.ts` (`safePadBottomKeyboard`)

## MVP shipped (functional)

- Free account check **requires** a tools archive id, then opens `tool-result` (parity with public records).
- Account matches identify with `linkedAccountId` + optional avatar on confirm save.
- Inline match chrome says **Review**, never fake **Save**.
- `POST /api/contacts` still writes only with `confirm: true`.
