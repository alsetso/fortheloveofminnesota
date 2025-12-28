'use client';

import { useState } from 'react';
import { BuildingOfficeIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface OrgNode {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children?: OrgNode[];
  party?: string;
}

function OrgCard({ node, level = 0, path = '' }: { node: OrgNode; level?: number; path?: string }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
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

export default function ExecutiveChart() {
  const executiveStructure: OrgNode = {
    title: 'Executive Branch',
    icon: <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />,
    children: [
      {
        title: 'Attorney General',
        subtitle: 'Keith Ellison',
        party: 'DFL',
      },
      {
        title: 'Secretary of State',
        subtitle: 'Steve Simon',
        party: 'DFL',
      },
      {
        title: 'GOVERNOR',
        subtitle: 'Tim Walz',
        party: 'DFL',
        children: [
          {
            title: 'Agencies',
          },
          {
            title: 'Boards, Commissions & Councils',
          },
          {
            title: 'Department of Commerce',
          },
          {
            title: 'Department of Corrections',
          },
          {
            title: 'Department of Employment & Economic Dev.',
          },
          {
            title: 'Minnesota Management & Budget',
          },
          {
            title: 'Department of Human Services',
          },
          {
            title: 'Department of Labor & Industry',
          },
          {
            title: 'Department of Public Safety',
          },
          {
            title: 'Department of Revenue',
          },
          {
            title: 'Department of Administration',
          },
          {
            title: 'Department of Agriculture',
          },
          {
            title: 'Department of Education',
          },
          {
            title: 'Department of Human Rights',
          },
          {
            title: 'Department of Health',
          },
          {
            title: 'Department of Natural Resources',
          },
          {
            title: 'Department of Military Affairs',
          },
          {
            title: 'Department of Veterans Affairs',
          },
          {
            title: 'Department of Transportation',
          },
          {
            title: 'Minnesota State Colleges & Universities',
          },
        ],
      },
      {
        title: 'Lieutenant Governor',
        subtitle: 'Peggy Flanagan',
        party: 'DFL',
      },
      {
        title: 'State Auditor',
        subtitle: 'Julie Blaha',
        party: 'DFL',
      },
    ],
  };

  return (
    <div className="space-y-1.5">
      <OrgCard node={executiveStructure} level={0} />
    </div>
  );
}

