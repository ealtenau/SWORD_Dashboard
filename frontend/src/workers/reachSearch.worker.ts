import {
  loadReachSearchIndex,
  prepareReachSearchIndex,
  searchPreparedReachIndex,
  selectionFromSearchSuggestion,
  type PreparedReachSearchIndex,
  type ReachSearchResult,
  type ReachSearchSuggestion,
} from "../data/reachSearch";

type ReachSearchWorkerRequest =
  | {
      id: number;
      type: "preload";
    }
  | {
      id: number;
      limit?: number;
      query: string;
      type: "query";
    }
  | {
      id: number;
      suggestion: ReachSearchSuggestion;
      type: "select";
    };

type ReachSearchWorkerResponse =
  | {
      id: number;
      recordCount: number;
      type: "ready";
    }
  | {
      id: number;
      message: string;
      type: "error";
    }
  | {
      id: number;
      results: ReachSearchSuggestion[];
      type: "results";
    }
  | {
      id: number;
      result: ReachSearchResult;
      type: "selected";
    };

let indexPromise: Promise<PreparedReachSearchIndex> | null = null;

function loadIndex() {
  indexPromise ??= loadReachSearchIndex().then(prepareReachSearchIndex);
  return indexPromise;
}

self.onmessage = (event: MessageEvent<ReachSearchWorkerRequest>) => {
  const request = event.data;

  void loadIndex()
    .then((index) => {
      if (request.type === "preload") {
        self.postMessage({
          id: request.id,
          recordCount: index.records.length,
          type: "ready",
        } satisfies ReachSearchWorkerResponse);
        return;
      }

      if (request.type === "select") {
        self.postMessage({
          id: request.id,
          result: selectionFromSearchSuggestion(index, request.suggestion),
          type: "selected",
        } satisfies ReachSearchWorkerResponse);
        return;
      }

      self.postMessage({
        id: request.id,
        results: searchPreparedReachIndex(index, request.query, request.limit),
        type: "results",
      } satisfies ReachSearchWorkerResponse);
    })
    .catch((error: unknown) => {
      self.postMessage({
        id: request.id,
        message: error instanceof Error ? error.message : "Unable to load reach search index.",
        type: "error",
      } satisfies ReachSearchWorkerResponse);
    });
};

export {};
