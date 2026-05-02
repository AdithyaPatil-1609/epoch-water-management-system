export interface EmergencyEvent {
 id: string;
 region: string;
 type: 'fire risk' | 'hospital shortage' | 'pipeline burst' | 'critical infrastructure failure';
 severity: 'low' | 'medium' | 'high';
 required_resources: string[];
 status: 'active' | 'resolved';
 timestamp: string;
}

export let activeEmergencies: EmergencyEvent[] = [
 {
  id: 'emg-01',
  region: 'Zone-D',
  type: 'pipeline burst',
  severity: 'high',
  required_resources: ['Excavator Crew', 'Isolator Valves'],
  status: 'active',
  timestamp: new Date().toISOString(),
 }
];

export function getActiveEmergencies(): EmergencyEvent[] {
 return activeEmergencies.filter(e => e.status === 'active');
}

export function registerEmergency(event: Omit<EmergencyEvent, 'id' | 'status' | 'timestamp'>): EmergencyEvent {
 const newEvent: EmergencyEvent = {
  id: `emg-${Math.random().toString(36).substr(2, 6)}`,
  ...event,
  status: 'active',
  timestamp: new Date().toISOString(),
 };
 activeEmergencies.unshift(newEvent);
 return newEvent;
}

export function resolveEmergency(id: string): boolean {
 const ev = activeEmergencies.find(e => e.id === id);
 if (ev) {
  ev.status = 'resolved';
  return true;
 }
 return false;
}
