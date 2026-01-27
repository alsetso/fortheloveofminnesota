'use client';

import { useState } from 'react';
import { CursorArrowRaysIcon, MapPinIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { CursorArrowRaysIcon as CursorArrowRaysIconSolid, MapPinIcon as MapPinIconSolid, PencilSquareIcon as PencilSquareIconSolid } from '@heroicons/react/24/solid';
import { canUserPerformMapAction, type PlanLevel } from '@/lib/maps/permissions';
import type { MapData } from '@/types/map';

interface CollaborationToolsNavProps {
  onToolSelect?: (tool: 'click' | 'pin' | 'draw') => void;
  activeTool?: 'click' | 'pin' | 'draw' | null;
  map?: MapData | null;
  isOwner?: boolean;
  userContext?: {
    accountId: string;
    plan: PlanLevel;
    subscription_status: string | null;
    role?: 'owner' | 'manager' | 'editor' | null;
  } | null;
}

export default function CollaborationToolsNav({ 
  onToolSelect, 
  activeTool = null,
  map,
  isOwner = false,
  userContext
}: CollaborationToolsNavProps) {
  const [hoveredTool, setHoveredTool] = useState<'click' | 'pin' | 'draw' | null>(null);

  // Check if feature is enabled by owner (owner override)
  const isFeatureEnabled = (toolId: 'click' | 'pin' | 'draw') => {
    if (!map) return false;
    
    const collaboration = map.settings?.collaboration || {};
    const actionMap: Record<'click' | 'pin' | 'draw', 'allow_clicks' | 'allow_pins' | 'allow_areas'> = {
      click: 'allow_clicks',
      pin: 'allow_pins',
      draw: 'allow_areas',
    };
    
    const allowKey = actionMap[toolId];
    return collaboration[allowKey] === true;
  };

  // Check permissions for each tool
  const getToolPermission = (toolId: 'click' | 'pin' | 'draw') => {
    // Owner always has access
    if (isOwner) {
      return { allowed: true, reason: undefined, isOwnerOverride: false };
    }

    // Check if feature is enabled by owner
    const ownerEnabled = isFeatureEnabled(toolId);

    // If no map, show as disabled (but still visible)
    if (!map) {
      return { 
        allowed: false, 
        reason: 'disabled' as const,
        isOwnerOverride: false,
      };
    }

    // If no user context, show as disabled but indicate owner override if enabled
    if (!userContext) {
      return { 
        allowed: false, 
        reason: 'disabled' as const,
        isOwnerOverride: ownerEnabled,
      };
    }

    // Map action type for permission checking
    const actionMap: Record<'click' | 'pin' | 'draw', 'clicks' | 'pins' | 'areas'> = {
      click: 'clicks',
      pin: 'pins',
      draw: 'areas',
    };

    const action = actionMap[toolId];
    const permissionCheck = canUserPerformMapAction(action, map, userContext, isOwner);
    
    return {
      allowed: permissionCheck.allowed,
      reason: permissionCheck.reason,
      isOwnerOverride: ownerEnabled && !permissionCheck.allowed,
    };
  };

  const tools = [
    { id: 'click' as const, label: 'Click', icon: CursorArrowRaysIcon, iconSolid: CursorArrowRaysIconSolid },
    { id: 'pin' as const, label: 'Pin', icon: MapPinIcon, iconSolid: MapPinIconSolid },
    { id: 'draw' as const, label: 'Draw', icon: PencilSquareIcon, iconSolid: PencilSquareIconSolid },
  ].map(tool => ({
    ...tool,
    permission: getToolPermission(tool.id),
  }));

  const handleToolClick = (toolId: 'click' | 'pin' | 'draw') => {
    if (onToolSelect) {
      onToolSelect(toolId);
    }
  };

  // Render tool buttons (shared between mobile and desktop)
  const renderTools = () => (
    <>
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        const isHovered = hoveredTool === tool.id;
        const Icon = (isActive || isHovered) ? tool.iconSolid : tool.icon;
        const isDisabled = !tool.permission.allowed;
        const isOwnerOverride = tool.permission.isOwnerOverride;
        
        return (
          <button
            key={tool.id}
            onClick={() => {
              if (!isDisabled) {
                handleToolClick(tool.id);
              }
            }}
            onMouseEnter={() => !isDisabled && setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            disabled={isDisabled}
            className={`relative flex items-center justify-center w-8 h-8 rounded-md transition-all ${
              isDisabled
                ? 'opacity-40 cursor-not-allowed text-white/40'
                : isActive
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            aria-label={tool.label}
            title={isDisabled ? `${tool.label} is disabled` : tool.label}
          >
            <Icon className="w-4 h-4" />
            {isOwnerOverride && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
            )}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="absolute top-4 left-0 right-0 z-40 pointer-events-none">
      <div className="flex items-center justify-center px-4">
        <div className="bg-black rounded-lg border border-white/10 shadow-lg px-2 py-1.5 pointer-events-auto">
          <div className="flex items-center gap-1">
            {renderTools()}
          </div>
        </div>
      </div>
    </div>
  );
}
