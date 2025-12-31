import BranchCard from './BranchCard';
import { ScaleIcon } from '@heroicons/react/24/outline';
import type { OrgWithRoles } from '@/features/civic/services/civicService';

interface JudicialBranchCardProps {
  branch: OrgWithRoles;
}

export default function JudicialBranchCard({ branch }: JudicialBranchCardProps) {
  return (
    <BranchCard
      branch={branch}
      icon={<ScaleIcon className="w-4 h-4" />}
      description="The Judicial Branch interprets laws and ensures they are applied fairly. It consists of the Supreme Court, Court of Appeals, and District Courts, which handle cases at different levels and ensure constitutional compliance."
      keyInfo={[
        'Supreme Court is the highest court in Minnesota',
        'Court of Appeals reviews decisions from district courts',
        'District Courts handle most trials and initial case proceedings',
        'Ensures laws are applied consistently and constitutionally'
      ]}
      href="/gov/judicial"
    />
  );
}

