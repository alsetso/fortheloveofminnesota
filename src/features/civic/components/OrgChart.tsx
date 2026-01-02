'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, ChevronRightIcon, BuildingOfficeIcon, UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import type { OrgWithRoles } from '../services/civicService';
import PersonAvatar from './PersonAvatar';

interface OrgNode {
  id?: string;
  title: string;
  subtitle?: string;
  href?: string;
  icon?: React.ReactNode;
  children?: OrgNode[];
  party?: string;
  orgType?: string;
  roles?: Array<{ title: string; person?: { id: string; name: string; party?: string | null; slug?: string | null; photo_url?: string | null } }>;
}

function OrgCard({ node, level = 0 }: { node: OrgNode; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const hasRoles = node.roles && node.roles.length > 0;
  const partyColor = node.party === 'DFL' ? 'text-blue-600' : 
                     node.party === 'Republican' ? 'text-red-600' : 
                     node.party ? 'text-gray-600' : '';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren || hasRoles) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Get org type badge color
  const getOrgTypeBadge = () => {
    if (!node.orgType) return null;
    const colors: Record<string, string> = {
      branch: 'bg-blue-50 text-blue-700 border-blue-200',
      agency: 'bg-purple-50 text-purple-700 border-purple-200',
      department: 'bg-green-50 text-green-700 border-green-200',
      court: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return colors[node.orgType] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-1.5">
      {/* Organization Card */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-2">
          {/* Expand/Collapse Icon */}
          {(hasChildren || hasRoles) && (
            <button
              onClick={handleToggle}
              className="flex-shrink-0 mt-0.5 p-0.5 hover:bg-gray-100 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
          )}
          {!(hasChildren || hasRoles) && <div className="w-4" />}
          
          {/* Org Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {node.icon || <BuildingOfficeIcon className="w-4 h-4 text-gray-400" />}
          </div>

          {/* Org Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {node.href ? (
                <Link 
                  href={node.href} 
                  onClick={handleLinkClick} 
                  className="text-xs font-semibold text-gray-900 hover:underline"
                >
                  {node.title}
                </Link>
              ) : (
                <h3 className="text-xs font-semibold text-gray-900">
                  {node.title}
                </h3>
              )}
              {node.orgType && (
                <span className={`text-[9px] font-medium px-1 py-0.5 rounded border ${getOrgTypeBadge()}`}>
                  {node.orgType}
                </span>
              )}
            </div>
            {node.subtitle && (
              <p className="text-[10px] text-gray-500 mt-0.5">{node.subtitle}</p>
            )}
          </div>
        </div>

        {/* Roles Section - Always visible when expanded */}
        {isExpanded && hasRoles && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1 mb-1.5">
              <BriefcaseIcon className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Roles</span>
            </div>
            <div className="space-y-1.5">
              {(() => {
                // Group roles by title
                const rolesByTitle = new Map<string, typeof node.roles>();
                node.roles!.forEach(role => {
                  if (!rolesByTitle.has(role.title)) {
                    rolesByTitle.set(role.title, []);
                  }
                  rolesByTitle.get(role.title)!.push(role);
                });

                return Array.from(rolesByTitle.entries()).map(([title, roles]) => {
                  const rolePartyColor = roles?.[0]?.person?.party === 'DFL' ? 'text-blue-600' : 
                                         roles?.[0]?.person?.party === 'Republican' ? 'text-red-600' : 
                                         roles?.[0]?.person?.party ? 'text-gray-600' : '';
                  
                  return (
                    <div key={title} className="bg-gray-50 rounded border border-gray-100 p-1.5">
                      <div className="text-[10px] font-medium text-gray-700 mb-1">
                        {title}
                        {roles && roles.length > 1 && (
                          <span className="text-[9px] text-gray-500 ml-1 font-normal">
                            ({roles.length})
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {roles?.map((role, idx) => {
                          if (!role.person) return null;
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              <PersonAvatar 
                                name={role.person.name} 
                                photoUrl={role.person.photo_url}
                                size="xs"
                              />
                              {(role.person.slug || role.person.id) ? (
                                <Link 
                                  href={`/gov/person/${role.person.slug || role.person.id}`} 
                                  onClick={handleLinkClick} 
                                  className="text-[10px] text-gray-900 hover:underline flex items-center gap-1"
                                >
                                  <UserIcon className="w-3 h-3 text-gray-400" />
                                  {role.person.name}
                                </Link>
                              ) : (
                                <span className="text-[10px] text-gray-900 flex items-center gap-1">
                                  <UserIcon className="w-3 h-3 text-gray-400" />
                                  {role.person.name}
                                </span>
                              )}
                              {role.person.party && (
                                <span className={`text-[9px] font-medium ${rolePartyColor}`}>
                                  {role.person.party}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Child Organizations */}
      {isExpanded && hasChildren && node.children && (
        <div className="ml-4 space-y-1.5 border-l-2 border-gray-200 pl-2">
          {node.children.map((child, idx) => (
            <OrgCard key={child.id || idx} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function convertOrgToNode(org: OrgWithRoles, icon?: React.ReactNode): OrgNode {
  const roles = org.roles || [];
  const currentRoles = roles.filter(r => r.is_current);
  
  return {
    id: org.id,
    title: org.name,
    href: org.slug ? `/gov/org/${org.slug}` : undefined,
    icon,
    orgType: org.org_type,
    party: currentRoles[0]?.person?.party || undefined,
    roles: currentRoles.map(role => ({
      title: role.title,
      person: role.person ? {
        id: role.person.id,
        name: role.person.name,
        party: role.person.party,
        slug: role.person.slug || null,
        photo_url: role.person.photo_url || null,
      } : undefined,
    })),
    children: org.children?.map(child => convertOrgToNode(child)),
  };
}

interface OrgChartProps {
  org: OrgWithRoles | null;
  icon?: React.ReactNode;
}

export default function OrgChart({ org, icon }: OrgChartProps) {
  if (!org) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">No data available.</p>
      </div>
    );
  }

  const rootNode = convertOrgToNode(org, icon);

  return (
    <div className="space-y-1.5">
      <OrgCard node={rootNode} level={0} />
    </div>
  );
}
