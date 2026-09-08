# Apple App Review Notes — For the Love of Minnesota (iOS)

Working notes for resolving App Store rejection and preparing resubmission.

| Field | Value |
| --- | --- |
| Submission ID | `172be555-8852-4790-adc6-71836996bafc` |
| Review date | April 20, 2026 |
| Devices | iPhone 17 Pro Max · iPad Air 11-inch (M3) |
| Version reviewed | 1.0 |
| Privacy URL (canonical) | https://fortheloveofminnesota.com/privacy |
| Terms / EULA (canonical) | https://fortheloveofminnesota.com/tos |
| In-app routes | `/privacy` · `/tos` |

---

## Status legend

- **ASC** — App Store Connect metadata / config only
- **Code** — binary / product change required
- **Both** — metadata + binary
- **Recording** — physical-device screen recording for App Review reply / Notes

---

## Issue tracker

| # | Guideline | Area | Owner | Status |
| --- | --- | ---: | --- | --- |
| 1 | 5.1.1(v) | Account deletion | Code + Recording | **Code done** — Human: device recording still needed |
| 2 | 2.3.2 | IAP promotional images | ASC | Open |
| 3 | 2.3.3 | Screenshots (6.5" iPhone · 13" iPad) | ASC | Open |
| 4 | 5.1.2(i) | Nearby-user location privacy | Both + Recording | Open |
| 5 | 3.1.1 | Payments must use IAP | Code | **Resolved for V1** — earn-only; no buy/upgrade UI; credit-packs + RC parked |
| 6 | 3.1.2(c) | Subscription Terms of Use (EULA) link | ASC (+ in-app) | **N/A for V1** — no subscription offered |
| 7 | 2.1(b) | IAP products not found in binary | ASC | **Open — Human:** delete/clear unused ASC IAP products so review does not expect them |

---

## 1. Guideline 5.1.1(v) — Account deletion

### Apple said

App supports account creation but has no way to initiate account deletion. Temporary deactivate/disable is not enough. Web-only completion is OK only if the app links directly to the deletion page. Customer-service-only flows are only for highly regulated industries.

### Current product state

- Account dock → **Delete account** → type `@username` → permanent erase via `POST /api/account/delete` (preview via `GET /api/account/delete-preview`).
- Temporary deactivate is not offered.

### Remaining work (Human)

1. Record on a physical device: sign in → Account → Delete account → confirm → complete.
2. Attach recording in App Review Information → Notes (and reply to the rejection thread).

### Reply / Notes talking points

- Delete account is in Account dock (bottom of card)
- Deletion is permanent (not deactivate)
- Demo account credentials still valid for review after delete demo, or a second demo account

---

## 2. Guideline 2.3.2 — Promotional IAP images

### Apple said

Duplicate / identical promotional images were used for different promoted In-App Purchases and/or win-back offers.

### Required work (ASC)

- Give each promoted IAP / win-back offer a **unique** promotional image that matches that product, **or**
- Remove promotional images for products you do not plan to promote.

### Notes

No code change required unless creatives are generated in-repo.

---

## 3. Guideline 2.3.3 — Screenshots

### Apple said

6.5-inch iPhone and 13-inch iPad screenshots do not show the current app UI. Marketing/promo art that is not the real UI is not allowed. Splash / login-only shots generally do not count as “app in use.”

### Required work (ASC)

1. Capture fresh screenshots from the **current** binary on device (or simulator matching sizes).
2. Majority should show core map / community / tools value — not splash or auth alone.
3. Update via Media Manager → **View All Sizes** if needed for 6.5" and 13".

Suggested shot list (adapt to real UI):

1. Map explore with territories / dock
2. Where I’m at / Find Me
3. Community pin / directory page
4. Contacts or tools
5. Account / wallet (optional; avoid paywall-only hero)

---

## 4. Guideline 5.1.2(i) — Nearby users on a map (privacy)

### Apple said

App shows nearby users’ locations on a map without required precautions. All of the following are required:

1. Age rating: **Frequent/Intense** for **Mature/Suggestive Themes**
2. Privacy policy URL on App Details (must resolve)
3. Mechanism to **block** other users
4. Explicit permission to have location displayed on the map; user can decline
5. **Manual check-in each time** location is shown — **no automatic check-ins**

### Current product state (ios-2)

| Precaution | Status |
| --- | --- |
| Privacy policy URL | Exists publicly + in-app (`/privacy`) — confirm ASC App Details field |
| Age rating Mature/Suggestive = Frequent/Intense | ASC — verify / set |
| Block other users | **Done** — Block from pin menu + profile; `community.account_blocks`; live pins filtered |
| Report content | **Done** — Report from pin menu |
| Opt-in to display location on map | **N/A for V1 public presence** — Find Me is private blue-dot only; Controls label is **Find Me** (not “Location sharing”) |
| Manual check-in only (no auto) | **N/A for live people** — no broadcast of the signed-in user’s location to others. Community pins are place posts authored by users, not live people presence |

### Remaining work

**ASC**

- Set Mature/Suggestive Themes → Frequent/Intense
- Confirm Privacy Policy URL = `https://fortheloveofminnesota.com/privacy`

**App Review reply**

- Community pins = place posts (optional media/caption at a lat/lng), not a nearby-people layer
- Find Me never shares location with other users
- Block + Report available from pin / profile surfaces

---

## 5. Guideline 3.1.1 — In-App Purchase required

### Apple said

Paid digital content / services / functionality can be purchased by means other than IAP. US storefront may link out to the browser for non-IAP payment in limited cases (see Apple news / 3.1.1 updates), but digital goods consumed in-app must still be available via IAP.

### Current product state

- Despia path: `BuyCreditsPane` → RevenueCat paywall (`launchRevenueCatPaywall`) — correct IAP direction.
- Non-Despia / web path: Stripe Checkout + optional dev grant.
- Legal copy still emphasizes Stripe for billing (privacy / terms) — update for App Store / RevenueCat where ios2 applies.
- Review found alternate payment mechanisms in the binary (likely Stripe or web checkout reachable from the Despia WebView).

### Required work

1. On Despia / App Store binary: **never** open Stripe Checkout or non-IAP purchase UI for digital credits / subscriptions.
2. Ensure all paid digital unlocks are purchasable via StoreKit / RevenueCat IAP.
3. Multiplatform: content bought off-app may unlock in-app only if the same unlock is also offered via IAP (3.1.3(b)).
4. Remove or gate any UI that suggests web/Stripe purchase inside the iOS app.

---

## 6. Guideline 3.1.2(c) — Subscription metadata (EULA)

### Apple said

Auto-renewable subscription metadata missing a functional Terms of Use (EULA) link. Custom EULA goes in ASC; standard Apple EULA must be linked from the App Description.

### Required work (ASC + product)

**ASC**

- Privacy Policy field → `https://fortheloveofminnesota.com/privacy`
- Terms of Use: custom EULA in ASC **or** link in App Description to `https://fortheloveofminnesota.com/tos`

**In-app (required for subscriptions)**

Confirm paywall / subscription UI shows:

- Subscription title
- Length
- Price (and per-unit if applicable)
- Functional links to Privacy Policy and Terms of Use

In-app welcome already links `/tos` and `/privacy`; ensure subscription surfaces do too.

Reply with a short recording if they ask to confirm the EULA link path.

---

## 7. Guideline 2.1(b) — IAP products not in binary

### Apple said

These products could not be found in the submitted binary:

- Weekly Subscription
- Monthly subscription
- Love of Minnesota Gold
- Love of Minnesota

### Required work

**If not shipping yet**

- Remove / clear them from App Store Connect before resubmit.

**If shipping**

1. Products **Active** in ASC; StoreKit / RevenueCat wired to the same product IDs.
2. Resubmit any IAP in **Developer Action Required** (edit details or cancel pending change).
3. Sandbox-test with Sandbox Apple Account until purchase completes.
4. New binary if StoreKit was missing.
5. Physical-device recording for Notes:

   - Home Screen → launch app → demo account → core flows
   - Successful **sandbox** purchase
   - Any other paid digital flows

Align RevenueCat offerings / product IDs with ASC names above (or delete unused ASC products so review does not expect them).

---

## Resubmission checklist

### App Store Connect

- [ ] Privacy Policy URL set and loads
- [ ] Terms of Use / EULA linked (description or custom EULA field)
- [ ] Age rating: Mature/Suggestive Themes = Frequent/Intense
- [ ] Unique promotional images per promoted IAP (or remove promos)
- [ ] New 6.5" iPhone + 13" iPad screenshots of real UI
- [ ] IAP products: either active + matched in binary, or removed from ASC
- [ ] IAP in Developer Action Required re-submitted
- [ ] Demo account credentials in App Review Information
- [ ] Notes field includes recording + short walkthrough (below)

### Binary / product

- [ ] Account deletion end-to-end
- [ ] Block user
- [ ] Public map presence: consent + decline + manual check-in only
- [ ] No non-IAP purchase path in Despia binary
- [ ] Subscription UI shows title, length, price, privacy + terms links
- [ ] Sandbox purchase succeeds for every product left in ASC

### Screen recordings (physical device)

1. **Account deletion** — create/sign in → Delete account → confirmation
2. **IAP / completeness** — Home → launch → demo login → core features → sandbox purchase → other paid flows
3. **Optional** — EULA / subscription info links; location check-in + block user

---

## Suggested App Review Information → Notes

Paste/adapt after fixes; attach recordings in Notes (or reply to the rejection message).

```text
Hello App Review,

Thank you for the detailed feedback on submission 172be555-8852-4790-adc6-71836996bafc (v1.0).

We have addressed each guideline as follows:

5.1.1(v) Account deletion
- Users can delete their account from Account → Delete account.
- Flow is permanent deletion (not deactivate). Recording attached.

5.1.2(i) Location / nearby users
- Age rating: Mature/Suggestive Themes set to Frequent/Intense.
- Privacy Policy: https://fortheloveofminnesota.com/privacy
- Users can block other users from [describe UI].
- Displaying location to others requires explicit permission (decline available) and a manual check-in each time; automatic check-in is not offered.

3.1.1 / 2.1(b) / 3.1.2(c) Purchases & subscriptions
- Digital purchases use In-App Purchase via StoreKit / RevenueCat only in the iOS app.
- Subscription metadata includes Terms of Use: https://fortheloveofminnesota.com/tos
- Privacy Policy is set in App Store Connect.
- Sandbox purchase recording attached for [product names].

2.3.2 / 2.3.3 Metadata
- Promotional IAP images updated to be unique per product (or removed).
- 6.5" iPhone and 13" iPad screenshots updated to the current app UI.

Demo account: [email] / [password]

Please let us know if anything else is needed.
```

---

## Code touchpoints (ios-2)

| Concern | Likely files / areas |
| --- | --- |
| Account UI | `src/features/map/explore/dockCard/cards/AccountDockCard.tsx` |
| Credits / IAP | `src/features/tools/panes/BuyCreditsPane.tsx`, `src/lib/despia/revenueCat.ts`, `src/app/api/billing/credit-packs/route.ts` |
| Find Me / sharing | `src/map/location/useFindMe.ts`, `WhereImAtDockCard.tsx` |
| Community / live map | `src/features/map/community/*`, `src/app/api/maps/live/data/route.ts`, `src/features/community/*` |
| Legal pages | `src/app/privacy/page.tsx`, `src/app/tos/page.tsx`, `docs/legal/` |
| Welcome legal links | `src/features/welcome/components/WelcomeScreen.tsx` |

---

## Apple resources (from rejection)

- [Account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [IAP in App Store Connect](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/)
- [Promoting IAPs](https://developer.apple.com/app-store/promoting-in-app-purchases/)
- [Screenshots](https://developer.apple.com/app-store/product-page/)
- [Guideline 5.1.2 data use](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)
- [StoreKit / IAP](https://developer.apple.com/in-app-purchase/)
- [Subscriptions](https://developer.apple.com/app-store/subscriptions/)

---

## Full rejection text (archive)

<details>
<summary>App Review message (verbatim summary source)</summary>

**Review Environment**  
Submission ID: 172be555-8852-4790-adc6-71836996bafc  
Review date: April 20, 2026  
Review Device: iPhone 17 Pro Max and iPad Air 11-inch (M3)  
Version reviewed: 1.0  

**Guideline 5.1.1(v)** — Account creation without account deletion. Must offer deletion (not only deactivate). Web completion OK with direct link. Recording required after fix.

**Guideline 2.3.2** — Duplicate/identical promotional images for different promoted IAPs / win-back offers.

**Guideline 2.3.3** — 6.5" iPhone and 13" iPad screenshots do not show current app UI; marketing-only art not allowed.

**Guideline 5.1.2(i)** — Nearby users on map without: Frequent/Intense Mature/Suggestive Themes; privacy policy URL; block users; permission to display location (with decline); manual check-in each time (no automatic check-ins).

**Guideline 3.1.1** — Paid digital content via non-IAP payment mechanisms.

**Guideline 3.1.2(c)** — Missing functional Terms of Use (EULA) link for auto-renewable subscriptions.

**Guideline 2.1(b)** — IAP products (Weekly Subscription, Monthly subscription, Love of Minnesota Gold, Love of Minnesota) not found in submitted binary.

</details>
