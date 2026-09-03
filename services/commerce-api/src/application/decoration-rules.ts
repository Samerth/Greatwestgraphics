/**
 * Which decoration methods and print locations are available for a product,
 * resolved from the category admin controls it (CodSphere UAT V2,
 * "Product-Specific Decoration Methods & Print Locations" — "GWG should be
 * able to control which decoration methods and decoration locations are
 * available for each product or product category through the Admin Panel").
 *
 * `null` means unrestricted — every enabled method / every location is
 * available, exactly today's behaviour. Only a category an admin has
 * actually edited carries a real allow-list.
 */
export type ResolvedDecorationRules = {
  methods: string[] | null;
  locations: string[] | null;
};

/** One category's own rule columns, as read straight off the row. */
export type CategoryDecorationRule = {
  allowedDecorationMethods: string[] | null | undefined;
  allowedDecorationLocations: string[] | null | undefined;
};

function firstNonEmpty(
  rules: CategoryDecorationRule[],
  pick: (rule: CategoryDecorationRule) => string[] | null | undefined,
): string[] | null {
  for (const rule of rules) {
    const value = pick(rule);
    if (value && value.length > 0) return value;
  }
  return null;
}

/**
 * Resolves the effective rule for a product from its categories, in
 * priority order — pass the product's own directly-assigned categories
 * first, then their parent departments, so a specific subcategory's rule
 * (if one is ever set) wins over its department's, but a department-level
 * rule (the common case — "Hats", "Bags") still applies to every product
 * filed under it. Methods and locations are resolved independently: one
 * category could restrict methods while a different one in the chain
 * restricts locations.
 */
export function resolveDecorationRules(
  rulesInPriorityOrder: CategoryDecorationRule[],
): ResolvedDecorationRules {
  return {
    methods: firstNonEmpty(rulesInPriorityOrder, (r) => r.allowedDecorationMethods),
    locations: firstNonEmpty(rulesInPriorityOrder, (r) => r.allowedDecorationLocations),
  };
}
