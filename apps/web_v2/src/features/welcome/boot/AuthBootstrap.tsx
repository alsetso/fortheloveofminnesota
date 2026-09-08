'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import {
  markCurrentTerritoryStackReady,
  clearCurrentTerritoryStack,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import { syncCurrentTerritoryStack } from '@/features/accountTerritories/db/syncCurrentTerritoryStack';
import { warmAppShell } from '@/features/appShell/warmAppShell';
import { logWorldSession } from '@/features/appShell/logWorldSession';
import { setSessionLogged, setWarmShellDone, setBootDone as signalBootDone, resetBootMeta } from './bootMetaStore';
import { useUserLocation } from '@/map/location/UserLocationProvider';
import { clearPendingXp } from '@/features/xp/store/pendingXpStore';
import { invalidateStanding } from '@/lib/standing/invalidateStanding';
import { prepareLevelUpFromGrant, releaseLevelUpSequence } from '@/features/xp/store/levelUpStore';
import { clearFeedCache, warmFeedHome } from '@/features/feed/feedCacheStore';
import SplashScreen from '@/features/welcome/splash/SplashScreen';
import {
  HANDOFF_MS,
  LOCATION_BUDGET_MS,
  MAX_BOOT_MS,
  MIN_BRAND_MS,
  TERRITORY_BUDGET_MS,
  progressForPhase,
  statusForPhase,
  type BootPhase,
} from './bootPhase';
import { resolveBootDestination } from './resolveBootDestination';
import { waitForLocationReady } from './waitForLocationReady';
import {
  isContactsPath,
  isDiscoverPath,
  isFeedPath,
  isMessagesPath,
  isMessagePath,
  isNotificationsPath,
  isPagePath,
  isPagesPath,
  isTerritoryUnitPath,
  isPostPath,
  isServicesPath,
  isSettingsPath,
  isSignedInMapPath,
  isUsernamePath,
  LOGGED_IN_HOME_PATH,
  WELCOME_PATH,
} from '@/lib/routes/routePolicy';

/** Surfaces the user may open directly — do not force Campaign. */
function isStayableAppPath(pathname: string | null): boolean {
  return (
    isSignedInMapPath(pathname) ||
    isFeedPath(pathname) ||
    isDiscoverPath(pathname) ||
    isContactsPath(pathname) ||
    isPagesPath(pathname) ||
    isPagePath(pathname) ||
    isTerritoryUnitPath(pathname) ||
    isPostPath(pathname) ||
    isUsernamePath(pathname) ||
    isServicesPath(pathname) ||
    isSettingsPath(pathname) ||
    isNotificationsPath(pathname) ||
    isMessagesPath(pathname) ||
    isMessagePath(pathname)
  );
}

/**
 * Survives Fast Refresh remounts so the splash cannot reset into a
 * perpetual loading loop during dev HMR. Full page reload clears these.
 */
let splashReleasedForSession = false;
let bootSessionLogged = false;

/**
 * Primary auth + location + territory gate.
 * Game-style phases: brand → auth → gate → (warm*) → ready handoff.
 */
export default function AuthBootstrap({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    authStatus,
    accountLoading,
    needsAccountSelection,
    account,
    accountFetchFailed,
    signOut,
  } = useAuthSafe();
  const { phase: locationPhase, start: startLocation } = useUserLocation();

  const [phase, setPhase] = useState<BootPhase>(
    splashReleasedForSession ? 'ready' : 'brand',
  );
  const [minBrandElapsed, setMinBrandElapsed] = useState(splashReleasedForSession);
  const [maxElapsed, setMaxElapsed] = useState(false);
  const [criticalReady, setCriticalReady] = useState(splashReleasedForSession);
  const [worldWarmDone, setWorldWarmDone] = useState(splashReleasedForSession);
  const [bootDone, setBootDone] = useState(splashReleasedForSession);
  const [fading, setFading] = useState(false);
  const [splashGone, setSplashGone] = useState(splashReleasedForSession);
  /** True once boot is done — shows the primary CTA (world/welcome/setup variants). */
  const [readyForEntry, setReadyForEntry] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // If the session was already released (fast-refresh / Despia re-hydration),
  // make sure the store also reflects bootDone so SetupGate can act.
  useEffect(() => {
    if (splashReleasedForSession) signalBootDone();
  }, []);

  const locationPhaseRef = useRef(locationPhase);
  locationPhaseRef.current = locationPhase;
  const bootRunRef = useRef(0);
  const handoffStarted = useRef(splashReleasedForSession);
  /** Destination href captured at handoff-ready time, consumed on Enter tap. */
  const pendingDestHref = useRef<string | null>(null);
  /** World href captured at handoff — wins the post-boot gate if pathname lags. */
  const chosenWorldHref = useRef<string | null>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Tracks the last resolved account ID so we can detect mid-session switches
   * (post-boot, from account switcher UI) and flush account-scoped stores.
   * null = no account has been committed yet this session.
   */
  const prevAccountIdRef = useRef<string | null>(null);

  // Clean up any pending handoff timer on unmount.
  useEffect(() => {
    return () => {
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    };
  }, []);

  const status = signingOut
    ? 'Signing out…'
    : statusForPhase(phase, { accountLoading });
  const progress = progressForPhase(phase);

  const destination = resolveBootDestination({
    authStatus,
    user,
    account,
    accountLoading,
    needsAccountSelection,
    accountFetchFailed,
    pathname,
  });

  // Brand min-hold + hard max (max only meaningful after auth is known).
  useEffect(() => {
    if (splashReleasedForSession) return;
    const minT = setTimeout(() => setMinBrandElapsed(true), MIN_BRAND_MS);
    const maxT = setTimeout(() => setMaxElapsed(true), MAX_BOOT_MS);
    return () => {
      clearTimeout(minT);
      clearTimeout(maxT);
    };
  }, []);

  // Kick Mapbox + tab prefetch early (parallel with auth) for a snappy handoff.
  useEffect(() => {
    if (splashReleasedForSession) return;
    void warmAppShell(router);
  }, [router]);

  // Once the account is world-ready, fill the feed cache so /feed paints instantly.
  // Does not block splash — fire-and-forget alongside Mapbox warm.
  useEffect(() => {
    if (authStatus !== 'signed_in') return;
    if (destination.kind !== 'world') return;
    void warmFeedHome();
  }, [authStatus, destination.kind, account?.id]);

  // Phase: brand → auth while identity unknown.
  useEffect(() => {
    if (splashReleasedForSession || bootDone) return;
    if (authStatus === 'unknown') {
      setPhase((p) => (p === 'brand' && !minBrandElapsed ? 'brand' : 'auth'));
      setCriticalReady(false);
      return;
    }
    if (authStatus === 'error') {
      setPhase('error');
      // Soft-fail to welcome path — do not invent a signed-in session.
      setCriticalReady(true);
      setWorldWarmDone(true);
      return;
    }
    // anon | signed_in
    if (accountLoading && authStatus === 'signed_in' && !account && !needsAccountSelection) {
      setPhase('auth');
      setCriticalReady(false);
      return;
    }
    setCriticalReady(true);
  }, [
    authStatus,
    accountLoading,
    account,
    needsAccountSelection,
    minBrandElapsed,
    bootDone,
  ]);

  // Warm pipeline — only for complete accounts entering the world.
  useEffect(() => {
    if (splashReleasedForSession || bootDone) return;
    if (!criticalReady) return;
    if (authStatus !== 'signed_in') {
      setWorldWarmDone(true);
      setPhase('gate');
      return;
    }
    if (!destination.needsWorldWarm) {
      setWorldWarmDone(true);
      setPhase('gate');
      return;
    }

    const runId = ++bootRunRef.current;
    const ac = new AbortController();

    void (async () => {
      try {
        setPhase('warm_location');
        startLocation({ quiet: true, avoidPrompt: true, force: true });

        const fix = await waitForLocationReady(
          () => locationPhaseRef.current,
          LOCATION_BUDGET_MS,
          ac.signal,
        );
        if (runId !== bootRunRef.current) return;

        if (fix) {
          setPhase('warm_territory');
          const territoryAc = new AbortController();
          const territoryTimer = setTimeout(
            () => territoryAc.abort(),
            TERRITORY_BUDGET_MS,
          );
          try {
            await syncCurrentTerritoryStack(fix.lat, fix.lng, {
              signal: territoryAc.signal,
              postPresence: true,
            });
          } catch {
            markCurrentTerritoryStackReady(
              'Could not map territories for this location.',
            );
          } finally {
            clearTimeout(territoryTimer);
          }
        } else {
          markCurrentTerritoryStackReady();
        }

        if (runId !== bootRunRef.current) return;
        setPhase('warm_map');
        await warmAppShell(router);
        setWarmShellDone();

        if (runId !== bootRunRef.current) return;
        if (!bootSessionLogged) {
          bootSessionLogged = true;
          logWorldSession('boot');
          setSessionLogged();
        }
        setPhase('gate');
        setWorldWarmDone(true);
      } catch {
        if (runId !== bootRunRef.current) return;
        markCurrentTerritoryStackReady();
        await warmAppShell(router).catch(() => undefined);
        setWarmShellDone();
        if (!bootSessionLogged) {
          bootSessionLogged = true;
          logWorldSession('boot');
          setSessionLogged();
        }
        setPhase('gate');
        setWorldWarmDone(true);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [
    criticalReady,
    authStatus,
    destination.needsWorldWarm,
    destination.kind,
    account?.id,
    bootDone,
    startLocation,
    router,
  ]);

  // Release: min brand ∧ criticalReady ∧ (warm done | warm skipped | max after auth).
  // Surface the CTA so the user triggers the final handoff themselves (game-feel press-start).
  // Account selection, profile setup, and demo are all owned by /setup — not the splash.
  useEffect(() => {
    if (bootDone || handoffStarted.current) return;
    if (!minBrandElapsed) return;

    const authKnown = authStatus !== 'unknown';
    const warmOk = worldWarmDone || !destination.needsWorldWarm;
    const forceAfterAuth = maxElapsed && authKnown;

    // Soft-fail: if the session never settles (hung getSession / Despia vault),
    // do not trap the user on "Signing you in…" forever — offer welcome entry.
    if (!authKnown) {
      if (!maxElapsed) return;
      handoffStarted.current = true;
      setPhase('error');
      pendingDestHref.current = WELCOME_PATH;
      setReadyForEntry(true);
      return;
    }

    if (!criticalReady && !forceAfterAuth) return;
    if (!warmOk && !forceAfterAuth) return;

    handoffStarted.current = true;
    setPhase('ready');
    pendingDestHref.current = destination.href;
    setReadyForEntry(true);
  }, [
    bootDone,
    minBrandElapsed,
    criticalReady,
    worldWarmDone,
    destination.needsWorldWarm,
    destination.href,
    maxElapsed,
    authStatus,
  ]);

  /**
   * Called when the player submits a referral code in the splash modal.
   * Throws with a user-facing message on failure so ReferralCodeModal can display it.
   * On success returns the reward summary so the modal can show earned amounts.
   */
  const handleRedeemReferral = useCallback(async (code: string): Promise<{ xpGranted: number; creditsGranted: number }> => {
    const res = await fetch(`/api/referral-codes/${encodeURIComponent(code)}/redeem`, {
      method: 'POST',
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "That code isn't valid or has already been used.");
    }
    const data = (await res.json()) as {
      xp_granted?: number;
      credits_granted?: number;
      level?: number;
      total_xp?: number;
    };
    const xpGranted = data.xp_granted ?? 0;
    const creditsGranted = data.credits_granted ?? 0;

    // Refresh standing so level/XP displays update immediately in the game.
    invalidateStanding();

    // Trigger a level-up ceremony if the referral XP pushed the account over a boundary.
    if (xpGranted > 0) {
      const result = prepareLevelUpFromGrant({
        level: data.level ?? null,
        totalXp: data.total_xp ?? null,
        xpGained: xpGranted,
        source: 'other',
      });
      if (result.prepared) releaseLevelUpSequence();
    }

    return { xpGranted, creditsGranted };
  }, []);

  const releaseSplash = useCallback((href?: string | null) => {
    if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    const dest = href ?? pendingDestHref.current;
    // Same-route replace remounts the map shell and crashes Mapbox on Despia reopen.
    if (dest && dest !== pathname) router.replace(dest);
    // Preferred world href is handoff-only — clear so /game, etc. stay reachable.
    chosenWorldHref.current = null;
    setReadyForEntry(false);
    setFading(true);
    handoffTimerRef.current = setTimeout(() => {
      splashReleasedForSession = true;
      setBootDone(true);
      setSplashGone(true);
      signalBootDone();
    }, HANDOFF_MS);
  }, [router, pathname]);

  /** Get Started / Continue — world goes to /feed; welcome & setup keep their hrefs. */
  const handleEnterMap = useCallback(() => {
    if (destination.kind === 'world') {
      releaseSplash(
        chosenWorldHref.current ??
          destination.href ??
          (isStayableAppPath(pathname) ? pathname : LOGGED_IN_HOME_PATH),
      );
      return;
    }
    releaseSplash(destination.href ?? pendingDestHref.current);
  }, [destination.href, destination.kind, pathname, releaseSplash]);

  // World waits on Get Started — no auto-fade into /feed.

  const handleRedeemSuccess = useCallback(() => {
    chosenWorldHref.current = LOGGED_IN_HOME_PATH;
    releaseSplash(LOGGED_IN_HOME_PATH);
  }, [releaseSplash]);

  /** Clear a stale Despia session and stay on the splash as an anonymous guest. */
  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    chosenWorldHref.current = null;
    pendingDestHref.current = WELCOME_PATH;
    bootRunRef.current += 1;
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
    handoffStarted.current = false;
    splashReleasedForSession = false;
    setFading(false);
    setSplashGone(false);
    setBootDone(false);
    setReadyForEntry(false);
    setPhase('auth');
    clearFeedCache();
    try {
      await signOut();
    } catch {
      /* still land on welcome */
    }
    router.replace(WELCOME_PATH);
    setSigningOut(false);
  }, [signOut, router, signingOut]);

  // Mid-session account switch: fires after boot when account.id changes.
  // Clears all account-scoped module stores and flushes the Next.js server
  // component cache. Routing to the correct destination for the new account
  // is handled entirely by the ongoing gate below — we never hard-navigate
  // to /game here because the new account may still need setup or demo.
  useEffect(() => {
    const curr = account?.id ?? null;
    const prev = prevAccountIdRef.current;

    if (prev !== null && curr !== null && prev !== curr) {
      // Clear every store that is keyed to the old account.id.
      clearCurrentTerritoryStack();
      clearPendingXp();
      invalidateStanding();
      clearFeedCache();
      resetBootMeta();

      if (bootDone) {
        // Flush Next.js RSC cache so server components re-fetch for the new
        // account identity (cookie changed). The ongoing gate effect will
        // compute and execute the correct router.replace for the new account.
        router.refresh();
        // Re-signal bootDone so SetupGate stays active as a safety net.
        // resetBootMeta() cleared it; we're still in a post-boot session.
        signalBootDone();
      }
    }

    prevAccountIdRef.current = curr;
  }, [account?.id, bootDone, router]);

  // Keep the pending CTA destination current while the splash is still up.
  // Auth on Despia often settles anon → signed_in after the first ready tick.
  useEffect(() => {
    if (bootDone || fading) return;
    pendingDestHref.current = destination.href;
  }, [bootDone, fading, destination.href]);

  // Ongoing gate after splash — single resolver, no duplicate rules.
  useEffect(() => {
    if (!bootDone || authStatus === 'unknown') return;
    const next = resolveBootDestination({
      authStatus,
      user,
      account,
      accountLoading,
      needsAccountSelection,
      accountFetchFailed,
      pathname,
    });

    if (authStatus === 'anon' || authStatus === 'error') {
      chosenWorldHref.current = null;
      if (next.href && next.href !== pathname) router.replace(next.href);
      return;
    }

    // /campaign, /game, /story, /feed — leave the URL alone.
    if (isStayableAppPath(pathname)) return;

    // One-shot preferred world href (e.g. referral redeem). Clear after use
    // so later navigation to /game or other routes is not trapped.
    const chosen = chosenWorldHref.current;
    if (chosen && next.kind === 'world') {
      chosenWorldHref.current = null;
      if (chosen !== pathname) router.replace(chosen);
      return;
    }
    if (next.href) router.replace(next.href);
  }, [
    bootDone,
    authStatus,
    user,
    account,
    accountLoading,
    needsAccountSelection,
    accountFetchFailed,
    pathname,
    router,
  ]);

  const showSplash = !splashGone;

  return (
    <>
      {children}
      {showSplash ? (
        <div
          className="fixed inset-0 z-[100]"
          style={{
            opacity: fading ? 0 : 1,
            transition: `opacity ${HANDOFF_MS}ms ease-out`,
            pointerEvents: fading ? 'none' : 'auto',
          }}
          aria-hidden={fading}
        >
          <SplashScreen
            status={status}
            progress={progress}
            readyForEntry={readyForEntry}
            onEnterMap={handleEnterMap}
            onRedeemReferral={handleRedeemReferral}
            onRedeemSuccess={handleRedeemSuccess}
            destinationKind={destination.kind}
            canSignOut={
              signingOut ||
              Boolean(user) ||
              authStatus === 'signed_in' ||
              authStatus === 'error'
            }
            onSignOut={handleSignOut}
          />
        </div>
      ) : null}
    </>
  );
}
