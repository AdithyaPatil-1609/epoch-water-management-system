'use client';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface GiniGaugeProps {
  value: number; // 0 to 1
  label?: string;
}

export function GiniGauge({ value, label = "Gini Coefficient" }: GiniGaugeProps) {
  // Color logic: 0-0.2 (Green), 0.2-0.4 (Yellow), >0.4 (Red)
  let fill = '#10b981'; // emerald-500
  if (value > 0.2) fill = '#eab308'; // yellow-500
  if (value > 0.35) fill = '#f97316'; // orange-500
  if (value > 0.45) fill = '#ef4444'; // red-500

  const data = [{ name: 'Gini', value: value, fill }];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart 
          cx="50%" 
          cy="50%" 
          innerRadius="70%" 
          outerRadius="90%" 
          barSize={16} 
          data={data} 
          startAngle={180} 
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 1]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: '#f1f5f9' }} // slate-100
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center mt-6">
        <span className="text-4xl font-mono tracking-tighter text-slate-900">{value.toFixed(2)}</span>
        <span className="text-xs uppercase tracking-widest text-slate-500 mt-1">{label}</span>
      </div>
    </div>
  );
}
