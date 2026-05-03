import type { ReachSearchRecord } from "../types";

const searchIndexUrl = import.meta.env.VITE_SWORD_REACH_SEARCH_INDEX_JSON ?? "/tiles/reach_search_index.json";

type ReachSearchIndex = {
  schema_version: number;
  feature_count: number;
  records: ReachSearchRecord[];
};

export type ReachSearchResult =
  | {
      bbox?: [number, number, number, number];
      label: string;
      record: ReachSearchRecord;
      type: "reach";
    }
  | {
      bbox?: [number, number, number, number];
      label: string;
      records: ReachSearchRecord[];
      type: "river";
    };

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function mergeBbox(records: ReachSearchRecord[]): [number, number, number, number] | undefined {
  const boxes = records.map((record) => record.bbox).filter((bbox): bbox is [number, number, number, number] => Boolean(bbox));
  if (!boxes.length) {
    return undefined;
  }

  return boxes.reduce<[number, number, number, number]>(
    (merged, bbox) => [
      Math.min(merged[0], bbox[0]),
      Math.min(merged[1], bbox[1]),
      Math.max(merged[2], bbox[2]),
      Math.max(merged[3], bbox[3]),
    ],
    boxes[0],
  );
}

export async function loadReachSearchIndex(): Promise<ReachSearchRecord[]> {
  const response = await fetch(searchIndexUrl);
  if (!response.ok) {
    throw new Error(`Unable to load reach search index from ${searchIndexUrl}: ${response.status}`);
  }

  const index = (await response.json()) as ReachSearchIndex;
  return Array.isArray(index.records) ? index.records : [];
}

export function searchReaches(records: ReachSearchRecord[], query: string, limit = 8): ReachSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const exactReach = records.find((record) => String(record.reach_id) === query.trim());
  if (exactReach) {
    return [
      {
        bbox: exactReach.bbox,
        label: `Reach ${exactReach.reach_id}`,
        record: exactReach,
        type: "reach",
      },
    ];
  }

  const reachMatches = records
    .filter((record) => String(record.reach_id).includes(query.trim()))
    .slice(0, limit)
    .map<ReachSearchResult>((record) => ({
      bbox: record.bbox,
      label: `Reach ${record.reach_id}`,
      record,
      type: "reach",
    }));

  const riverGroups = new Map<string, ReachSearchRecord[]>();
  records.forEach((record) => {
    const riverName = record.river_name?.trim();
    if (!riverName || !riverName.toLowerCase().includes(normalizedQuery)) {
      return;
    }

    const key = riverName.toLowerCase();
    riverGroups.set(key, [...(riverGroups.get(key) ?? []), record]);
  });

  const riverMatches = [...riverGroups.values()]
    .sort((first, second) => {
      const firstName = first[0]?.river_name?.toLowerCase() ?? "";
      const secondName = second[0]?.river_name?.toLowerCase() ?? "";
      const firstExact = firstName === normalizedQuery ? 0 : 1;
      const secondExact = secondName === normalizedQuery ? 0 : 1;
      return firstExact - secondExact || second.length - first.length;
    })
    .slice(0, Math.max(0, limit - reachMatches.length))
    .map<ReachSearchResult>((group) => ({
      bbox: mergeBbox(group),
      label: `${group[0].river_name} (${group.length.toLocaleString()} reaches)`,
      records: group,
      type: "river",
    }));

  return [...reachMatches, ...riverMatches].slice(0, limit);
}

export function selectionRecords(result: ReachSearchResult): ReachSearchRecord[] {
  return result.type === "reach" ? [result.record] : result.records;
}
