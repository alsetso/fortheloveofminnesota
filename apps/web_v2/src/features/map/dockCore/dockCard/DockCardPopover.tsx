'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockScrollRegion } from '@/features/map/dockCore/core/dockScroll';
import {
  DockCardChromeProvider,
  useDockCardChrome,
} from '@/features/map/dockCore/dockCard/DockCardChrome';
import { DOCK_CARD_LABELS } from '@/features/map/dockCore/dockCard/dockCardTypes';
import { MAP_DOCK_HANDLE_CLASS } from '@/features/map/dockCore/core/mapDockTokens';
import { MAP_SHEET_BODY_CLASS } from '@/lib/map/mapChrome';
import { safePadBottom, safePadBottomKeyboard } from '@/lib/despia/safeArea';
import AccountDockCard from '@/features/map/dockCore/dockCard/cards/AccountDockCard';
import DeleteAccountDockCard from '@/features/map/dockCore/dockCard/cards/DeleteAccountDockCard';
import WalletDockCard from '@/features/map/dockCore/dockCard/cards/WalletDockCard';
import ContactsDockCard from '@/features/map/dockCore/dockCard/cards/ContactsDockCard';
import ControlsDockCard from '@/features/map/game/ControlsDockCard';
import MapStyleDockCard from '@/features/map/dockCore/dockCard/cards/MapStyleDockCard';
import SetHomeConfirmDockCard from '@/features/map/dockCore/dockCard/cards/SetHomeConfirmDockCard';
import MyPlacesDockCard from '@/features/map/dockCore/dockCard/cards/MyPlacesDockCard';
import PageManagerDockCard from '@/features/map/dockCore/dockCard/cards/PageManagerDockCard';
import CollectionsDockCard from '@/features/map/dockCore/dockCard/cards/CollectionsDockCard';
import HeartsDockCard from '@/features/map/dockCore/dockCard/cards/HeartsDockCard';
import LevelDockCard from '@/features/map/dockCore/dockCard/cards/LevelDockCard';
import PinDockCard from '@/features/map/dockCore/dockCard/cards/PinDockCard';
import ReportDockCard from '@/features/map/dockCore/dockCard/cards/ReportDockCard';
import PageDockCard from '@/features/map/dockCore/dockCard/cards/PageDockCard';
import ProfileDockCard from '@/features/map/dockCore/dockCard/cards/ProfileDockCard';
import NearbyPlaceDockCard from '@/features/map/dockCore/dockCard/cards/NearbyPlaceDockCard';
import DirectoryPagesDockCard from '@/features/map/dockCore/dockCard/cards/DirectoryPagesDockCard';
import CommunityPinsDockCard from '@/features/map/dockCore/dockCard/cards/CommunityPinsDockCard';
import ActivityDockCard from '@/features/map/dockCore/dockCard/cards/ActivityDockCard';
import ActivityDetailDockCard from '@/features/map/dockCore/dockCard/cards/ActivityDetailDockCard';
import ActivityFollowersDockCard from '@/features/map/dockCore/dockCard/cards/ActivityFollowersDockCard';
import ActivityFollowingDockCard from '@/features/map/dockCore/dockCard/cards/ActivityFollowingDockCard';
import ActivityAnalyticsDockCard from '@/features/map/dockCore/dockCard/cards/ActivityAnalyticsDockCard';
import NotificationsDockCard from '@/features/map/dockCore/dockCard/cards/NotificationsDockCard';
import StepsDockCard from '@/features/map/dockCore/dockCard/cards/StepsDockCard';
import ContributorDockCard from '@/features/map/dockCore/dockCard/cards/ContributorDockCard';
import InsightsExploreDockCard from '@/features/map/game/InsightsExploreDockCard';
import StandingDockCard from '@/features/map/game/StandingDockCard';
import BackpackDockCard from '@/features/map/dockCore/dockCard/cards/BackpackDockCard';
import DropCatalogDockCard from '@/features/map/dockCore/dockCard/cards/DropCatalogDockCard';

/**
 * Dynamic in-dock card host — fills the sheet from above while dock chrome hides.
 *
 * Scroll model matches dock panes: one DockScrollRegion owned here; cards
 * register sticky header/footer via DockCardShell. Swipe-to-dismiss only
 * (min half-open; flick past half to close — see MapDockShell).
 */
export default function DockCardPopover() {
  const {
    dockCard,
    closeDockCard,
    pageCardEntity,
    profileCardTarget,
    pinCardEntity,
  } = useMapDock();
  const [entering, setEntering] = useState(true);

  const baseScrollKey =
    dockCard === 'page'
      ? `page:${pageCardEntity?.id ?? ''}`
      : dockCard === 'profile'
        ? `profile:${profileCardTarget ?? ''}`
        : dockCard === 'pin' || dockCard === 'report'
          ? `${dockCard}:${pinCardEntity?.id ?? ''}`
          : (dockCard ?? '');

  useEffect(() => {
    if (!dockCard) {
      setEntering(true);
      return;
    }
    setEntering(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDockCard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dockCard, closeDockCard]);

  if (!dockCard) return null;

  const label = DOCK_CARD_LABELS[dockCard];
  let body: ReactNode = null;
  switch (dockCard) {
    case 'account':
      body = <AccountDockCard />;
      break;
    case 'delete-account':
      body = <DeleteAccountDockCard />;
      break;
    case 'wallet':
      body = <WalletDockCard />;
      break;
    case 'contacts':
      body = <ContactsDockCard />;
      break;
    case 'controls':
      body = <ControlsDockCard />;
      break;
    case 'map-style':
      body = <MapStyleDockCard />;
      break;
    case 'set-home-confirm':
      body = <SetHomeConfirmDockCard />;
      break;
    case 'my-places':
      body = <MyPlacesDockCard />;
      break;
    case 'page-manager':
      body = <PageManagerDockCard />;
      break;
    case 'collections':
      body = <CollectionsDockCard />;
      break;
    case 'hearts':
      body = <HeartsDockCard />;
      break;
    case 'level':
      body = <LevelDockCard />;
      break;
    case 'activity':
      body = <ActivityDockCard />;
      break;
    case 'activity-detail':
      body = <ActivityDetailDockCard />;
      break;
    case 'activity-followers':
      body = <ActivityFollowersDockCard />;
      break;
    case 'activity-following':
      body = <ActivityFollowingDockCard />;
      break;
    case 'notifications':
      body = <NotificationsDockCard />;
      break;
    case 'steps':
      body = <StepsDockCard />;
      break;
    case 'contributor':
      body = <ContributorDockCard />;
      break;
    case 'standing':
      body = <StandingDockCard />;
      break;
    case 'atlas':
      body = <InsightsExploreDockCard />;
      break;
    case 'backpack':
      body = <BackpackDockCard />;
      break;
    case 'activity-analytics':
      body = <ActivityAnalyticsDockCard />;
      break;
    case 'pin':
      body = <PinDockCard />;
      break;
    case 'report':
      body = <ReportDockCard />;
      break;
    case 'page':
      body = <PageDockCard />;
      break;
    case 'profile':
      body = <ProfileDockCard />;
      break;
    case 'nearby-place':
      body = <NearbyPlaceDockCard />;
      break;
    case 'directory-pages':
      body = <DirectoryPagesDockCard />;
      break;
    case 'community-pins':
      body = <CommunityPinsDockCard />;
      break;
    case 'drop-catalog':
      body = <DropCatalogDockCard />;
      break;
  }

  return (
    <div
      className={`pointer-events-auto absolute inset-0 z-30 flex flex-col ${
        entering ? 'dock-card-enter' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onAnimationEnd={() => setEntering(false)}
    >
      <DockCardChromeProvider>
        <DockCardHostFrame baseScrollKey={baseScrollKey}>{body}</DockCardHostFrame>
      </DockCardChromeProvider>

      <style>{`
        @keyframes dockCardIn {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dock-card-enter {
          animation: dockCardIn 0.32s cubic-bezier(0.2, 0, 0, 1) both;
        }
      `}</style>
    </div>
  );
}

function DockCardHostFrame({
  children,
  baseScrollKey,
}: {
  children: ReactNode;
  baseScrollKey: string;
}) {
  const { chrome } = useDockCardChrome();

  const scrollKey = chrome.scrollKey
    ? `${baseScrollKey}:${chrome.scrollKey}`
    : baseScrollKey;
  const widthClass =
    chrome.contentWidth === 'sheet' ? 'mx-auto w-full max-w-[800px]' : 'mx-auto w-full max-w-sm';
  const hasFooter = chrome.footer != null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative shrink-0 px-3 pt-3">
        <div
          aria-hidden
          data-sheet-drag-handle
          className="mx-auto flex w-full flex-col items-center pb-1"
        >
          <span className={`h-0.5 w-8 rounded-full ${MAP_DOCK_HANDLE_CLASS}`} />
        </div>
      </div>

      {chrome.header != null ? (
        <div className="shrink-0 bg-transparent px-3 sm:px-4 pb-2">
          <div className={widthClass}>{chrome.header}</div>
        </div>
      ) : null}

      <DockScrollRegion
        scrollKey={scrollKey}
        className={MAP_SHEET_BODY_CLASS}
        style={
          {
            paddingBottom: hasFooter ? '0.75rem' : safePadBottom('1rem'),
          } as CSSProperties
        }
      >
        <div className={widthClass}>{children}</div>
      </DockScrollRegion>

      {hasFooter ? (
        <div
          className="shrink-0 bg-transparent px-3 sm:px-4 pt-2"
          style={{ paddingBottom: safePadBottomKeyboard('0.75rem') }}
        >
          <div className={widthClass}>{chrome.footer}</div>
        </div>
      ) : null}
    </div>
  );
}
