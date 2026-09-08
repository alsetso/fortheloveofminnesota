# iOS production surface — Own / Park / Out

Authority test (every screen):

1. Does a **resident** need this on a phone this week?
2. Is it chrome, a pillar, or staff tooling?
3. Can **web** keep the complex version?

| Answer | Action |
|--------|--------|
| No / staff | **Out** — do not ship in Own nav |
| Yes, phone | **Own** — simplify UI here |
| Later | **Park** — leave route, zero polish |

Full Despia docs: [`DESPIA.md`](./DESPIA.md).

---

## Own (V1 resident loop)

| Route | Job | Shell |
|-------|-----|-------|
| `/welcome` | Splash → sign-in (unauthorized only) | Standalone |
| `/setup` | Account select + profile completeness | Map + sheet |
| `/game` | **Primary loop** — collectibles, Find Me, territories, community, dock cards (Account, Wallet, Insights Today, Insights Explore, …) | Map shell |
| `/privacy`, `/tos` | Legal (required in-app) | Legal page |

**Dock cards on `/game` replace separate Own tabs** for Today, Explore, and Wallet in production.

---

## Park (exist, don’t invest for V1)

| Route | Notes |
|-------|-------|
| `/explore-map` | Atlas MapAppShell — durable layer URLs, no Find Me session. Ready to polish; not an Own tab yet. |
| `/today`, `/explore`, `/explore/*`, `/wallet` | **Dev-only** — middleware redirects to `/game` in production. Author full-page UIs locally; ship via dock cards. |
| `/store`, `/tools` | Legacy redirects → wallet / game |

---

## Out (not this app)

Staff / web-only surfaces are not present as iOS Own routes. Do not add `/admin/**`, `/workspace/**`, `/business/**`, `/world`, `/manage/**` to this binary’s nav. Web (`apps/web`) keeps those.

---

## Production-ready checklist

### A. Product surface
- [x] V1 Own = welcome · setup · legal · `/game` (no bottom tab bar)
- [x] Today / Explore / Wallet content on `/game` via dock cards; full pages DEV_ONLY
- [x] Despia frame foundation (`.despia-app-root`, safe spacers, `DespiaAppFrame`, `safeArea.ts`) — see [`DESPIA.md`](./DESPIA.md)
- [ ] `/explore-map` polish (atlas deep links) when ready — non-blocking for resubmit
- [ ] Map shell overlays audited for Despia inset chain (not bare `env()` only)
- [x] Account deletion path (Account dock → Delete account)

### B. Auth / session (Despia)
- [x] `/welcome` + splash gate; anonymous → welcome (`features/welcome/`)
- [x] Storage vault for Supabase tokens (`lib/despia/sessionVault.ts`)
- [x] Sign In with Apple — **out of V1** (email OTP ships)
- [ ] OAuth in WKWebView — N/A until SIWA returns

### C. Billing — earn-only for V1 (IAP parked)
- [x] No buy-credits / membership upgrade CTAs
- [x] `/api/billing/credit-packs` → 410; RevenueCat helpers/webhook disabled
- [ ] **ASC:** clear unused IAP products so review does not expect them
- [ ] Post-V1: re-enable RevenueCat when ready

### D. Compliance
- [ ] ATT before analytics
- [x] Find Me = private blue-dot (no public presence broadcast)
- [x] Block users (pin + profile)

### E. Polish (after loop feels native)
- [ ] OneSignal push
- [ ] Haptics on primary actions
- [ ] Universal links
- [ ] Native share

---

## Billing model (ios vs web)

| Surface | Processor |
|---------|-----------|
| Despia iOS **V1** | **Earn-only** — map collects + plan grants. No IAP / Stripe in-app. |
| Despia iOS later | RevenueCat → App Store IAP (parked; `lib/despia/revenueCat.ts`) |
| Browser web | Stripe (unchanged in `apps/web`) |

Never open Stripe Checkout inside the Despia WebView for digital goods.

---

## Working order

1. Fence Own chrome (Game full-bleed, Despia safe areas)  
2. Game dock loop (Account · Wallet · Insights · community · tools)  
3. `/explore-map` polish when atlas share URLs matter  
4. Earn-only wallet (done for V1)  
5. ATT / push / haptics post-loop  

Creative freedom lives inside **Own**. Do not polish **Out**.
