import { useEffect, useRef, useState } from "react";
import type { ReachSearchResult, ReachSearchSuggestion } from "../data/reachSearch";

type ReachSearchProps = {
  onSelect: (result: ReachSearchResult) => void;
};

type SearchStatus = "error" | "loading" | "ready" | "searching";

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

function queryFromSuggestion(suggestion: ReachSearchSuggestion) {
  if (suggestion.type === "reach") {
    return String(suggestion.record.reach_id);
  }

  return suggestion.label.replace(/\s+\(\d[\d,]* reaches\)$/, "");
}

export function ReachSearch({ onSelect }: ReachSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<ReachSearchSuggestion[]>([]);
  const [status, setStatus] = useState<SearchStatus>("loading");
  const onSelectRef = useRef(onSelect);
  const requestIdRef = useRef(0);
  const suppressNextQueryRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const shouldShowResults = isFocused && query.trim().length > 0;
  const isLoading = status === "loading";

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/reachSearch.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ReachSearchWorkerResponse>) => {
      const response = event.data;
      if (response.id !== requestIdRef.current) {
        return;
      }

      if (response.type === "error") {
        console.warn(response.message);
        setStatus("error");
        setResults([]);
        return;
      }

      if (response.type === "ready") {
        setStatus("ready");
        return;
      }

      if (response.type === "selected") {
        onSelectRef.current(response.result);
        setStatus("ready");
        return;
      }

      setStatus("ready");
      setResults(response.results);
    };

    requestIdRef.current += 1;
    worker.postMessage({ id: requestIdRef.current, type: "preload" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const worker = workerRef.current;

    if (suppressNextQueryRef.current) {
      suppressNextQueryRef.current = false;
      return;
    }

    if (!trimmedQuery || !worker) {
      setResults([]);
      return;
    }

    requestIdRef.current += 1;
    setStatus((currentStatus) => (currentStatus === "ready" ? "searching" : currentStatus));
    setResults([]);
    worker.postMessage({ id: requestIdRef.current, query: trimmedQuery, type: "query" });
  }, [query]);

  const selectSuggestion = (suggestion: ReachSearchSuggestion) => {
    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    requestIdRef.current += 1;
    suppressNextQueryRef.current = true;
    setQuery(queryFromSuggestion(suggestion));
    setIsFocused(false);
    worker.postMessage({ id: requestIdRef.current, suggestion, type: "select" });
  };

  return (
    <form
      className="reach-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (results[0]) {
          selectSuggestion(results[0]);
        }
      }}
    >
      <label htmlFor="reach-search-input">Search reaches</label>
      <div className="reach-search-input-row">
        <input
          autoComplete="off"
          id="reach-search-input"
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Reach ID or river name"
          type="search"
          value={query}
        />
        <button disabled={results.length === 0} type="submit">
          Go
        </button>
      </div>
      {shouldShowResults ? (
        <div className="reach-search-results">
          {isLoading ? <p>Loading search index.</p> : null}
          {status === "searching" ? <p>Searching.</p> : null}
          {status === "error" ? <p>Search is unavailable.</p> : null}
          {status === "ready" && results.length === 0 ? <p>No matches found.</p> : null}
          {status === "ready"
            ? results.map((result) => (
                <button
                  key={`${result.type}-${result.label}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    selectSuggestion(result);
                  }}
                  type="button"
                >
                  <span>{result.label}</span>
                  <small>{result.type === "reach" ? result.record.river_name || "Reach ID" : "River name"}</small>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </form>
  );
}
