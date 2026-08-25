import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DESIGN_SIDE_LABELS,
  DesignSides,
  type DesignSide,
} from "@gwg/contracts";
import { DesignSidePreview } from "@/components/design/DesignSidePreview";
import {
  garmentBackdrops,
  type GarmentBackdrop,
} from "@/lib/commerce/garment-backdrop";
import { DEFAULT_SLEEVE_FILL_HEX } from "@/lib/commerce/studio-sleeve";
import { adminToken, getStaffSession } from "@/lib/admin/auth";
import {
  formatDesignTimestamp,
  toAdminDesignView,
  type AdminDesignView,
} from "@/lib/admin/designs";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export const dynamic = "force-dynamic";

/**
 * The garment photo is backdrop only — the print zone lives in
 * `placementBySide` plus the artwork transforms — so a catalog lookup that
 * fails degrades to the generic tee rather than taking the page down.
 */
async function loadGarmentBackdrops(
  garmentProductId: string | null,
): Promise<Record<DesignSide, GarmentBackdrop>> {
  if (!garmentProductId) return garmentBackdrops({});
  try {
    const detail = await (
      await createCommerceClient()
    ).getCatalogProduct(garmentProductId, adminToken());
    const product = (detail.product ?? {}) as Record<string, unknown>;
    const style = (detail.style ?? {}) as Record<string, unknown>;
    const pick = (record: Record<string, unknown>, key: string) =>
      typeof record[key] === "string" && record[key] ? String(record[key]) : null;
    return garmentBackdrops({
      colorFrontImageUrl: pick(product, "colorFrontImageUrl"),
      colorSideImageUrl: pick(product, "colorSideImageUrl"),
      colorBackImageUrl: pick(product, "colorBackImageUrl"),
      styleImageUrl: pick(style, "styleImageUrl"),
      styleName: pick(style, "styleName"),
    });
  } catch {
    return garmentBackdrops({});
  }
}

export default async function AdminDesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getStaffSession();
  const { id } = await params;
  if (!session) redirect(`/admin/login?next=/admin/designs/${id}`);

  let loaded: AdminDesignView | null = null;
  let error: string | undefined;
  try {
    const row = await (
      await createCommerceClient()
    ).getAdminDesignProject(adminToken(), id);
    loaded = toAdminDesignView(row);
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : caught instanceof Error
          ? caught.message
          : "Design unavailable";
  }

  if (!loaded) {
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
  const garmentBackdropsBySide = await loadGarmentBackdrops(design.garmentProductId);

  return (
    <div className="space-y-sp-4 max-w-5xl">
      <Link href="/admin/designs" className="text-sm font-bold text-accent">
        ← Designs
      </Link>

      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h1 className="font-display font-bold text-3xl m-0">{design.name}</h1>
          <p className="text-sm text-text-tertiary mt-1 mb-0">
            Customer design · saved from the studio
          </p>
        </div>
        <Link
          href={`/admin/designs/${encodeURIComponent(design.id)}/edit`}
          className="bg-accent text-white font-bold px-4 py-2 rounded-sm text-sm h-fit"
        >
          Open in the design studio
        </Link>
      </div>

      <section className="border border-border rounded-md p-sp-4 bg-bg-raised">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3 m-0">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
              Customer
            </dt>
            <dd className="m-0 mt-1 text-sm">
              {design.customerName || "Unknown"}
              {design.customerEmail && (
                <span className="block text-text-secondary break-all">
                  {design.customerEmail}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
              Garment product
            </dt>
            <dd className="m-0 mt-1 text-sm break-all">
              {design.garmentProductId ? (
                <Link
                  href={`/admin/catalog/${encodeURIComponent(design.garmentProductId)}`}
                  className="text-accent font-semibold"
                >
                  {design.garmentProductId}
                </Link>
              ) : (
                "No garment selected"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
              Created
            </dt>
            <dd className="m-0 mt-1 text-sm">
              {formatDesignTimestamp(design.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
              Updated
            </dt>
            <dd className="m-0 mt-1 text-sm">
              {formatDesignTimestamp(design.updatedAt)}
              {design.updatedBy && (
                <span className="block text-text-secondary">
                  by {design.updatedBy}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-sp-3">
        <h2 className="font-display font-bold text-lg m-0">
          Placement as the customer left it
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sp-3">
          {DesignSides.map((side) => {
            const artworkCount = design.design.artworksBySide[side].length;
            return (
              <figure
                key={side}
                className="border border-border rounded-md bg-bg-raised overflow-hidden m-0"
              >
                <div className="aspect-square bg-fill-subtle-15 flex items-center justify-center">
                  <DesignSidePreview
                    side={side}
                    design={design.design}
                    garmentImageUrl={garmentBackdropsBySide[side].url}
                    mirrorGarment={garmentBackdropsBySide[side].mirror}
                    garmentCrop={garmentBackdropsBySide[side].crop}
                    garmentPlate={garmentBackdropsBySide[side].plate}
                    garmentTintHex={
                      garmentBackdropsBySide[side].source === "side-view"
                        ? DEFAULT_SLEEVE_FILL_HEX
                        : undefined
                    }
                    size={200}
                  />
                </div>
                <figcaption className="p-sp-3">
                  <p className="font-bold text-sm m-0">
                    {DESIGN_SIDE_LABELS[side]}
                  </p>
                  <p className="text-xs text-text-secondary m-0 mt-1">
                    {design.design.placementBySide[side]}
                  </p>
                  <p className="text-xs text-text-tertiary m-0 mt-1">
                    {artworkCount === 0
                      ? "No artwork"
                      : `${artworkCount} layer${artworkCount === 1 ? "" : "s"}`}
                  </p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {design.proofImageUrl && (
        <section className="space-y-sp-3">
          <h2 className="font-display font-bold text-lg m-0">Saved proof</h2>
          <div className="border border-border rounded-md bg-bg-raised p-sp-3 max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={design.proofImageUrl}
              alt={`Proof for ${design.name}`}
              className="w-full object-contain"
            />
          </div>
        </section>
      )}
    </div>
  );
}
