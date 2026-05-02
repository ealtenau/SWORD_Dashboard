import type { NodeProfile } from "../types";

const nodeBaseUrl = import.meta.env.VITE_SWORD_NODE_BASE_URL ?? "/nodes";

function basinIdFromReachId(reachId: string) {
  return `hb${reachId.slice(0, 2)}`;
}

export async function loadNodeProfile(reachId: string): Promise<NodeProfile> {
  const basinId = basinIdFromReachId(reachId);
  const url = `${nodeBaseUrl}/${basinId}/${reachId}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load node profile from ${url}: ${response.status}`);
  }

  return (await response.json()) as NodeProfile;
}
