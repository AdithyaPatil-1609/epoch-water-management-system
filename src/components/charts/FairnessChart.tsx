'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { FairnessTrendPoint } from '@/lib/fairness-engine';

interface FairnessChartProps {
  data: FairnessTrendPoint[];
  showFulfillment?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const gini = payload.find((p: { dataKey: string }) => p.dataKey === 'gini');
  const fill = payload.find((p: { dataKey: string }) => p.dataKey === 'avg_fulfillment_pct');

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {gini && (
        <p className="text-slate-600">
          Gini:{' '}
          <span className="font-mono font-semibold text-slate-900">{gini.value.toFixed(3)}</span>
        </p>
      )}
      {fill && (
        <p className="text-slate-600">
          Avg Fulfillment:{' '}
          <span className="font-mono font-semibold text-emerald-700">{fill.value}%</span>
        </p>
      )}
    </div>
  );
};

export function FairnessChart({ data, showFulfillment = false }: FairnessChartProps) {
  // Show every 5th label to avoid crowding
  const tickFormatter = (value: string, index: number) => {
    if (index % 5 !== 0) return '';
    return value.slice(5); // MM-DD
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="gini"
          domain={[0, 0.3]}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v.toFixed(2)}
        />
        {showFulfillment && (
          <YAxis
            yAxisId="fill"
            orientation="right"
            domain={[60, 100]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        {/* Good/Fair threshold markers */}
        <ReferenceLine yAxisId="gini" y={0.25} stroke="#eab308" strokeDasharray="4 4" label={{ value: 'Fair', position: 'right', fontSize: 10, fill: '#ca8a04' }} />
        <ReferenceLine yAxisId="gini" y={0.35} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'Poor', position: 'right', fontSize: 10, fill: '#ea580c' }} />
        <Line
          yAxisId="gini"
          type="monotone"
          dataKey="gini"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#10b981' }}
        />
        {showFulfillment && (
          <Line
            yAxisId="fill"
            type="monotone"
            dataKey="avg_fulfillment_pct"
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
