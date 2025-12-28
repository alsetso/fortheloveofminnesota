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

export default function JudicialChart() {
  const judicialStructure: OrgNode = {
    title: 'Judicial Branch',
    icon: <ScaleIcon className="w-4 h-4 text-gray-500" />,
    children: [
      {
        title: 'District Court',
        subtitle: 'Trial courts',
        children: [
          {
            title: '10 Judicial Districts',
            subtitle: '87 counties',
          },
          {
            title: 'District Court Judges',
            subtitle: 'Trial court judges',
          },
        ],
      },
      {
        title: 'Court of Appeals',
        subtitle: 'Intermediate appellate court',
        children: [
          {
            title: 'Court of Appeals Judges',
            subtitle: '19 judges',
          },
          {
            title: 'Chief Judge',
            subtitle: 'Susan Segal',
          },
        ],
      },
      {
        title: 'Supreme Court',
        subtitle: 'Highest court',
        children: [
          {
            title: 'Chief Justice',
            subtitle: 'Natalie Hudson',
          },
          {
            title: 'Associate Justices',
            subtitle: '6 associate justices',
          },
        ],
      },
    ],
  };

  return (
    <div className="space-y-1.5">
      <OrgCard node={judicialStructure} level={0} />
    </div>
  );
}

