import Link from "next/link";
import { redirect } from "next/navigation";
import { DesignStudio } from "@/components/design/DesignStudio";
import { adminToken, getStaffSession } from "@/lib/admin/auth";
import { toAdminDesignView, type AdminDesignView } from "@/lib/admin/designs";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export const dynamic = "force-dynamic";

export default async function AdminDesignEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getStaffSession();
  const { id } = await params;
  if (!session) redirect(`/admin/login?next=/admin/designs/${id}/edit`);

  let loaded: AdminDesignView | null = null;
  let error: string | undefined;
  let catalog: Awaited<ReturnType<typeof loadStorefrontCatalog>> | null = null;
  try {
    const [row, loadedCatalog] = await Promise.all([
      (await createCommerceClient()).getAdminDesignProject(adminToken(), id),
      // Same limit the storefront studio uses: the catalog is sorted
      // brand-then-style, so a small limit only ever offers one brand.
      loadStorefrontCatalog({ limit: 150 }),
    ]);
    loaded = toAdminDesignView(row);
    catalog = loadedCatalog;
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : caught instanceof Error
          ? caught.message
          : "Design unavailable";
  }

  if (!loaded || !catalog) {
    return (
      <div className="space-y-sp-3">
        <Link href="/admin/designs" className="text-sm font-bold text-accent">
          ← Designs
        </Link>
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3">
          {error || "Not found"}
        </p>
      </div>
    );
  }

  const design = loaded;
  const garments = catalog.products
    .filter((p) => p.available)
    .map((p) => ({
      id: p.id,
      label: p.name,
      colorName: p.colorName,
      brandName: p.brandName,
      styleName: p.styleName,
      imageUrl: p.imageUrl,
      sideImageUrl: p.sideImageUrl,
      backImageUrl: p.backImageUrl,
      isDark: p.isDark,
      slug: p.slug,
    }));

  return (
    <div className="space-y-sp-4">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <Link
            href={`/admin/designs/${encodeURIComponent(design.id)}`}
            className="text-sm font-bold text-accent"
          >
            ← {design.name}
          </Link>
          <h1 className="font-display font-bold text-3xl m-0 mt-2">
            Edit design
          </h1>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Editing on behalf of {design.customerName || "the customer"}
            {design.customerEmail ? ` (${design.customerEmail})` : ""}. Saving
            overwrites what they see in their portal.
          </p>
        </div>
      </div>

      <DesignStudio
        mode="staff"
        garments={garments}
        signedIn
        initialDesign={{
          id: design.id,
          name: design.name,
          garmentProductId: design.garmentProductId,
          design: design.design,
        }}
        endpoints={{
          update: "/api/admin/designs",
          // Filed under the owning customer so they can still see a layer
          // staff added: the upload reader only serves a customer artwork
          // that sits under their own person id.
          upload: design.personId
            ? `/api/admin/uploads?personId=${encodeURIComponent(design.personId)}`
            : "/api/admin/uploads",
        }}
      />
    </div>
  );
}
