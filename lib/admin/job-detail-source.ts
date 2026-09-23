import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Concatenates the admin job detail route's page, its section components,
 * and the view-model that assembles them, comment-stripped — the same
 * treatment `job-lines.test.ts` and `checkout-turnaround.test.ts` already
 * apply to a single file. Those two tests read `page.tsx` as raw text to
 * pin two real regressions (decoration lines losing their source, the rush
 * flag disappearing); once the page was split into a view model and eleven
 * section components (11-point admin note), the strings they check for
 * moved out of `page.tsx` itself. Widening the reader to the whole route —
 * rather than editing either test's expectations — keeps both guards doing
 * exactly what they always did: proving the route still wires decoration
 * from `portalDecorations` and still keeps the rush flag, wherever in the
 * route that wiring now happens to live.
 */
export function readJobDetailRouteSource(): string {
  const root = resolve(process.cwd(), "app/admin/jobs/[id]");
  const componentsDir = resolve(root, "_components");
  const files = [
    resolve(root, "page.tsx"),
    ...readdirSync(componentsDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => resolve(componentsDir, f)),
    resolve(process.cwd(), "lib/admin/job-view.ts"),
  ];
  return files.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");
}
