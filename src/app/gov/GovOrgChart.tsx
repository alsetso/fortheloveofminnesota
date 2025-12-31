'use client';

import Link from 'next/link';
import type { OrgWithRoles } from '@/features/civic/services/civicService';
import LegislativeBranchCard from '@/features/civic/components/LegislativeBranchCard';
import ExecutiveBranchCard from '@/features/civic/components/ExecutiveBranchCard';
import JudicialBranchCard from '@/features/civic/components/JudicialBranchCard';

interface GovOrgChartProps {
  branches: OrgWithRoles[];
}

export default function GovOrgChart({ branches }: GovOrgChartProps) {
  // Find branches
  const legislativeBranch = branches.find(b => b.org_type === 'branch' && b.slug === 'legislative');
  const executiveBranch = branches.find(b => b.org_type === 'branch' && b.slug === 'executive');
  const judicialBranch = branches.find(b => b.org_type === 'branch' && b.slug === 'judicial');

  return (
    <div className="space-y-3">
      {/* Citizens of Minnesota - Top */}
      <div className="bg-white rounded-md border-2 border-gray-300 p-[10px] space-y-1.5">
        <h2 className="text-sm font-semibold text-gray-900 text-center">
          Citizens of Minnesota
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed text-center">
          Minnesota citizens hold the ultimate power through voting, public participation, and direct engagement with government. Citizens elect representatives, provide input during <Link href="/gov/executive" className="text-gray-900 underline font-medium">agency rulemaking</Link> comment periods, participate in local government meetings, and shape policy through advocacy. Understanding where decisions are made—whether at the city council, school board, county commission, <Link href="/gov/legislative" className="text-gray-900 underline font-medium">state legislature</Link>, or <Link href="/gov/executive" className="text-gray-900 underline font-medium">agency level</Link>—enables citizens to engage effectively and hold government accountable.
        </p>
      </div>

      {/* Three Branches - Side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {legislativeBranch && (
          <LegislativeBranchCard branch={legislativeBranch} />
        )}
        {executiveBranch && (
          <ExecutiveBranchCard branch={executiveBranch} />
        )}
        {judicialBranch && (
          <JudicialBranchCard branch={judicialBranch} />
        )}
      </div>
    </div>
  );
}
