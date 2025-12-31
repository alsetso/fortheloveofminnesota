import Link from 'next/link';
import StateCheckbook from './components/StateCheckbook';

export default function GovContent() {
  return (
    <div className="space-y-3 mt-3">
      {/* State Checkbook */}
      <StateCheckbook />

      {/* Introduction */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          Understanding Minnesota Government
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          Understanding how Minnesota's government works is essential for anyone who lives, works, or does business in the state. Minnesota's system is designed to distribute power across multiple branches and levels of government, ensuring that no single office or individual controls decision-making. However, this structure can also make it difficult to know where authority actually lives and how residents can engage effectively.
        </p>
      </section>

      {/* Structure */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          The Structure of Minnesota Government
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          Minnesota operates under a constitutional system with three primary branches: <Link href="/gov/legislative" className="text-gray-900 underline font-medium">legislative</Link>, <Link href="/gov/executive" className="text-gray-900 underline font-medium">executive</Link>, and <Link href="/gov/judicial" className="text-gray-900 underline font-medium">judicial</Link>. Each branch has defined responsibilities and limitations, creating a system of checks and balances. Most laws and policies that affect daily life begin and evolve at the state and local levels, rather than at the federal level.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          At the center of lawmaking is the <Link href="/gov/legislative" className="text-gray-900 underline font-medium">Minnesota Legislature</Link>, which consists of the <Link href="/gov/org/mn-house" className="text-gray-900 underline font-medium">Minnesota House of Representatives</Link> and the <Link href="/gov/org/mn-senate" className="text-gray-900 underline font-medium">Minnesota Senate</Link>. The legislature is responsible for drafting laws, approving budgets, and overseeing state agencies. While final votes take place on the House and Senate floors, the majority of legislative power exists within committees. Committee chairs and members determine which bills are heard, amended, funded, or stalled. If a bill does not advance out of committee, it effectively ends — regardless of public attention or media coverage.
        </p>
      </section>

      {/* Governor */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          The Role of the Governor
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          The <Link href="/gov/org/governor" className="text-gray-900 underline font-medium">Governor of Minnesota</Link> serves as the head of the <Link href="/gov/executive" className="text-gray-900 underline font-medium">executive branch</Link> and plays a directional role in state government. The governor signs or vetoes legislation passed by the <Link href="/gov/legislative" className="text-gray-900 underline font-medium">legislature</Link>, appoints leadership for state agencies, proposes budgets, and may exercise limited emergency powers under specific legal conditions. While the governor influences priorities and execution, they do not write most laws and cannot act independently of legislative funding approvals. In practice, Minnesota governance relies heavily on negotiation and cooperation between the <Link href="/gov/legislative" className="text-gray-900 underline font-medium">legislative</Link> and <Link href="/gov/executive" className="text-gray-900 underline font-medium">executive branches</Link>.
        </p>
      </section>

      {/* State Agencies */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          State Agencies and Administrative Power
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          <Link href="/gov/executive" className="text-gray-900 underline font-medium">State agencies</Link> are responsible for turning laws into real-world action. Once legislation is passed, agencies interpret statutory language, develop administrative rules, enforce regulations, and manage implementation timelines. Agencies oversee areas such as transportation, education, health services, labor, environmental protection, and public safety. Many of the most significant impacts on residents occur during agency rulemaking and budget allocation, rather than during the initial passage of legislation. Public participation is often most effective during formal comment periods and hearings before rules are finalized.
        </p>
      </section>

      {/* Local Government */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          Local Government and Daily Impact
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          Local government in Minnesota holds substantial authority and directly affects residents' everyday lives. Cities, counties, school districts, and special districts control zoning decisions, property taxes, school operations, public works, law enforcement priorities, and local ordinances. While statewide policies set general frameworks, local governments determine how many services are delivered and how they are implemented. Understanding whether an issue is controlled at the city, county, school board, or <Link href="/gov/legislative" className="text-gray-900 underline font-medium">state level</Link> is critical for effective civic engagement.
        </p>
      </section>

      {/* Why It Matters */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          Why Understanding Government Structure Matters
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          Confusion about government structure often leads to misplaced frustration, ineffective advocacy, and disengagement. Many issues people attribute to federal officials or statewide offices are actually decided locally or administratively. By clearly identifying who holds authority over specific decisions, Minnesotans can participate more effectively, communicate with the appropriate officials, and better understand how public systems function.
        </p>
      </section>

      {/* Mission */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          Why For the Love of Minnesota Shares This Information
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          For the Love of Minnesota provides government information as a public reference, not as a political platform. This page exists to increase clarity, reduce misinformation, and help residents understand how decisions are made across the state. We do not promote parties, candidates, or policy positions. Instead, we focus on structure, roles, and responsibility — so Minnesotans can form their own opinions based on accurate information.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          Government works best when people understand it. Clear civic knowledge strengthens accountability, supports informed participation, and helps communities engage constructively with the systems that shape their cities, schools, land, and public services.
        </p>
      </section>

      {/* Conclusion */}
      <section className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
        <h2 className="text-xs font-semibold text-gray-900">
          A Shared Understanding of Minnesota
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          Minnesota is governed through a layered system that combines statewide leadership, agency administration, and strong local control. Laws begin in the <Link href="/gov/legislative" className="text-gray-900 underline font-medium">legislature</Link>, direction comes from the <Link href="/gov/executive" className="text-gray-900 underline font-medium">executive branch</Link>, interpretation flows through <Link href="/gov/executive" className="text-gray-900 underline font-medium">agencies</Link> and <Link href="/gov/judicial" className="text-gray-900 underline font-medium">courts</Link>, and daily impact is often felt locally. Understanding these relationships helps Minnesotans navigate government with confidence and realism.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          For the Love of Minnesota exists to make that understanding accessible — grounded in structure, geography, and facts — so the people who live here can better understand how Minnesota actually works.
        </p>
      </section>
    </div>
  );
}

