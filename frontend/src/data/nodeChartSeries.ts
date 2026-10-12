import type { NodeProfile, NodeRecord } from "../types";

export type NodeChartPoint = { x: number; y: number; nodeIndex: number; segment: number };

export function nodeChartPoints(profile: NodeProfile, key: keyof NodeRecord): NodeChartPoint[] {
  const points: NodeChartPoint[] = [];
  let segment = 0;
  profile.nodes.forEach((node, nodeIndex) => {
    const value = node[key];
    if (typeof node.dist_out !== "number" || !Number.isFinite(node.dist_out) ||
        typeof value !== "number" || !Number.isFinite(value)) {
      segment += 1;
      return;
    }
    points.push({ x: node.dist_out / 1000, y: value, nodeIndex, segment });
  });
  return points;
}

export function nodeChartPath(
  points: NodeChartPoint[], xScale: (x: number) => number, yScale: (y: number) => number,
): string {
  return points.map((point, index) => {
    const command = index === 0 || point.segment !== points[index - 1].segment ? "M" : "L";
    return `${command}${xScale(point.x)},${yScale(point.y)}`;
  }).join(" ");
}
