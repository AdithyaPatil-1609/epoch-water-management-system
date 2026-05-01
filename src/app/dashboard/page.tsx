'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ZoneHeatmap } from '@/components/map/ZoneHeatmap';
import { AnomalyDetailPanel } from '@/components/dashboard/AnomalyDetailPanel';
import { ProposalQueue } from '@/components/dashboard/ProposalQueue';
import { ZoneSummary } from '@/lib/synthetic-data';
import { RedistributionProposal } from '@/lib/fairness';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

export default function Dashboard() {
  const [data, setData] = useState<{
    zones: ZoneSummary[];
    criticalCount: number;
    deficitCount: number;
  } | null>(null);
  
  const [proposals, setProposals] = useState<RedistributionProposal[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch anomalies and zones
    fetch('/api/anomalies')
      .then((res) => res.json())
      .then((json) => {
        setData({
          zones: json.all_zones,
          criticalCount: json.critical_count,
          deficitCount: 0, // will update below
        });
      });

    // Fetch redistribution proposals
    fetch('/api/redistribute')
      .then((res) => res.json())
      .then((json) => {
        setProposals(json.proposals.slice(0, 3)); // Top 3 hot proposals
        setData(prev => prev ? { ...prev, deficitCount: json.deficit_count } : null);
      });
  }, []);

  if (!data) {
    return <div className="flex h-[100dvh] items-center justify-center text-slate-500">Loading Dashboard...</div>;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f9fafb]">
      <DashboardHeader 
        criticalCount={data.criticalCount} 
        totalZones={data.zones.length} 
        deficitCount={data.deficitCount} 
      />

      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100dvh-64px)]">
        {/* Left Column: Map (70% on desktop) */}
        <section className="lg:col-span-8 h-full flex flex-col relative rounded-xl bg-white shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl z-10">
            <h2 className="text-lg font-medium text-slate-900">Network Status</h2>
            <div className="flex gap-2 text-sm">
              <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium">{data.zones.length} Active Zones</span>
            </div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ZoneHeatmap 
              zones={data.zones} 
              selectedZoneId={selectedZoneId}
              onZoneSelect={(id) => setSelectedZoneId(id)}
            />
          </div>
        </section>

        {/* Right Column: Sidebar (30% on desktop) */}
        <section className="lg:col-span-4 h-full flex flex-col gap-6 overflow-y-auto pb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                Hot Proposals
              </h2>
              <Link href="/redistribution" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                View All <ArrowsLeftRight />
              </Link>
            </div>
            <ProposalQueue proposals={proposals} />
          </div>

          <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-5 text-white">
            <h3 className="text-sm uppercase tracking-widest text-slate-400 mb-2">System Alert</h3>
            <p className="text-lg font-medium">Anomaly Detection Engine Active</p>
            <p className="text-sm text-slate-400 mt-2">Isolation Forest model scanning 30-day rolling history every 15 minutes.</p>
          </div>
        </section>
      </main>

      <AnomalyDetailPanel 
        zoneId={selectedZoneId} 
        onClose={() => setSelectedZoneId(null)} 
      />
    </div>
  );
}
