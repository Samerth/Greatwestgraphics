import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import { deleteDesignAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MyDesignsPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/portal/designs");
  }

  let designs: Record<string, unknown>[] = [];
  let error: string | undefined;
  try {
    designs = await (await createCommerceClient()).listDesignProjects();
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : "Saved designs are unavailable right now.";
  }

  return (
    <section className="py-sp-8">
      <Container>
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Customer portal
        </p>
        <h1 className="font-display font-bold text-display-sm mb-sp-2">My Designs</h1>
        <p className="text-text-secondary mb-sp-5 max-w-[60ch]">
          Artwork you&apos;ve saved from the Design Studio. Reopen any of these to
          keep editing or apply it to a different garment.
        </p>

        {error && (
          <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-4">
            {error}
          </p>
        )}

        {!error && designs.length === 0 && (
          <div className="border border-border rounded-md p-sp-4 text-text-secondary flex flex-wrap items-center justify-between gap-3">
            <span>No saved designs yet.</span>
            <ButtonLink href="/design" size="sm">
              Open Design Studio
            </ButtonLink>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sp-3">
          {designs.map((design) => {
            const id = String(design.id);
            const proofImageUrl = design.proofImageUrl
              ? String(design.proofImageUrl)
              : null;
            return (
              <article
                key={id}
                className="border border-border rounded-lg bg-bg-raised overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-fill-subtle-15 flex items-center justify-center">
                  {proofImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proofImageUrl}
                      alt={String(design.name)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-text-tertiary text-sm">No preview</span>
                  )}
                </div>
                <div className="p-sp-3 flex flex-col gap-2 flex-1">
                  <p className="font-bold m-0">{String(design.name)}</p>
                  <p className="text-xs text-text-tertiary m-0">
                    Saved{" "}
                    {design.updatedAt
                      ? new Date(String(design.updatedAt)).toLocaleDateString("en-CA")
                      : ""}
                  </p>
                  <div className="mt-auto flex gap-2 pt-sp-2">
                    <ButtonLink
                      href={`/design?loadDesignId=${encodeURIComponent(id)}`}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      Open
                    </ButtonLink>
                    <form
                      action={async () => {
                        "use server";
                        await deleteDesignAction(id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm font-bold px-3 py-2 rounded-sm border border-border hover:border-red-300 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
