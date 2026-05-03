import { useMemo, useState } from "react";
import { searchReaches, type ReachSearchResult } from "../data/reachSearch";
import type { ReachSearchRecord } from "../types";

type ReachSearchProps = {
  isLoading: boolean;
  onSelect: (result: ReachSearchResult) => void;
  records: ReachSearchRecord[];
};

export function ReachSearch({ isLoading, onSelect, records }: ReachSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const results = useMemo(() => searchReaches(records, query), [query, records]);
  const shouldShowResults = isFocused && query.trim().length > 0;

  return (
    <form
      className="reach-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (results[0]) {
          onSelect(results[0]);
          setIsFocused(false);
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
          {!isLoading && results.length === 0 ? <p>No matches found.</p> : null}
          {!isLoading
            ? results.map((result) => (
                <button
                  key={`${result.type}-${result.label}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(result);
                    setQuery(result.label.replace(/\s+\(\d[\d,]* reaches\)$/, ""));
                    setIsFocused(false);
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
