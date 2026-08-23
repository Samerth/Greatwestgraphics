import Link from "next/link";
import { saveMappingAction } from "@/app/admin/actions";
import { AdminPager } from "@/components/admin/AdminPager";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import {
  groupMappings,
  mappedRows,
  mappingListHref,
  mappingMatchesQuery,
  MAPPING_PAGE_SIZE,
  parseMappingTab,
  unmappedRows,
  type MappingRow,
  type MappingTab,
} from "@/lib/admin/mapping-list";
import { paginate, parsePage } from "@/lib/admin/paged-list";

export const dynamic = "force-dynamic";

export default async function AdminCategoryMappingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const requestedTab = sp.tab ? parseMappingTab(sp.tab) : undefined;
  const requestedPage = parsePage(sp.page);

  const token = requireAdminToken();
  let mappings: Record<string, unknown>[] = [];
  let unmapped: Record<string, unknown>[] = [];
  let categories: Record<string, unknown>[] = [];
  let error: string | undefined;

  try {
    const [mapPayload, cats] = await Promise.all([
      (await adminClient()).getCategoryMappings(token),
      (await adminClient()).listCategories(token),
    ]);
    mappings = mapPayload.mappings;
    unmapped = mapPayload.unmapped;
    categories = cats;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Mappings unavailable";
  }

  const { mapsByKey, labelByKey } = groupMappings(mappings);
  const reviewAll = unmappedRows(unmapped, mapsByKey).filter((row) =>
    mappingMatchesQuery(row, q),
  );
  const mappedAll = mappedRows(mapsByKey, labelByKey).filter((row) =>
    mappingMatchesQuery(row, q),
  );
  const tab: MappingTab =
    requestedTab ?? (reviewAll.length > 0 ? "review" : "mapped");
  const source = tab === "review" ? reviewAll : mappedAll;
  const paged = paginate(source, requestedPage, MAPPING_PAGE_SIZE);

  const hasCategories = categories.length > 0;
  const categoryNames = new Map(
    categories.map((cat) => [String(cat.id), String(cat.name)]),
  );

  return (
    <div className="space-y-sp-5 max-w-5xl">
      <div>
        <Link href="/admin/categories" className="text-sm font-bold text-accent">
          ← Back to categories
        </Link>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0 mt-3">
          Connect vendors
        </p>
        <h1 className="font-display font-bold text-3xl m-0 mt-1">
          Vendor category mappings
        </h1>
        <p className="text-text-secondary mt-2 mb-0 max-w-2xl">
          Vendors (S&amp;S Activewear, Sanmar, and CSV imports) use their own
          category labels. This page connects those vendor labels to{" "}
          <strong>your</strong> Great West Graphics categories so products land
          in the right browse bucket on the website.
        </p>
        <p className="text-sm text-text-tertiary mt-2 mb-0 max-w-2xl">
          Note: if a product is assigned to categories by hand in Catalog, that
          choice wins over these mappings when you re-sync.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!hasCategories && !error && (
        <section className="border border-amber-200 bg-amber-50/50 rounded-md p-sp-4 space-y-2">
          <h2 className="font-display font-bold text-lg m-0">
            Create categories first
          </h2>
          <p className="text-sm text-text-secondary m-0">
            You don’t have any GWG categories yet. Add at least one (for example
            “T-Shirts”) before you can connect vendor labels.
          </p>
          <Link
            href="/admin/categories#add-category"
            className="inline-block text-sm font-bold text-accent"
          >
            Add a category →
          </Link>
        </section>
      )}

      {hasCategories && unmapped.length > 0 && tab === "review" && (
        <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-sp-2">
          <h2 className="font-display font-bold text-lg m-0">
            How to clear the “Needs review” list
          </h2>
          <ol className="m-0 pl-5 space-y-1.5 text-sm text-text-secondary">
            <li>
              Read the vendor label (what S&amp;S / Sanmar called it) and how
              many styles are waiting.
            </li>
            <li>
              Select one or more of <em>your</em> GWG categories that should
              include those products (hold Ctrl or Cmd to pick more than one).
            </li>
            <li>
              Click <strong>Save mapping</strong>. Those styles will use that
              category on the next sync / catalog refresh.
            </li>
          </ol>
        </section>
      )}

      <form
        className="border border-border rounded-md p-sp-3 bg-bg-raised flex flex-wrap gap-3 items-end"
        action="/admin/categories/mappings"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="text-sm font-semibold flex-1 min-w-[16rem]">
          Search vendor labels
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or vendor key…"
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          />
        </label>
        <button
          type="submit"
          className="bg-accent text-white font-bold px-4 py-2 rounded-sm text-sm"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <TabLink
          href={mappingListHref({ tab: "review", q })}
          active={tab === "review"}
          label={`Needs review (${unmapped.length.toLocaleString()})`}
        />
        <TabLink
          href={mappingListHref({ tab: "mapped", q })}
          active={tab === "mapped"}
          label={`Already mapped (${mapsByKey.size.toLocaleString()})`}
        />
      </div>

      <section className="space-y-sp-3">
        <div>
          <h2 className="font-display font-bold text-xl m-0">
            {tab === "review" ? "Needs review" : "Already mapped"}
          </h2>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            {tab === "review"
              ? "These vendor labels are not connected yet. Products under them won’t show in the right storefront category until you map them."
              : "Change the selected categories and click Update if a vendor label should point somewhere else."}{" "}
            Showing {MAPPING_PAGE_SIZE} labels at a time so this page stays
            usable after a large vendor sync.
          </p>
          <p className="text-sm text-text-tertiary mt-1 mb-0">
            {paged.total === 0
              ? q
                ? `No ${tab === "review" ? "unmapped" : "mapped"} labels match “${q}”.`
                : tab === "review"
                  ? "All caught up — nothing waiting for a mapping right now."
                  : "No mappings saved yet."
              : `Showing ${paged.start}–${paged.end} of ${paged.total.toLocaleString()}${
                  q ? ` matching “${q}”` : ""
                }.`}
          </p>
        </div>

        {paged.items.map((row) => (
          <MappingForm
            key={row.key}
            row={row}
            categories={categories}
            categoryNames={categoryNames}
            hasCategories={hasCategories}
            tab={tab}
            q={q}
            page={paged.page}
          />
        ))}

        <AdminPager
          page={paged.page}
          pageCount={paged.pageCount}
          hrefFor={(nextPage) => mappingListHref({ tab, q, page: nextPage })}
        />
      </section>
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`text-sm font-bold px-3 py-1.5 rounded-sm border ${
        active
          ? "bg-fill-subtle-15 border-border text-accent"
          : "border-transparent text-text-secondary hover:border-border"
      }`}
    >
      {label}
    </Link>
  );
}

function MappingForm({
  row,
  categories,
  categoryNames,
  hasCategories,
  tab,
  q,
  page,
}: {
  row: MappingRow;
  categories: Record<string, unknown>[];
  categoryNames: Map<string, string>;
  hasCategories: boolean;
  tab: MappingTab;
  q: string;
  page: number;
}) {
  const selectedNames = row.categoryIds
    .map((id) => categoryNames.get(id))
    .filter(Boolean);
  const review = tab === "review";

  return (
    <form
      action={saveMappingAction}
      className={`border rounded-md p-sp-4 space-y-sp-3 ${
        review
          ? "border-amber-200 bg-amber-50/40"
          : "border-border bg-bg-raised"
      }`}
    >
      <input type="hidden" name="ssCategoryKey" value={row.key} />
      <input type="hidden" name="ssCategoryLabel" value={row.label} />
      <input type="hidden" name="returnTab" value={tab} />
      <input type="hidden" name="returnQ" value={q} />
      <input type="hidden" name="returnPage" value={String(page)} />
      <div className="flex flex-wrap justify-between gap-2 items-start">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-wider m-0 ${
              review ? "text-amber-800/80" : "text-text-tertiary"
            }`}
          >
            Vendor label
          </p>
          <p className={`font-semibold m-0 mt-1 ${review ? "text-lg" : ""}`}>
            {row.label}
          </p>
          {row.label !== row.key && (
            <p className="text-xs text-text-tertiary m-0 mt-1 font-mono">
              Vendor key: {row.key}
            </p>
          )}
          {review ? (
            <p className="text-sm text-text-secondary m-0 mt-2">
              {row.styleCount} style{row.styleCount === 1 ? "" : "s"} waiting —
              choose where they should appear on your site.
            </p>
          ) : selectedNames.length > 0 ? (
            <p className="text-sm text-text-secondary m-0 mt-2">
              Currently: {selectedNames.join(", ")}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className={
            review
              ? "bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-50"
              : "text-sm font-bold text-accent px-3 py-1.5 border border-border rounded-sm hover:bg-fill-subtle-15"
          }
          disabled={!hasCategories}
        >
          {review ? "Save mapping" : "Update mapping"}
        </button>
      </div>
      {hasCategories ? (
        <label className="block text-sm font-semibold">
          {review ? "Put these products in…" : "Appears under…"}
          <select
            name="categoryIds"
            multiple
            size={Math.min(8, Math.max(4, categories.length))}
            defaultValue={row.categoryIds}
            className="block mt-2 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal bg-bg"
          >
            {categories.map((cat) => (
              <option key={String(cat.id)} value={String(cat.id)}>
                {String(cat.name)}
              </option>
            ))}
          </select>
          <span className="block mt-1 text-xs font-normal text-text-tertiary">
            Hold Ctrl or Cmd to select more than one category.
          </span>
        </label>
      ) : (
        <p className="text-sm text-text-secondary m-0">
          Add a GWG category first, then return here to map this label.
        </p>
      )}
    </form>
  );
}
