import BranchCard from './BranchCard';
import { ScaleIcon } from '@heroicons/react/24/outline';
import type { OrgWithRoles } from '@/features/civic/services/civicService';

interface LegislativeBranchCardProps {
  branch: OrgWithRoles;
}

export default function LegislativeBranchCard({ branch }: LegislativeBranchCardProps) {
  return (
    <BranchCard
      branch={branch}
      icon={<ScaleIcon className="w-4 h-4" />}
      description="The Minnesota Legislature is a bicameral body responsible for drafting laws, approving budgets, and overseeing state agencies. Most legislative power exists within committees, where bills are heard, amended, funded, or stalled."
      keyInfo={[
        'Consists of House of Representatives (134 members) and Senate (67 members)',
        'Committee chairs determine which bills advance',
        'Bills that don\'t advance out of committee effectively end',
        'Final votes take place on House and Senate floors'
      ]}
      href="/gov/legislative"
    />
  );
}

