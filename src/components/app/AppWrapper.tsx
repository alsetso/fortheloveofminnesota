'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import AppTopClient from './AppTopClient';
import AppContentWrapper from './AppContentWrapper';
import AppAgentPanel from './AppAgentPanel';

interface AppWrapperProps {
  children?: ReactNode;
  activeSection?: 'map' | 'search' | 'list' | 'profile';
  onSectionChange?: (section: 'map' | 'search' | 'list' | 'profile') => void;
  // Optional: If server data is provided, use it instead of fetching client-side
  serverUser?: { id: string; email: string } | null;
  serverAccount?: Account | null;
  serverProfiles?: Array<{ id: string; [key: string]: unknown }>;
}

export default function AppWrapper({ 
  children,
  activeSection = 'map',
  onSectionChange,
  serverUser,
  serverAccount,
  serverProfiles = [],
}: AppWrapperProps) {
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const { user: clientUser, isLoading: authLoading } = useAuth();
  const [account, setAccount] = useState<Account | null>(serverAccount || null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(!serverAccount);

  // Use server data if provided, otherwise fetch client-side
  const user: { id: string; email: string } | null = serverUser || (clientUser ? { id: clientUser.id, email: clientUser.email || '' } : null);
  const profiles = serverProfiles;

  // Fetch account data when user is authenticated (only if not provided server-side)
  useEffect(() => {
    if (serverAccount) {
      setAccount(serverAccount);
      setIsLoadingAccount(false);
      return;
    }

    if (!clientUser) {
      setAccount(null);
      setIsLoadingAccount(false);
      return;
    }

    const fetchAccount = async () => {
      try {
        setIsLoadingAccount(true);
        const accountData = await AccountService.getCurrentAccount();
        setAccount(accountData);
      } catch (error) {
        console.error('Error fetching account:', error);
        setAccount(null);
      } finally {
        setIsLoadingAccount(false);
      }
    };

    fetchAccount();
  }, [clientUser, serverAccount]);

  // Listen for agent panel toggle events
  useEffect(() => {
    const handleAgentPanelToggle = () => {
      setIsAgentPanelOpen(prev => !prev);
    };
    
    window.addEventListener('appAgentPanelToggle', handleAgentPanelToggle);
    return () => window.removeEventListener('appAgentPanelToggle', handleAgentPanelToggle);
  }, []);

  // Dispatch agent panel state changes to sync with AppTopClient
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('appAgentPanelState', { detail: { isOpen: isAgentPanelOpen } }));
  }, [isAgentPanelOpen]);

  // Handle close from AppAgentPanel
  const handleAgentPanelClose = () => {
    setIsAgentPanelOpen(false);
  };

  return (
    <div 
      className="fixed overflow-hidden bg-black"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
      }}
    >
      {/* Header - Uses server data if provided, otherwise fetches client-side */}
      <AppTopClient
        user={user}
        account={account}
        profiles={profiles}
        isAuthenticated={!!user}
      />

      {/* Main Content - Only this area refreshes on navigation */}
      <AppContentWrapper>
        {children}
      </AppContentWrapper>

      {/* Agent Panel - Right side panel on desktop, slide up on mobile */}
      <AppAgentPanel
        isOpen={isAgentPanelOpen}
        onClose={handleAgentPanelClose}
      />
    </div>
  );
}
