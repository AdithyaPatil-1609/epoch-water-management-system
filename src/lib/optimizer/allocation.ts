import { globalPolicyMode } from '../policy/config';

export interface AllocationZoneInput {
 zone_id: string;
 zone_name: string;
 baseline_demand_ML: number;
 current_pressure_bar: number;
 current_inequality: number;
 is_emergency: boolean;
}

export interface OptimizedAllocationOutput {
 zone_id: string;
 zone_name: string;
 allocated_volume_ML: number;
 original_demand_ML: number;
}

export function optimizeAllocation(
 inputs: AllocationZoneInput[],
 totalWaterAvailableML: number,
 strategy: string = 'greedy'
): OptimizedAllocationOutput[] {
 const outputs: OptimizedAllocationOutput[] = [];
 const { fairnessWeight, pressureWeight, emergencyPriorityWeight } = globalPolicyMode;

 if (inputs.length === 0) return outputs;

 if (strategy === 'greedy') {
  // Compute individual allocation weights
  const scoredInputs = inputs.map(input => {
   let score = 1.0;

   // Increase priority if emergency
   if (input.is_emergency) {
    score += emergencyPriorityWeight * 2.5;
   }

   // Adjust for fairness and low pressure
   score += input.current_inequality * fairnessWeight;
   score += (4.0 - input.current_pressure_bar) * pressureWeight * 0.15;

   return { ...input, final_priority_score: score };
  });

  const sumScores = scoredInputs.reduce((sum, s) => sum + s.final_priority_score, 0);

  scoredInputs.forEach(input => {
   const ratio = sumScores > 0 ? input.final_priority_score / sumScores : 1 / inputs.length;
   const allocated_volume_ML = parseFloat(Math.min(input.baseline_demand_ML * 1.5, totalWaterAvailableML * ratio).toFixed(2));
   
   outputs.push({
    zone_id: input.zone_id,
    zone_name: input.zone_name,
    allocated_volume_ML,
    original_demand_ML: input.baseline_demand_ML,
   });
  });

  return outputs;
 }

 // Pluggable for future LP solvers (linear-programming)
 return inputs.map(input => ({
  zone_id: input.zone_id,
  zone_name: input.zone_name,
  allocated_volume_ML: input.baseline_demand_ML,
  original_demand_ML: input.baseline_demand_ML,
 }));
}
