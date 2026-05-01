// Graph Algorithms: Dijkstra's shortest path + Prim's MST
// Used for water pipe network routing and coverage analysis

export interface GraphNode {
 id: string;
 lat: number;
 lng: number;
 adjacent: string[];
}

function geoDistance(a: GraphNode, b: GraphNode): number {
 const dx = (a.lat - b.lat) * 111;
 const dy = (a.lng - b.lng) * 111 * Math.cos(a.lat * Math.PI / 180);
 return Math.sqrt(dx * dx + dy * dy);
}

// ─── Binary Min-Heap (priority queue for A*) ──────────────────

class MinHeap<T> {
 private data: Array<{ priority: number; value: T }> = [];

 push(priority: number, value: T) {
 this.data.push({ priority, value });
 this.bubbleUp(this.data.length - 1);
 }

 pop(): T | undefined {
 if (this.data.length === 0) return undefined;
 const top = this.data[0].value;
 const last = this.data.pop()!;
 if (this.data.length > 0) {
 this.data[0] = last;
 this.sinkDown(0);
 }
 return top;
 }

 get size() { return this.data.length; }

 private bubbleUp(i: number) {
 while (i > 0) {
 const parent = Math.floor((i - 1) / 2);
 if (this.data[parent].priority <= this.data[i].priority) break;
 [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
 i = parent;
 }
 }

 private sinkDown(i: number) {
 const n = this.data.length;
 while (true) {
 let smallest = i;
 const l = 2 * i + 1, r = 2 * i + 2;
 if (l < n && this.data[l].priority < this.data[smallest].priority) smallest = l;
 if (r < n && this.data[r].priority < this.data[smallest].priority) smallest = r;
 if (smallest === i) break;
 [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
 i = smallest;
 }
 }
}

// ─── A* Search ────────────────────────────────────────────────
// f(n) = g(n) + h(n)
// g(n): actual geodesic cost from start
// h(n): admissible heuristic — straight-line distance to goal
// Complexity: O((E + V) log V) with the binary heap,
// much faster than Dijkstra's O(V²) scan on geographic graphs.

/** A* shortest path. Returns ordered zone_id array or [] if unreachable. */
export function aStar(nodes: Map<string, GraphNode>, startId: string, endId: string): string[] {
 const goal = nodes.get(endId);
 if (!goal || !nodes.has(startId)) return [];
 if (startId === endId) return [startId];

 const gCost = new Map<string, number>(); // best known cost from start
 const prev = new Map<string, string | null>();
 const closed = new Set<string>();

 gCost.set(startId, 0);
 prev.set(startId, null);

 const open = new MinHeap<string>();
 open.push(geoDistance(nodes.get(startId)!, goal), startId); // f = 0 + h

 while (open.size > 0) {
 const current = open.pop()!;
 if (current === endId) break;
 if (closed.has(current)) continue;
 closed.add(current);

 const node = nodes.get(current);
 if (!node) continue;

 for (const neighborId of node.adjacent) {
 if (closed.has(neighborId)) continue;
 const neighbor = nodes.get(neighborId);
 if (!neighbor) continue;

 const tentativeG = (gCost.get(current) ?? Infinity) + geoDistance(node, neighbor);
 if (tentativeG < (gCost.get(neighborId) ?? Infinity)) {
 gCost.set(neighborId, tentativeG);
 prev.set(neighborId, current);
 const f = tentativeG + geoDistance(neighbor, goal); // f = g + h
 open.push(f, neighborId);
 }
 }
 }

 // Reconstruct path
 const path: string[] = [];
 let cur: string | null = endId;
 while (cur !== null) {
 path.unshift(cur);
 cur = prev.get(cur) ?? null;
 }
 return path.length > 1 && path[0] === startId ? path : [];
}

/** Prim's MST. Returns edges as [fromId, toId] pairs. */
export function primsMST(nodes: Map<string, GraphNode>): Array<[string, string]> {
 if (nodes.size === 0) return [];
 const inMST = new Set<string>();
 const edges: Array<[string, string]> = [];
 const firstId = nodes.keys().next().value as string;
 inMST.add(firstId);

 while (inMST.size < nodes.size) {
 let bestEdge: [string, string] | null = null;
 let bestDist = Infinity;

 for (const id of inMST) {
 const node = nodes.get(id)!;
 for (const neighborId of node.adjacent) {
 if (inMST.has(neighborId)) continue;
 const neighbor = nodes.get(neighborId);
 if (!neighbor) continue;
 const d = geoDistance(node, neighbor);
 if (d < bestDist) { bestDist = d; bestEdge = [id, neighborId]; }
 }
 }
 if (!bestEdge) break;
 inMST.add(bestEdge[1]);
 edges.push(bestEdge);
 }
 return edges;
}
