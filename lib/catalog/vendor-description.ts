/**
 * Vendor product descriptions arrive as HTML fragments.
 *
 * S&S Activewear sends markup like `<ul><li>4.1 oz./yd²…</li></ul><p><strong>
 * Responsible Materials:</strong>…</p>`, which the product page rendered as a
 * React text child. React escapes it, so shoppers read the tags themselves.
 *
 * Rendering the fragment with `dangerouslySetInnerHTML` would fix the display
 * and hand a third-party feed the ability to inject script into our pages, so
 * this reduces the markup to text blocks instead. Only the structure we can
 * represent safely survives: list items become bullets, block elements become
 * paragraphs, and everything else is discarded down to its text. Bold and
 * underline are lost, which is a fair trade for not evaluating vendor HTML.
 */

export interface DescriptionBlock {
  kind: "bullet" | "paragraph";
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  // Vendor copy is full of these around units and labels. Collapsing the
  // no-break space to an ordinary one keeps later whitespace trimming honest.
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  reg: "®",
  trade: "™",
  copy: "©",
  deg: "°",
  sup2: "²",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const codePoint = body[1] === "x" || body[1] === "X"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      // Reject anything outside Unicode, plus surrogates, which throw.
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return match;
      }
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) return match;
      return String.fromCodePoint(codePoint);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

/** Collapses runs of whitespace, including the newlines vendors embed. */
function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return normalise(decodeEntities(value.replace(/<[^>]*>/g, " ")));
}

/**
 * Splits a vendor description into blocks. A description with no markup comes
 * back as a single paragraph, so plain-text vendors keep working unchanged.
 */
export function parseVendorDescription(
  html: string | null | undefined,
): DescriptionBlock[] {
  const source = html?.trim();
  if (!source) return [];

  if (!/<[a-z/][^>]*>/i.test(source)) {
    const text = normalise(decodeEntities(source));
    return text ? [{ kind: "paragraph", text }] : [];
  }

  // Script and style never carry product copy, and their contents would
  // otherwise survive tag stripping as visible text.
  const cleaned = source.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    " ",
  );

  const blocks: DescriptionBlock[] = [];
  // Break on list items and on the block elements vendors actually use, so
  // that separate thoughts do not run together into one line.
  const pattern = /<li\b[^>]*>([\s\S]*?)(?=<\/li\s*>|<li\b|<\/[uo]l\s*>|$)|<(?:p|div|h[1-6])\b[^>]*>([\s\S]*?)(?=<\/(?:p|div|h[1-6])\s*>|<(?:p|div|h[1-6])\b|$)/gi;

  let match: RegExpExecArray | null;
  let consumedAny = false;
  while ((match = pattern.exec(cleaned)) !== null) {
    consumedAny = true;
    const isBullet = match[1] !== undefined;
    const text = stripTags(match[1] ?? match[2] ?? "");
    if (text) blocks.push({ kind: isBullet ? "bullet" : "paragraph", text });
  }

  // Markup we did not recognise still has to render as something, and text
  // outside any block element would otherwise vanish silently.
  if (!consumedAny) {
    const text = stripTags(cleaned);
    return text ? [{ kind: "paragraph", text }] : [];
  }

  return blocks;
}

/** Total visible length, used to decide whether to offer a "show all" toggle. */
export function descriptionLength(blocks: DescriptionBlock[]): number {
  return blocks.reduce((total, block) => total + block.text.length, 0);
}
