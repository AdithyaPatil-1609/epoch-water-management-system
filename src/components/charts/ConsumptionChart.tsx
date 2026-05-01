'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { DailyConsumption } from '@/lib/synthetic-data';

interface ConsumptionChartProps {
  data: DailyConsumption[];
}

export function ConsumptionChart({ data }: ConsumptionChartProps) {
  if (!data || data.length === 0) return null;

  // Find anomaly ranges to highlight
  const anomalyRanges: { start: number; end: number }[] = [];
  let currentStart = -1;
  
  data.forEach((d, i) => {
    if (d.isAnomaly && currentStart === -1) {
      currentStart = d.day;
    } else if (!d.isAnomaly && currentStart !== -1) {
      anomalyRanges.push({ start: currentStart - 0.5, end: d.day - 0.5 });
      currentStart = -1;
    }
  });
  if (currentStart !== -1) {
    anomalyRanges.push({ start: currentStart - 0.5, end: data[data.length - 1].day + 0.5 });
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur shadow-lg border border-slate-200 p-3 rounded-lg text-sm">
          <p className="font-medium text-slate-900 mb-1">Day {label}</p>
          <p className="text-slate-600 flex items-center justify-between gap-4">
            <span>Actual:</span>
            <span className="font-mono text-slate-900">{payload[0].value} ML</span>
          </p>
          <p className="text-slate-500 flex items-center justify-between gap-4 mt-0.5">
            <span>Baseline:</span>
            <span className="font-mono">{payload[1]?.value} ML</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis 
          dataKey="day" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          minTickGap={20}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}
          domain={['dataMin - 20', 'dataMax + 20']}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {anomalyRanges.map((range, i) => (
          <ReferenceArea 
            key={i}
            x1={range.start} 
            x2={range.end} 
            fill="#fee2e2" 
            fillOpacity={0.5} 
          />
        ))}

        <Line 
          type="monotone" 
          dataKey="baseline" 
          stroke="#cbd5e1" 
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line 
          type="monotone" 
          dataKey="consumption" 
          stroke="#0f172a" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
