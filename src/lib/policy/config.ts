export interface PolicyMode {
 fairnessWeight: number;
 pressureWeight: number;
 emergencyPriorityWeight: number;
}

export let globalPolicyMode: PolicyMode = {
 fairnessWeight: 0.5,
 pressureWeight: 0.3,
 emergencyPriorityWeight: 0.2,
};

export function updatePolicyMode(newPolicy: Partial<PolicyMode>): PolicyMode {
 globalPolicyMode = {
  ...globalPolicyMode,
  ...newPolicy,
 };
 return globalPolicyMode;
}
