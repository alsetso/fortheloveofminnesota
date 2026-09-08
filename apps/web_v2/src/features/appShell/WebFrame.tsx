'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthSafe } from '@/features/auth';
import { usernamePath } from '@/lib/routes/routePolicy';
import './webFrame.css';

const navigation = [
  { href: '/feed', label: 'Feed', mark: '◫' },
  { href: '/game', label: 'Map', mark: '◎' },
  { href: '/discover', label: 'Discover', mark: '⌕' },
  { href: '/calendar', label: 'Calendar', mark: '▦' },
  { href: '/messages', label: 'Messages', mark: '✉' },
  { href: '/notifications', label: 'Notifications', mark: '◉' },
];

/** Web-only frame. The iOS feature screens remain inside the center stage. */
export default function WebFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { account } = useAuthSafe();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const active = navigation.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  const title = active?.label ?? (pathname === '/fly' ? 'Map' : pathname.startsWith('/settings') ? 'Settings' : 'Minnesota');

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('ftlomn:web:sidebar') === 'collapsed'); } catch { /* Storage is optional. */ }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const items = sidebarRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileOpen]);

  function toggleNavigation() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setMobileOpen((open) => !open);
    } else {
      setCollapsed((previous) => {
        const next = !previous;
        try { localStorage.setItem('ftlomn:web:sidebar', next ? 'collapsed' : 'expanded'); } catch { /* Storage is optional. */ }
        return next;
      });
    }
  }

  function closeNavigation() {
    setMobileOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <div className="web-frame" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
      <a className="web-skip" href="#web-main">Skip to content</a>
      {mobileOpen && <button className="web-scrim" aria-label="Close navigation" tabIndex={-1} onClick={closeNavigation} />}
      <aside ref={sidebarRef} id="web-navigation" className="web-sidebar" aria-label="Sidebar" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined}>
        <div className="web-brand-row">
          <Link href="/feed" className="web-brand" aria-label="For the Love of Minnesota home"><span className="web-monogram">MN</span><span className="web-nav-label">For the Love<br />of Minnesota</span></Link>
          <button className="web-drawer-close" onClick={closeNavigation} aria-label="Close navigation">×</button>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, mark }) => <Link key={href} href={href} title={label} aria-current={active?.href === href ? 'page' : undefined} className="web-nav-link"><span className="web-nav-mark" aria-hidden="true">{mark}</span><span className="web-nav-label">{label}</span></Link>)}
        </nav>
        <nav className="web-account-nav" aria-label="Your account">
          {account?.username && <Link className="web-nav-link" href={usernamePath(account.username)} title="Profile"><span className="web-nav-mark" aria-hidden="true">○</span><span className="web-nav-label">Profile</span></Link>}
          <Link className="web-nav-link" href="/settings" title="Settings"><span className="web-nav-mark" aria-hidden="true">⚙</span><span className="web-nav-label">Settings</span></Link>
        </nav>
      </aside>
      <section className="web-center" inert={mobileOpen || undefined}>
        <header className="web-section-header">
          <button ref={toggleRef} className="web-menu-button" onClick={toggleNavigation} aria-label="Toggle navigation" aria-controls="web-navigation" aria-expanded={mobileOpen || !collapsed}><span aria-hidden="true">☰</span></button>
          <h1>{title}</h1>
          <span className="web-header-brand">For the Love of Minnesota</span>
        </header>
        <main id="web-main" tabIndex={-1} className="web-main">{children}</main>
      </section>
      <aside className="web-context" aria-label="Explore Minnesota" inert={mobileOpen || undefined}>
        <p className="web-eyebrow">A little closer to home</p>
        <h2>Explore Minnesota</h2>
        <p>Places, people, and stories from across the state.</p>
        <Link href="/discover/places">Find your places <span aria-hidden="true">↗</span></Link>
        <Link href="/calendar">Community calendar <span aria-hidden="true">↗</span></Link>
        <Link href="/services">Local services <span aria-hidden="true">↗</span></Link>
        <div className="web-context-footer">For the Love of Minnesota</div>
      </aside>
    </div>
  );
}
