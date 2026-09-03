import Link from "next/link";
import { redirect } from "next/navigation";
import { DESIGN_SIDE_LABELS, DesignSides } from "@gwg/contracts";
import { DesignThumbnail } from "@/components/admin/DesignThumbnail";
import { adminToken, getStaffSession } from "@/lib/admin/auth";
import {
  formatDesignTimestamp,
  toAdminDesignView,
  type AdminDesignView,
} from "@/lib/admin/designs";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

export default async function AdminDesignsPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login?next=/admin/designs");

  let designs: AdminDesignView[] = [];
  let error: string | undefined;
  try {
    const rows = await (
      await createCommerceClient()
    ).listAdminDesignProjects(adminToken(), { limit: PAGE_SIZE });
    designs = rows.map(toAdminDesignView);
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : caught instanceof Error
          ? caught.message
          : "Customer designs are unavailable right now.";
  }

  return (
    <div className="space-y-sp-4 max-w-6xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Customer artwork
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Designs</h1>
        <p className="text-sm text-text-secondary mt-1 mb-0">
          Every design a customer has saved from the studio. Open one to review
          the placement or edit it on their behalf.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!error && designs.length === 0 && (
        <p className="border border-border rounded-md p-sp-4 text-text-secondary m-0">
          No customer designs have been saved yet.
        </p>
      )}

      {designs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          {designs.map((design) => {
            const previewSide =
              DesignSides.find(
                (side) => design.design.artworksBySide[side].length > 0,
              ) ?? "front";
            const counts = DesignSides.map((side) => ({
              side,
              count: design.design.artworksBySide[side].length,
            })).filter((entry) => entry.count > 0);

            return (
              <article
                key={design.id}
                className="border border-border rounded-lg bg-bg-raised overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-fill-subtle-15 flex items-center justify-center">
                  <DesignThumbnail
                    proofImageUrl={design.proofImageUrl}
                    alt={design.name}
                    side={previewSide}
                    design={design.design}
                  />
                </div>
                <div className="p-sp-3 flex flex-col gap-2 flex-1">
                  <p className="font-bold m-0">{design.name}</p>
                  <p className="text-sm text-text-secondary m-0">
                    {design.customerName || "Unknown customer"}
                  </p>
                  {design.customerEmail && (
                    <p className="text-xs text-text-tertiary m-0 break-all">
                      {design.customerEmail}
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary m-0">
                    Updated {formatDesignTimestamp(design.updatedAt)}
                  </p>
                  <p className="text-xs text-text-secondary m-0">
                    {counts.length > 0
                      ? counts
                          .map(
                            (entry) =>
                              `${DESIGN_SIDE_LABELS[entry.side]}: ${design.design.placementBySide[entry.side]}`,
                          )
                          .join(" · ")
                      : "No artwork placed"}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-sp-2">
                    <Link
                      href={`/admin/designs/${encodeURIComponent(design.id)}`}
                      className="border border-border rounded-sm px-3 py-1.5 text-sm font-bold"
                    >
                      Review
                    </Link>
                    <Link
                      href={`/admin/designs/${encodeURIComponent(design.id)}/edit`}
                      className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
