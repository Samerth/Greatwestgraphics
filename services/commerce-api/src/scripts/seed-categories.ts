import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { loadEnvironment } from "../config.js";
import { createDatabase } from "../db/client.js";
import { categories } from "../db/schema.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Sections 1–4 of the GWG nav taxonomy (Apparel, Promotional Products,
 * Signs & Displays, Print Products). Sections 5–8 (Brands, Industries,
 * Services, Resources) are site navigation, not product categories, so
 * they're deliberately left out of this seed.
 *
 * Known slug collisions to review after seeding (see chat message):
 * - "Hoodies & Sweatshirts" will NOT match the existing "Hoodies and
 *   Crewnecks" category — it will create a second top-level parent.
 * - "Bags" appears under both Apparel and Promotional Products here and
 *   collapses to one "bags" parent; its "Tote Bags" child will collide
 *   with your existing standalone "Tote Bags" category and be skipped.
 */
const TAXONOMY: { name: string; children: string[] }[] = [
  { name: "T-Shirts", children: ["Short Sleeve", "Long Sleeve", "Heavyweight", "Lightweight", "Performance", "Tri-Blend", "Pocket Tees", "Organic", "Tall", "Women's", "Youth"] },
  { name: "Hoodies & Sweatshirts", children: ["Pullover Hoodies", "Zip Hoodies", "Crewnecks", "Quarter Zips", "Heavyweight", "Lightweight", "Performance", "Fleece", "Women's", "Youth"] },
  { name: "Polos", children: ["Cotton", "Performance", "Long Sleeve", "Women's", "Youth"] },
  { name: "Jackets", children: ["Softshell", "Rain Jackets", "Windbreakers", "Winter Jackets", "Bomber Jackets", "Insulated", "Fleece Jackets", "Packable Jackets"] },
  { name: "Vests", children: ["Softshell", "Fleece", "Insulated", "Puffy"] },
  { name: "Workwear", children: ["Hi-Vis Shirts", "Hi-Vis Hoodies", "Hi-Vis Jackets", "Work Shirts", "Work Pants", "Coveralls", "FR Apparel"] },
  { name: "Hats", children: ["Snapbacks", "Trucker Hats", "Dad Hats", "Fitted Hats", "Flexfit", "New Era", "Toques", "Beanies", "Bucket Hats", "Visors"] },
  { name: "Pants & Shorts", children: ["Joggers", "Sweatpants", "Athletic Pants", "Work Pants", "Shorts", "Cargo Shorts"] },
  { name: "Athletic Wear", children: ["Jerseys", "Teamwear", "Performance Shirts", "Compression", "Warm-Ups"] },
  { name: "Bags", children: ["Backpacks", "Duffel Bags", "Tote Bags", "Drawstring Bags", "Messenger Bags", "Laptop Bags", "Grocery Bags", "Cooler Bags"] },
  { name: "Women's Apparel", children: [] },
  { name: "Youth Apparel", children: [] },
  { name: "Accessories", children: ["Aprons", "Blankets", "Towels", "Gloves", "Scarves", "Socks", "Umbrellas"] },

  { name: "Drinkware", children: ["Water Bottles", "Tumblers", "Travel Mugs", "Coffee Mugs", "Glassware"] },
  { name: "Office", children: ["Pens", "Journals", "Notebooks", "Calendars", "Mouse Pads"] },
  { name: "Technology", children: ["USB Drives", "Chargers", "Power Banks", "Speakers", "Headphones"] },
  { name: "Awards", children: ["Plaques", "Crystal Awards", "Trophies", "Medals"] },
  { name: "Trade Show", children: ["Lanyards", "Name Badges", "Table Covers", "Booth Accessories"] },
  { name: "Outdoor", children: ["Coolers", "BBQ Sets", "Chairs", "Blankets"] },
  { name: "Health & Wellness", children: ["First Aid", "Sanitizer", "Fitness Items"] },
  { name: "Eco-Friendly", children: ["Bamboo", "Recycled Products", "Sustainable Drinkware", "Wheat Straw Products"] },

  { name: "Indoor Signs", children: ["Foam Board", "PVC", "Acrylic", "Aluminum", "Sintra", "Dibond"] },
  { name: "Outdoor Signs", children: ["Coroplast", "Aluminum Composite", "Yard Signs", "Parking Signs", "Construction Signs"] },
  { name: "Banners", children: ["Vinyl Banners", "Mesh Banners", "Pole Banners", "Double-Sided Banners"] },
  { name: "Banner Stands", children: ["Retractable Banner Stands", "X-Banners", "L-Banners"] },
  { name: "Trade Show Displays", children: ["Pop-Up Displays", "Fabric Displays", "Backdrops", "Table Throws", "Counters", "Kiosks"] },
  { name: "Window Graphics", children: ["Window Decals", "Perforated Vinyl", "Frosted Vinyl"] },
  { name: "Wall Graphics", children: ["Wall Murals", "Wall Decals", "Wallpaper"] },
  { name: "Floor Graphics", children: [] },
  { name: "Vehicle Graphics", children: ["Vehicle Decals", "Vehicle Magnets", "Fleet Graphics"] },
  { name: "Stickers & Labels", children: ["Die Cut", "Kiss Cut", "Roll Labels", "Window Stickers", "Bumper Stickers"] },
  { name: "Flags", children: ["Feather Flags", "Teardrop Flags", "Pole Flags"] },
  { name: "Tents & Canopies", children: [] },
  { name: "A-Frame Signs", children: [] },
  { name: "Posters", children: [] },
  { name: "Canvas Prints", children: [] },

  {
    name: "Print Products",
    children: ["Business Cards", "Flyers", "Brochures", "Booklets", "Postcards", "Presentation Folders", "Letterhead", "Envelopes", "NCR Forms", "Notepads", "Catalogs", "Menus", "Invitations", "Greeting Cards"],
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const environment = loadEnvironment();
  const tenantId =
    process.env.COMMERCE_DEV_TENANT_ID ||
    "11111111-1111-4111-8111-111111111111";
  const { db, close } = createDatabase(environment.DATABASE_URL);
  const actor = { type: "system" as const, displayName: "seed:categories" };

  console.log(
    apply
      ? `Applying category seed for tenant ${tenantId}…\n`
      : `DRY RUN — no changes will be made. Pass --apply to actually insert.\n`,
  );

  let createdTop = 0;
  let matchedTop = 0;
  let createdChild = 0;
  let skippedChild = 0;
  let reparentedChild = 0;
  let disambiguatedChild = 0;

  try {
    for (const top of TAXONOMY) {
      const topSlug = slugify(top.name);
      const [existingTop] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, topSlug)))
        .limit(1);

      let topId: string;
      if (existingTop) {
        matchedTop += 1;
        topId = existingTop.id;
        console.log(`= matched existing parent: "${top.name}" (${topSlug})`);
      } else {
        createdTop += 1;
        console.log(`+ ${apply ? "creating" : "would create"} parent: "${top.name}" (${topSlug})`);
        if (apply) {
          const [inserted] = await db
            .insert(categories)
            .values({ tenantId, name: top.name, slug: topSlug, parentId: null, sortOrder: 0, createdBy: actor })
            .onConflictDoNothing()
            .returning();
          if (!inserted) {
            // Someone else inserted it between our select and insert — refetch.
            const [row] = await db
              .select()
              .from(categories)
              .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, topSlug)))
              .limit(1);
            topId = row!.id;
          } else {
            topId = inserted.id;
          }
        } else {
          topId = "(dry-run, not created)";
        }
      }

      for (const childName of top.children) {
        const childSlug = slugify(childName);
        const [existingChild] = await db
          .select()
          .from(categories)
          .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, childSlug)))
          .limit(1);

                if (existingChild) {
          if (!existingChild.parentId && existingChild.id !== topId) {
            reparentedChild += 1;
            console.log(`  ~ ${apply ? "re-parenting" : "would re-parent"} "${childName}" (${childSlug}) to be under "${top.name}" (was top-level)`);
            if (apply) {
              await db
                .update(categories)
                .set({ parentId: topId })
                .where(eq(categories.id, existingChild.id));
            }
            continue;
          }

          if (existingChild.parentId === topId) {
            skippedChild += 1;
            console.log(`  - skip "${childName}" (${childSlug}) — already exists under "${top.name}"`);
            continue;
          }

          // Same name exists under a DIFFERENT parent (e.g. "Performance" under
          // T-Shirts already, now also needed under Polos). Disambiguate the
          // slug so both can coexist instead of silently dropping this one.
          const disambiguatedSlug = `${topSlug}-${childSlug}`;
          const [existingDisambiguated] = await db
            .select()
            .from(categories)
            .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, disambiguatedSlug)))
            .limit(1);

          if (existingDisambiguated) {
            skippedChild += 1;
            console.log(`  - skip "${childName}" (${childSlug}) — collides with another parent's child, and "${disambiguatedSlug}" also exists`);
            continue;
          }

          disambiguatedChild += 1;
          console.log(`  * ${apply ? "creating" : "would create"} child: "${childName}" (${disambiguatedSlug}) under "${top.name}" — disambiguated, "${childSlug}" already used under another parent`);
          if (apply) {
            await db
              .insert(categories)
              .values({ tenantId, name: childName, slug: disambiguatedSlug, parentId: topId, sortOrder: 0, createdBy: actor })
              .onConflictDoNothing();
          }
          continue;
        }

        createdChild += 1;
        console.log(`  + ${apply ? "creating" : "would create"} child: "${childName}" (${childSlug}) under "${top.name}"`);
        if (apply) {
          await db
            .insert(categories)
            .values({ tenantId, name: childName, slug: childSlug, parentId: topId, sortOrder: 0, createdBy: actor })
            .onConflictDoNothing();
        }
      }
    }

    console.log("\nSummary:");
    console.log(`  Parents matched to existing categories: ${matchedTop}`);
    console.log(`  Parents ${apply ? "created" : "that would be created"}: ${createdTop}`);
    console.log(`  Children ${apply ? "created" : "that would be created"}: ${createdChild}`);
    console.log(`  Children ${apply ? "re-parented" : "that would be re-parented"}: ${reparentedChild}`);
    console.log(`  Children ${apply ? "created with disambiguated slug" : "that would need a disambiguated slug"}: ${disambiguatedChild}`);
    console.log(`  Children skipped (already correctly placed elsewhere): ${skippedChild}`);
    if (!apply) {
      console.log("\nThis was a dry run. Review the plan above, then re-run with --apply to write to the database.");
    }
  } finally {
    await close();
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});