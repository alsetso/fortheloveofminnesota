import BranchCard from './BranchCard';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import type { OrgWithRoles } from '@/features/civic/services/civicService';

interface ExecutiveBranchCardProps {
  branch: OrgWithRoles;
}

export default function ExecutiveBranchCard({ branch }: ExecutiveBranchCardProps) {
  return (
    <BranchCard
      branch={branch}
      icon={<BuildingOfficeIcon className="w-4 h-4" />}
      description="Headed by the Governor, the Executive Branch signs or vetoes legislation, appoints agency leadership, proposes budgets, and exercises limited emergency powers. State agencies turn laws into action through rulemaking and implementation."
      keyInfo={[
        'Governor signs or vetoes legislation passed by the legislature',
        'State agencies interpret laws and develop administrative rules',
        'Public participation is most effective during formal comment periods',
        'Many significant impacts occur during agency rulemaking, not initial legislation'
      ]}
      href="/gov/executive"
    />
  );
}

