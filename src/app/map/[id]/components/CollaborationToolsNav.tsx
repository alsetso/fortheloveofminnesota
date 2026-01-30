'use client';

import { useState, useMemo, useCallback } from 'react';
import { 
  CursorArrowRaysIcon, 
  MapPinIcon, 
  PencilSquareIcon 
} from '@heroicons/react/24/outline';
import { 
  CursorArrowRaysIcon as CursorArrowRaysIconSolid, 
  MapPinIcon as MapPinIconSolid, 
  PencilSquareIcon as PencilSquareIconSolid 
} from '@heroicons/react/24/solid';
import { canUserPerformMapAction, type PlanLevel } from '@/lib/maps/permissions';
import type { MapData } from '@/types/map';

type ToolId = 'click' | 'pin' | 'draw';
type ViewAsRole = 'owner' | 'manager' | 'editor' | 'non-member';

interface CollaborationToolsNavProps {
  onToolSelect?: (tool: ToolId) => void;
  activeTool?: ToolId | null;
  map?: MapData | null;
  isOwner?: boolean;
  isMember?: boolean;
  userContext?: {
    accountId: string;
    plan: PlanLevel;
    subscription_status: string | null;
    role?: 'owner' | 'manager' | 'editor' | null;
  } | null;
  viewAsRole?: ViewAsRole;
  onJoinClick?: () => void;
  mapSettings?: {
    colors?: {
      owner?: string;
      manager?: string;
      editor?: string;
      'non-member'?: string;
    };
  } | null;
  /** When true, use default iOS grey (matches PageWrapper). When false, use map settings colors. */
  useDefaultAppearance?: boolean;
}

interface ToolConfig {
  id: ToolId;
  label: string;
  icon: typeof CursorArrowRaysIcon;
  iconSolid: typeof CursorArrowRaysIconSolid;
  actionKey: 'allow_clicks' | 'allow_pins' | 'allow_areas';
  permissionKey: 'clicks' | 'pins' | 'areas';
}

const OWNER_GRADIENT = 'linear-gradient(to right, #FFB700, #DD4A00, #5C0F2F)';
const BLACK_BACKGROUND = '#000000';
const GRADIENT_BORDER_COLOR = 'rgba(255, 183, 0, 0.4)'; // Matches gradient start color (#FFB700)
const BLACK_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';
/** Default iOS grey (matches PageWrapper when no custom map colors) */
const DEFAULT_IOS_BG = '#F2F2F7';
const DEFAULT_IOS_TEXT = '#3C3C43';

const TOOL_CONFIGS: ToolConfig[] = [
  { 
    id: 'click', 
    label: 'Click', 
    icon: CursorArrowRaysIcon, 
    iconSolid: CursorArrowRaysIconSolid,
    actionKey: 'allow_clicks',
    permissionKey: 'clicks',
  },
  { 
    id: 'pin', 
    label: 'Pin', 
    icon: MapPinIcon, 
    iconSolid: MapPinIconSolid,
    actionKey: 'allow_pins',
    permissionKey: 'pins',
  },
  { 
    id: 'draw', 
    label: 'Draw', 
    icon: PencilSquareIcon, 
    iconSolid: PencilSquareIconSolid,
    actionKey: 'allow_areas',
    permissionKey: 'areas',
  },
];

export default function CollaborationToolsNav({ 
  onToolSelect, 
  activeTool = null,
  map,
  isOwner = false,
  isMember = false,
  userContext,
  viewAsRole,
  onJoinClick,
  mapSettings,
  useDefaultAppearance = false,
}: CollaborationToolsNavProps) {
  const [hoveredTool, setHoveredTool] = useState<ToolId | null>(null);

  // Determine if we're showing non-member view
  const isNonMemberView = useMemo(() => {
    // If owner is viewing as non-member, show non-member view
    if (isOwner && viewAsRole === 'non-member') return true;
    // If not owner and not member, show non-member view
    if (!isOwner && !isMember) return true;
    return false;
  }, [isOwner, isMember, viewAsRole]);

  // Get background color: default iOS grey when useDefaultAppearance, else from mapSettings
  const backgroundColor = useMemo(() => {
    if (useDefaultAppearance) return DEFAULT_IOS_BG;
    if (!viewAsRole) return BLACK_BACKGROUND;
    
    const roleColor = mapSettings?.colors?.[viewAsRole];
    if (roleColor && roleColor.trim() !== '') {
      return roleColor;
    }
    
    return viewAsRole === 'owner' ? OWNER_GRADIENT : BLACK_BACKGROUND;
  }, [viewAsRole, mapSettings, useDefaultAppearance]);

  // Get border color based on background
  const borderColor = useMemo(() => {
    if (useDefaultAppearance) return 'rgba(0, 0, 0, 0.1)';
    const isGradient = backgroundColor.includes('gradient');
    return isGradient ? GRADIENT_BORDER_COLOR : BLACK_BORDER_COLOR;
  }, [backgroundColor, useDefaultAppearance]);

  const containerStyle = useMemo(
    () => ({
      background: backgroundColor,
      borderColor: borderColor,
      borderWidth: '1px',
      borderStyle: 'solid',
    }),
    [backgroundColor, borderColor]
  );

  const isLightAppearance = useDefaultAppearance || backgroundColor === DEFAULT_IOS_BG;

  const isFeatureEnabled = useCallback((tool: ToolConfig): boolean => {
    if (!map) return false;
    const collaboration = map.settings?.collaboration || {};
    return collaboration[tool.actionKey] === true;
  }, [map]);

  const getToolPermission = useCallback((tool: ToolConfig) => {
    // Non-member view: all tools disabled, show join prompt
    if (isNonMemberView) {
      const ownerEnabled = isFeatureEnabled(tool);
      return { 
        allowed: false, 
        reason: 'non_member' as const,
        isOwnerOverride: ownerEnabled,
      };
    }

    if (isOwner && viewAsRole !== 'non-member') {
      return { allowed: true, reason: undefined, isOwnerOverride: false };
    }

    const ownerEnabled = isFeatureEnabled(tool);

    if (!map) {
      return { 
        allowed: false, 
        reason: 'disabled' as const,
        isOwnerOverride: false,
      };
    }

    if (!userContext) {
      return { 
        allowed: false, 
        reason: 'disabled' as const,
        isOwnerOverride: ownerEnabled,
      };
    }

    const permissionCheck = canUserPerformMapAction(
      tool.permissionKey, 
      map, 
      userContext, 
      isOwner && viewAsRole !== 'non-member'
    );
    
    return {
      allowed: permissionCheck.allowed,
      reason: permissionCheck.reason,
      isOwnerOverride: ownerEnabled && !permissionCheck.allowed,
    };
  }, [isNonMemberView, isOwner, viewAsRole, map, userContext, isFeatureEnabled]);

  const tools = useMemo(
    () => TOOL_CONFIGS.map(tool => ({
      ...tool,
      permission: getToolPermission(tool),
    })),
    [getToolPermission]
  );

  const handleToolClick = useCallback((toolId: ToolId) => {
    // If non-member view, clicking any tool should trigger join flow
    if (isNonMemberView && onJoinClick) {
      onJoinClick();
      return;
    }
    
    if (onToolSelect) {
      onToolSelect(toolId);
    }
  }, [isNonMemberView, onJoinClick, onToolSelect]);

  const handleToolHover = useCallback((toolId: ToolId | null) => {
    setHoveredTool(toolId);
  }, []);

  return (
    <div className="absolute top-4 left-0 right-0 z-40 pointer-events-none">
      <div className="flex items-center justify-center px-4">
        <div 
          className="rounded-lg border shadow-lg px-2 py-1.5 pointer-events-auto transition-all"
          style={containerStyle}
        >
          <div className="flex items-center gap-1">
            {tools.map((tool) => {
              const isActive = activeTool === tool.id;
              const isHovered = hoveredTool === tool.id;
              const Icon = (isActive || isHovered) ? tool.iconSolid : tool.icon;
              const isDisabled = !tool.permission.allowed;
              const isOwnerOverride = tool.permission.isOwnerOverride;
              const isNonMemberDisabled = isNonMemberView && isDisabled;
              
              // For non-member view, allow clicking to trigger join
              const canClick = !isDisabled || isNonMemberView;
              
              return (
                <button
                  key={tool.id}
                  onClick={() => canClick && handleToolClick(tool.id)}
                  onMouseEnter={() => canClick && handleToolHover(tool.id)}
                  onMouseLeave={() => handleToolHover(null)}
                  disabled={!canClick}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                    isLightAppearance
                      ? isNonMemberDisabled
                        ? 'opacity-60 cursor-pointer text-[#3C3C43]/60 hover:opacity-80 hover:text-[#3C3C43]/80'
                        : isDisabled
                        ? 'opacity-40 cursor-not-allowed text-[#3C3C43]/40'
                        : isActive
                        ? 'bg-black/10 text-[#3C3C43]'
                        : 'text-[#3C3C43]/70 hover:text-[#3C3C43] hover:bg-black/5'
                      : isNonMemberDisabled
                      ? 'opacity-60 cursor-pointer text-white/60 hover:opacity-80 hover:text-white/80'
                      : isDisabled
                      ? 'opacity-40 cursor-not-allowed text-white/40'
                      : isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  aria-label={tool.label}
                  title={
                    isNonMemberDisabled 
                      ? `Join to use ${tool.label}` 
                      : isDisabled 
                      ? `${tool.label} is disabled` 
                      : tool.label
                  }
                >
                  <Icon className="w-4 h-4" />
                  {isOwnerOverride && !isNonMemberView && (
                    <div className={`absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border ${isLightAppearance ? 'border-gray-200' : 'border-white'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
