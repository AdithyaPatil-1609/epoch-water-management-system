// ──────────────────────────────────────────────────────────────
// In-memory decision store (replaces MongoDB for hackathon MVP)
// ──────────────────────────────────────────────────────────────

export interface Decision {
 decision_id: string;
 operator_id: string;
 action: string;
 record_type: "anomaly" | "proposal";
 record_id: string;
 comment: string;
 timestamp: string;
}

const decisions: Decision[] = [
 {
 decision_id: "dec-00001",
 operator_id: "ramesh_op",
 action: "Acknowledge",
 record_type: "anomaly",
 record_id: "Zone-D",
 comment: "Flagged for on-site inspection tomorrow morning",
 timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
 },
 {
 decision_id: "dec-00002",
 operator_id: "priya_mgr",
 action: "Approve",
 record_type: "proposal",
 record_id: "prop-001",
 comment: "Approved redistribution from Zone-R to Zone-D",
 timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
 },
 {
 decision_id: "dec-00003",
 operator_id: "ahmed_op",
 action: "Investigate",
 record_type: "anomaly",
 record_id: "Zone-G",
 comment: "Sending field team to check meter and pipeline",
 timestamp: new Date(Date.now() - 3600000).toISOString(),
 },
 {
 decision_id: "dec-00004",
 operator_id: "ramesh_op",
 action: "Resolve",
 record_type: "anomaly",
 record_id: "Zone-M",
 comment: "Event spike confirmed — stadium match on Apr 8-10",
 timestamp: new Date(Date.now() - 1800000).toISOString(),
 },
];

let counter = decisions.length;

export function getDecisions(): Decision[] {
 return [...decisions].sort(
 (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
 );
}

export function addDecision(input: Omit<Decision, "decision_id">): Decision {
 counter++;
 const decision: Decision = {
 ...input,
 decision_id: `dec-${String(counter).padStart(5, "0")}`,
 };
 decisions.push(decision);
 return decision;
}
