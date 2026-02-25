'use client';

import LineChart from './LineChart';

export interface YearlyDataPoint {
  year: string;
  employees: number;
  total_wages: number;
  avg_wages: number;
  overtime: number;
}

interface PayrollChartsProps {
  yearlyData: YearlyDataPoint[];
}

export default function PayrollCharts({ yearlyData }: PayrollChartsProps) {
  const labels = yearlyData.map((d) => d.year);
  const wagesData = yearlyData.map((d) => d.total_wages);
  const employeesData = yearlyData.map((d) => d.employees);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="border border-border rounded-md p-3 bg-surface">
        <LineChart
          labels={labels}
          datasets={[
            {
              label: 'Total Wages',
              data: wagesData,
            },
          ]}
          height={180}
          title="Total Wages by Fiscal Year"
        />
      </div>
      <div className="border border-border rounded-md p-3 bg-surface">
        <LineChart
          labels={labels}
          datasets={[
            {
              label: 'Total Employees',
              data: employeesData,
            },
          ]}
          height={180}
          title="Total Employees by Fiscal Year"
        />
      </div>
    </div>
  );
}
