import Link from "next/link";

export function AdminPager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (nextPage: number) => string;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-sm font-bold text-accent">
          ← Previous
        </Link>
      ) : (
        <span className="text-sm text-text-tertiary">← Previous</span>
      )}
      <span className="text-sm text-text-secondary">
        Page {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="text-sm font-bold text-accent">
          Next →
        </Link>
      ) : (
        <span className="text-sm text-text-tertiary">Next →</span>
      )}
    </div>
  );
}
