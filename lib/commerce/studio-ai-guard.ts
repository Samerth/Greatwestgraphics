/**
 * The studio's own line in front of the image generator.
 *
 * Found on 16 September, with a real key: every OpenAI image model drew a
 * clean Nike swoosh with "Just Do It" when asked. OpenAI's safety system
 * blocks nudity, hate symbols, real people and political fakes, but it does
 * not treat a trademark as a problem - and under OpenAI's terms, and under
 * plain trademark law, printing that shirt is Great West Graphics' breach,
 * not the customer's and not OpenAI's.
 *
 * So the studio refuses these itself, before any money is spent and before
 * the request leaves our server. This is a word list, not an oracle: it
 * catches the brands a customer is likely to type, tells them why, and lets
 * a print shop that knows the rules stay out of trouble by default. Staff
 * remain the final check on every proof, as they are for uploaded art.
 *
 * Kept deliberately narrow - a customer's own company can be called
 * "Apple Valley Roofing" - so each entry is matched as a whole word or
 * phrase, platform names only fire as "<name> logo", and names that are
 * also animals, places or people ("puma", "patagonia", "mercedes") need a
 * cue word like "logo" or "official" in the same request.
 */

export class StudioAiGuardError extends Error {
  readonly code = "AI_GUARDED";
}

/** Marks that fire on their own - unambiguous brand names, slogans and
 * team names that are nothing else. Anything that is also an ordinary word
 * (flames, raptors, dove, shell, apple, mario) is NOT here: a school called
 * the Raptors and a church wanting a dove are real customers. */
const BRAND_TERMS: readonly string[] = [
  // Sportswear and streetwear, the ones a t-shirt customer reaches for first.
  "nike", "swoosh", "just do it", "adidas", "three stripes", "reebok",
  "under armour", "lululemon", "the north face", "north face", "carhartt",
  "champion logo", "supreme box logo", "off-white", "jordan brand", "air jordan",
  "jumpman", "yeezy", "ralph lauren", "tommy hilfiger", "vans logo",
  // Entertainment and characters.
  "disney", "mickey mouse", "minnie mouse", "spider-man", "spiderman", "batman",
  "superman", "pokemon", "pokémon", "pikachu", "hello kitty", "star wars",
  "darth vader", "harry potter", "nintendo", "super mario", "minecraft",
  "fortnite", "roblox", "barbie", "lego", "peppa pig", "paw patrol", "marvel logo",
  // Leagues and teams - full names, so the everyday words stay usable.
  "nhl", "nfl", "nba", "mlb", "fifa", "premier league", "canucks",
  "toronto maple leafs", "maple leafs", "montreal canadiens", "edmonton oilers",
  "calgary flames", "toronto raptors", "toronto blue jays", "bc lions",
  "vancouver whitecaps", "manchester united", "real madrid", "barcelona fc",
  // Everyday brands people ask for as a joke shirt.
  "coca-cola", "coca cola", "pepsi", "starbucks", "mcdonald's", "mcdonalds",
  "golden arches", "tim hortons", "monster energy", "playstation", "xbox",
  "ferrari", "porsche", "harley-davidson", "harley davidson", "toyota", "bmw",
  "gucci", "louis vuitton", "chanel", "prada", "versace", "rolex", "olympic rings",
  // Platforms: only their own mark. "A logo for our YouTube channel" is a
  // customer's own logo, not YouTube's.
  "instagram logo", "instagram icon", "facebook logo", "facebook icon",
  "tiktok logo", "tiktok icon", "youtube logo", "youtube icon", "youtube play button",
  "spotify logo", "netflix logo", "google logo", "microsoft logo", "apple logo",
  "amazon logo", "amazon smile",
];

/** Ambiguous names that are only a brand when the customer means the brand:
 * a cue word like "logo" or "official" has to sit in the same request. */
const CONTEXT_TERMS: readonly string[] = [
  "puma", "patagonia", "canada goose", "red bull", "converse", "mercedes",
  "jeep", "ford", "tesla", "crocs", "oakley", "ray-ban", "subway", "olympics",
  "marvel", "champion",
];
const CONTEXT_CUES = /\b(logo|brand|branding|trademark|official|emblem|swoosh|wordmark)\b/i;

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_PATTERNS = BRAND_TERMS.map(
  (term) => new RegExp(`(^|[^a-z0-9])${escapeForRegex(term)}([^a-z0-9]|$)`, "i"),
);
const CONTEXT_PATTERNS = CONTEXT_TERMS.map(
  (term) => new RegExp(`(^|[^a-z0-9])${escapeForRegex(term)}([^a-z0-9]|$)`, "i"),
);

/** The term that tripped the guard, or null when the text is clear. */
export function findGuardedTerm(text: string): string | null {
  const haystack = text.normalize("NFKC").toLowerCase();
  for (let i = 0; i < BRAND_PATTERNS.length; i += 1) {
    if (BRAND_PATTERNS[i]!.test(haystack)) return BRAND_TERMS[i]!;
  }
  if (CONTEXT_CUES.test(haystack)) {
    for (let i = 0; i < CONTEXT_PATTERNS.length; i += 1) {
      if (CONTEXT_PATTERNS[i]!.test(haystack)) return CONTEXT_TERMS[i]!;
    }
  }
  return null;
}

/**
 * Refuses a request that names a trademark. Reads every free-text field the
 * panel sends, so a brand hidden in "subjects" is caught the same as one in
 * "purpose".
 */
export function assertStudioAiPromptAllowed(fields: {
  purpose: string;
  subjects?: string;
}): void {
  const term = findGuardedTerm(`${fields.purpose}\n${fields.subjects ?? ""}`);
  if (term) {
    throw new StudioAiGuardError(
      `We can't create designs using trademarked names or logos like "${term}" unless you own the rights. Describe your own mark instead - what it is for, and what should be in it.`,
    );
  }
}
