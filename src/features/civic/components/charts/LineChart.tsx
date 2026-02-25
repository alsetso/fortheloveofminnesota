'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  type ChartOptions,
  type ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/contexts/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
);

export interface LineChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
}

export interface LineChartProps {
  /** X-axis labels (e.g. years or categories) */
  labels: string[];
  /** One or more datasets to plot */
  datasets: LineChartDataset[];
  /** Chart height in pixels */
  height?: number;
  /** Optional chart title */
  title?: string;
}

/** Default line color when not provided (works in both themes) */
const DEFAULT_LINE = 'hsl(211 80% 50%)';
const DEFAULT_FILL = 'hsla(211, 80%, 50%, 0.1)';

export default function LineChart({ labels, datasets, height = 200, title, ...rest }: LineChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const textColor = isDark ? 'hsla(0, 0%, 70%, 0.95)' : 'hsla(0, 0%, 25%, 0.95)';
  const gridColor = isDark ? 'hsla(0, 0%, 70%, 0.15)' : 'hsla(0, 0%, 0%, 0.08)';

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: title
        ? {
            display: true,
            text: title,
            color: textColor,
            font: { size: 12 },
          }
        : undefined,
      tooltip: {
        titleColor: textColor,
        bodyColor: textColor,
        backgroundColor: isDark ? 'hsl(0, 0%, 18%)' : 'hsl(0, 0%, 100%)',
        borderColor: isDark ? 'hsla(0, 0%, 70%, 0.3)' : 'hsla(0, 0%, 0%, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, maxRotation: 45 },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
    },
  };

  const data: ChartData<'line'> = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.borderColor ?? DEFAULT_LINE,
      backgroundColor: ds.backgroundColor ?? DEFAULT_FILL,
      fill: ds.fill ?? true,
      tension: 0.25,
      pointRadius: 2,
      pointHoverRadius: 4,
    })),
  };

  return (
    <div style={{ height }} className="w-full">
      <Line data={data} options={options} {...rest} />
    </div>
  );
}
