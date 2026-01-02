'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import PersonAvatar from './PersonAvatar';
import type { OrgWithRoles } from '@/features/civic/services/civicService';

interface BranchCardProps {
  branch: OrgWithRoles;
  icon: ReactNode;
  description: string;
  keyInfo: string[];
  href: string;
}

export default function BranchCard({ branch, icon, description, keyInfo, href }: BranchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const keyEntities = branch.children?.slice(0, 3) || [];
  const remainingCount = (branch.children?.length || 0) - keyEntities.length;
  
  const getPrimaryPerson = (org: OrgWithRoles) => {
    const roles = org.roles?.filter(r => r.is_current) || [];
    return roles[0]?.person;
  };

  const getKeyPeople = () => {
    const people: Array<{ person: any; title: string }> = [];
    branch.roles?.filter(r => r.is_current).forEach(role => {
      if (role.person) {
        people.push({ person: role.person, title: role.title });
      }
    });
    branch.children?.forEach(child => {
      child.roles?.filter(r => r.is_current).forEach(role => {
        if (role.person && !people.find(p => p.person.id === role.person?.id)) {
          people.push({ person: role.person, title: role.title });
        }
      });
    });
    return people.slice(0, 3);
  };

  const keyPeople = getKeyPeople();

  return (
    <div className="bg-white rounded-md border border-gray-200 p-[10px] space-y-2">
      {/* Header */}
      <Link href={href} className="block group">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
            {icon}
          </div>
          <h3 className="text-xs font-semibold text-gray-900 group-hover:underline flex-1">
            {branch.name}
          </h3>
          <ChevronRightIcon className="w-3 h-3 text-gray-400" />
        </div>
      </Link>

      {/* Description */}
      <p className="text-[10px] text-gray-600 leading-relaxed">
        {description}
      </p>

      {/* Key Info Points */}
      {keyInfo.length > 0 && (
        <div className="space-y-0.5">
          {keyInfo.map((info, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full bg-gray-400 mt-1 flex-shrink-0" />
              <span className="text-[10px] text-gray-600">{info}</span>
            </div>
          ))}
        </div>
      )}

      {/* Key People */}
      {keyPeople.length > 0 && (
        <div className="border-t border-gray-100 pt-1.5 space-y-1">
          <div className="text-[10px] font-medium text-gray-700">Key Leadership</div>
          {keyPeople.map(({ person, title }) => (
            <Link
              key={person.id}
              href={`/gov/person/${person.slug || person.id}`}
              className="flex items-center gap-1.5 hover:bg-gray-50 rounded p-1 -mx-1 transition-colors group"
            >
              <PersonAvatar
                name={person.name}
                photoUrl={person.photo_url}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-gray-900 group-hover:underline truncate">
                  {person.name}
                </div>
                <div className="text-[9px] text-gray-500 truncate">{title}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Sub-Entities */}
      {keyEntities.length > 0 && (
        <div className="border-t border-gray-100 pt-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 w-full text-[10px] font-medium text-gray-700 hover:text-gray-900 transition-colors mb-1"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
            <span>Sub-Entities ({branch.children?.length || 0})</span>
          </button>
          
          {(isExpanded ? branch.children || [] : keyEntities).map((entity, idx) => {
            const person = getPrimaryPerson(entity);
            return (
              <Link
                key={entity.id || idx}
                href={`/gov/org/${entity.slug}`}
                className="flex items-center gap-1.5 hover:bg-gray-50 rounded p-1 -mx-1 transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="text-[10px] text-gray-700 group-hover:underline truncate flex-1">
                  {entity.name}
                </span>
                {person && (
                  <PersonAvatar
                    name={person.name}
                    photoUrl={person.photo_url}
                    size="xs"
                  />
                )}
              </Link>
            );
          })}
          
          {!isExpanded && remainingCount > 0 && (
            <Link
              href={href}
              className="block text-[10px] text-gray-500 hover:text-gray-700 mt-1"
            >
              +{remainingCount} more
            </Link>
          )}
        </div>
      )}

      {/* View Full Branch Link */}
      <div className="border-t border-gray-100 pt-1.5">
        <Link
          href={href}
          className="text-[10px] font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          View full branch →
        </Link>
      </div>
    </div>
  );
}

