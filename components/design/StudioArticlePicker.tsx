"use client";

import { useMemo, useState } from "react";
import {
  filterStudioArticles,
  type StudioArticleOption,
} from "@/lib/commerce/studio-garments";

export function StudioArticlePicker({
  articles,
  onPick,
}: {
  articles: readonly StudioArticleOption[];
  onPick: (representativeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterStudioArticles(articles, query),
    [articles, query],
  );

  return (
    <div className="min-w-0">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search garments"
        aria-label="Search garments"
        className="w-full min-w-0 rounded-sm border border-border bg-bg-raised px-3 py-2 text-sm font-semibold text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <ul className="mt-1.5 max-h-56 overflow-x-hidden overflow-y-auto rounded-md border border-border bg-bg-raised py-1">
        {filtered.length === 0 ? (
          <li className="px-2.5 py-2 text-[13px] text-text-tertiary">
            No garments match.
          </li>
        ) : (
          filtered.map((article) => (
            <li key={article.key}>
              <button
                type="button"
                onClick={() => onPick(article.representativeId)}
                className="flex w-full min-w-0 px-2.5 py-2 text-left text-[13px] font-semibold text-text-primary hover:bg-fill-subtle-15 hover:text-accent"
              >
                <span className="min-w-0 truncate">{article.label}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
