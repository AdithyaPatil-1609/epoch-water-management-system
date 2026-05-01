'use client';
import { useState, useEffect } from 'react';
import { GiniGauge } from '@/components/charts/GiniGauge';
import { ProposalQueue } from '@/components/dashboard/ProposalQueue';
import { RedistributionProposal } from '@/lib/fairness';
import { Button } from '@/components/ui/Button';

export default function RedistributionPage() {
  const [fairnessWeight, setFairnessWeight] = useState(0.7);
  const [data, setData] = useState<{
    current_gini: number;
    projected_gini: number;
    deficit_count: number;
    surplus_count: number;
    proposals: RedistributionProposal[];
  } | null>(null);

  const fetchProposals = (weight: number) => {
    fetch(`/api/redistribute?fairness_weight=${weight}`)
      .then(res => res.json())
      .then(setData);
  };

  useEffect(() => {
    fetchProposals(fairnessWeight);
  }, []);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = parseFloat(e.target.value);
    setFairnessWeight(w);
    fetchProposals(w);
  };

  const handleApprove = async (id: string) => {
    await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_id: "manager_demo",
        action: "Approve",
        record_type: "proposal",
        record_id: id,
        comment: "Approved via Redistribution Dashboard"
      })
    });
    
    // Remove from UI temporarily to simulate action
    if (data) {
      setData({
        ...data,
        current_gini: data.projected_gini, // Assume projected becomes current
        proposals: data.proposals.filter(p => p.proposal_id !== id)
      });
    }
  };

  if (!data) return <div className="p-8 text-center text-slate-500">Loading Optimization Engine...</div>;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">
      <div className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-medium tracking-tight text-slate-900">Fairness Optimization</h1>
          <Button variant="outline" size="sm">Bulk Approve Safe</Button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Metrics Panel */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center">
            <h2 className="text-lg font-medium text-slate-900 self-start mb-4">Network Equality</h2>
            <div className="h-48 w-full max-w-xs">
              <GiniGauge value={data.current_gini} />
            </div>
            
            {data.projected_gini < data.current_gini && (
              <div className="mt-4 w-full py-3 px-4 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-800 flex justify-between items-center">
                <span>Projected Gini after proposals:</span>
                <span className="font-mono font-medium">{data.projected_gini.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-medium text-slate-900 mb-4">Capacity Status</h3>
            <div className="flex justify-between items-center mb-6">
              <div className="text-center">
                <div className="text-3xl font-mono text-emerald-600">{data.surplus_count}</div>
                <div className="text-xs uppercase tracking-widest text-slate-500 mt-1">Surplus Zones</div>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-mono text-orange-600">{data.deficit_count}</div>
                <div className="text-xs uppercase tracking-widest text-slate-500 mt-1">Deficit Zones</div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-700">Optimization Weight</label>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">{fairnessWeight.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={fairnessWeight}
                onChange={handleWeightChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Pressure Safety</span>
                <span>Fairness/Equity</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Proposals Queue */}
        <section className="lg:col-span-7">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-full">
            <h2 className="text-lg font-medium text-slate-900 mb-6">Recommended Actions</h2>
            <ProposalQueue proposals={data.proposals} onApprove={handleApprove} />
          </div>
        </section>
      </main>
    </div>
  );
}
