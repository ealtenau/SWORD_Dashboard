import type { ReachSearchRecord } from "../types";

export const searchIndexUrl = import.meta.env.VITE_SWORD_REACH_SEARCH_INDEX_JSON ?? "/tiles/reach_search_index.json";

type ReachSearchIndex = {
  schema_version: number;
  feature_count: number;
  records: ReachSearchRecord[];
};

type RiverSearchGroup = {
  bbox?: [number, number, number, number];
  label: string;
  normalizedName: string;
  records: ReachSearchRecord[];
};

export type PreparedReachSearchIndex = {
  records: ReachSearchRecord[];
  reachById: Map<string, ReachSearchRecord>;
  riverGroups: RiverSearchGroup[];
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

export type ReachSearchSuggestion =
  | {
      bbox?: [number, number, number, number];
      label: string;
      record: ReachSearchRecord;
      type: "reach";
    }
  | {
      bbox?: [number, number, number, number];
      label: string;
      riverKey: string;
      type: "river";
    };

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeReachQuery(value: string) {
  return value.trim().replace(/^reach\s+/i, "");
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

export function prepareReachSearchIndex(records: ReachSearchRecord[]): PreparedReachSearchIndex {
  const reachById = new Map<string, ReachSearchRecord>();
  const riverGroupsByName = new Map<string, ReachSearchRecord[]>();

  records.forEach((record) => {
    reachById.set(String(record.reach_id), record);

    const riverName = record.river_name?.trim();
    if (!riverName) {
      return;
    }

    const normalizedName = riverName.toLowerCase();
    const group = riverGroupsByName.get(normalizedName);
    if (group) {
      group.push(record);
    } else {
      riverGroupsByName.set(normalizedName, [record]);
    }
  });

  const riverGroups = [...riverGroupsByName.entries()].map<RiverSearchGroup>(([normalizedName, group]) => ({
    bbox: mergeBbox(group),
    label: `${group[0].river_name} (${group.length.toLocaleString()} reaches)`,
    normalizedName,
    records: group,
  }));

  return { records, reachById, riverGroups };
}

export function searchPreparedReachIndex(index: PreparedReachSearchIndex, query: string, limit = 8): ReachSearchSuggestion[] {
  const normalizedQuery = normalizeSearchText(query);
  const reachQuery = normalizeReachQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const reachMatches: ReachSearchSuggestion[] = [];
  if (reachQuery) {
    const exactReach = index.reachById.get(reachQuery);
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

    for (const record of index.records) {
      const reachId = String(record.reach_id);
      if (reachId.includes(reachQuery) && reachMatches.length < limit) {
        reachMatches.push({
          bbox: record.bbox,
          label: `Reach ${record.reach_id}`,
          record,
          type: "reach",
        });
      }
    }

    if (reachMatches.length >= limit) {
      return reachMatches;
    }
  }

  const riverMatches = index.riverGroups
    .filter((group) => group.normalizedName.includes(normalizedQuery))
    .sort((first, second) => {
      const firstExact = first.normalizedName === normalizedQuery ? 0 : 1;
      const secondExact = second.normalizedName === normalizedQuery ? 0 : 1;
      return firstExact - secondExact || second.records.length - first.records.length;
    })
    .slice(0, Math.max(0, limit - reachMatches.length))
    .map<ReachSearchSuggestion>((group) => ({
      bbox: group.bbox,
      label: group.label,
      riverKey: group.normalizedName,
      type: "river",
    }));

  return [...reachMatches, ...riverMatches].slice(0, limit);
}

export function searchReaches(records: ReachSearchRecord[], query: string, limit = 8): ReachSearchResult[] {
  const index = prepareReachSearchIndex(records);
  return searchPreparedReachIndex(index, query, limit).map((suggestion) => selectionFromSearchSuggestion(index, suggestion));
}

export function selectionFromSearchSuggestion(
  index: PreparedReachSearchIndex,
  suggestion: ReachSearchSuggestion,
): ReachSearchResult {
  if (suggestion.type === "reach") {
    return {
      bbox: suggestion.bbox,
      label: suggestion.label,
      record: suggestion.record,
      type: "reach",
    };
  }

  const group = index.riverGroups.find((riverGroup) => riverGroup.normalizedName === suggestion.riverKey);
  return {
    bbox: suggestion.bbox,
    label: suggestion.label,
    records: group?.records ?? [],
    type: "river",
  };
}

export function selectionRecords(result: ReachSearchResult): ReachSearchRecord[] {
  return result.type === "reach" ? [result.record] : result.records;
}
