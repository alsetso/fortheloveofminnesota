'use client';

import { useState } from 'react';
import { ScaleIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface OrgNode {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children?: OrgNode[];
  party?: string;
}

function OrgCard({ node, level = 0, path = '' }: { node: OrgNode; level?: number; path?: string }) {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const nodePath = path ? `${path}-${level}` : `${level}`;
  const hasChildren = node.children && node.children.length > 0;
  const partyColor = node.party === 'DFL' ? 'text-blue-600' : 
                     node.party === 'Republican' ? 'text-red-600' : 
                     node.party ? 'text-gray-600' : '';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="space-y-1.5">
      <div 
        className={`bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors ${
          hasChildren ? 'cursor-pointer' : ''
        }`}
        onClick={handleToggle}
      >
        <div className="flex items-start gap-2">
          {hasChildren && (
            <div className="flex-shrink-0 mt-0.5">
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 text-gray-500" />
              )}
            </div>
          )}
          {!hasChildren && <div className="w-3" />}
          {node.icon && (
            <div className="flex-shrink-0 mt-0.5">
              {node.icon}
            </div>
          )}
          <div className="flex-1 space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-semibold text-gray-900">
                {node.title}
              </h3>
              {node.party && (
                <span className={`text-[10px] font-medium ${partyColor}`}>
                  {node.party}
                </span>
              )}
            </div>
            {node.subtitle && (
              <p className="text-xs text-gray-600">{node.subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {hasChildren && isExpanded && node.children && (
        <div className="space-y-1.5 ml-3">
          {node.children.map((child, idx) => (
            <OrgCard key={idx} node={child} level={level + 1} path={nodePath} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LegislativeChart() {
  const legislativeStructure: OrgNode = {
    title: 'Legislative Branch',
    icon: <ScaleIcon className="w-4 h-4 text-gray-500" />,
    children: [
      {
        title: 'Senate',
        subtitle: '67 Senators',
        children: [
          {
            title: 'Senate Majority Leader',
            subtitle: 'Kari Dziedzic',
            party: 'DFL',
          },
          {
            title: 'Senate Minority Leader',
            subtitle: 'Mark Johnson',
            party: 'Republican',
          },
          {
            title: 'Senate Members',
            subtitle: '67 total members',
          },
        ],
      },
      {
        title: 'House of Representatives',
        subtitle: '134 Representatives',
        children: [
          {
            title: 'House Speaker',
            subtitle: 'Melissa Hortman',
            party: 'DFL',
          },
          {
            title: 'House Majority Leader',
            subtitle: 'Jamie Long',
            party: 'DFL',
          },
          {
            title: 'House Minority Leader',
            subtitle: 'Lisa Demuth',
            party: 'Republican',
          },
          {
            title: 'House DFL Caucus Leader',
            subtitle: 'Zack Stephenson',
            party: 'DFL',
          },
          {
            title: 'House Members',
            subtitle: '134 total members',
          },
        ],
      },
    ],
  };

  return (
    <div className="space-y-1.5">
      <OrgCard node={legislativeStructure} level={0} />
    </div>
  );
}

