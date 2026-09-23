import Link from "next/link";
import { issueInvoiceAction, recordPaymentAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { buildJobView } from "@/lib/admin/job-view";
import { SectionCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OrderSummaryCard } from "./_components/OrderSummaryCard";
import { RushBanner } from "./_components/RushBanner";
import { OrderStatusCard } from "./_components/OrderStatusCard";
import { ProductLineCard } from "./_components/ProductLineCard";
import { InventorySummary } from "./_components/InventorySummary";
import { ArtworkAndProofs } from "./_components/ArtworkAndProofs";
import { CustomerCard } from "./_components/CustomerCard";
import { FulfillmentCard } from "./_components/FulfillmentCard";
import { OrderTotalCard } from "./_components/OrderTotalCard";
import { NotesSection } from "./_components/NotesSection";
import { JobTimeline } from "./_components/JobTimeline";

export const dynamic = "force-dynamic";

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let error: string | undefined;
  let detail: Awaited<
    ReturnType<Awaited<ReturnType<typeof adminClient>>["getJobRequestAsStaff"]>
  > | null = null;
  let storeName: string | null = null;

  try {
    const client = await adminClient();
    const token = requireAdminToken();
    const [d, stores] = await Promise.all([
      client.getJobRequestAsStaff(id, token),
      client.listAllStores(token).catch(() => []),
    ]);
    detail = d;
    storeName =
      (stores.find((s) => String(s.id) === String(d.context.storeId))?.name as
        | string
        | undefined) ?? null;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Job unavailable";
  }

  if (error || !detail) {
    return (
      <div className="space-y-sp-3">
        <Link href="/admin/jobs" className="text-sm font-bold text-accent">
          ← Jobs
        </Link>
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3">
          {error || "Not found"}
        </p>
      </div>
    );
  }

  // Everything below reads only `view` — see lib/admin/job-view.ts, which is
  // the one place this response gets pulled apart. That's deliberate: a
  // section component only ever sees its own narrow slice, so there is
  // nothing in scope here for this file to grow back into.
  const view = buildJobView(detail, storeName);

  return (
    <div className="space-y-sp-4 max-w-6xl">
      <Link href="/admin/jobs" className="text-sm font-bold text-accent">
        ← Jobs
      </Link>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl m-0">{view.header.displayId}</h1>
          <p className="text-sm text-text-tertiary mt-1 mb-0">
            Ordered from <b>{view.header.storeName}</b>
          </p>
        </div>
        <Badge tone={view.header.tone}>{view.header.statusLabel}</Badge>
      </div>

      <OrderSummaryCard view={view} />

      <RushBanner view={view} />

      {view.invoiceRequestedAt && (
        <p className="border border-accent bg-accent-tint rounded-md px-sp-3 py-sp-2 text-sm m-0">
          Customer requested a manual invoice on{" "}
          {new Date(view.invoiceRequestedAt).toLocaleString("en-CA")}.
        </p>
      )}

      {view.canTakePayment && (
        <section className="grid gap-sp-3 md:grid-cols-2">
          <form
            action={issueInvoiceAction}
            className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-2"
          >
            <input type="hidden" name="jobId" value={view.id} />
            <h2 className="font-display font-bold text-lg m-0">Issue invoice</h2>
            <p className="text-sm text-text-secondary m-0">
              Record that you sent payment instructions. The customer gets an email.
            </p>
            <label className="block text-sm font-semibold">
              Note
              <input
                name="note"
                placeholder="Invoice #, e-transfer email…"
                className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
              />
            </label>
            <button type="submit" className="bg-accent text-white font-bold px-4 py-2 rounded-sm">
              Mark invoice sent
            </button>
          </form>
          <form
            action={recordPaymentAction}
            className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-2"
          >
            <input type="hidden" name="jobId" value={view.id} />
            <h2 className="font-display font-bold text-lg m-0">Record payment</h2>
            <p className="text-sm text-text-secondary m-0">
              Use this when e-transfer, cheque, or a card over the phone lands.
            </p>
            <label className="block text-sm font-semibold">
              How it was received
              <input
                name="note"
                required
                placeholder="E-transfer from Sam, 18 Aug"
                className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
              />
            </label>
            <button type="submit" className="bg-accent text-white font-bold px-4 py-2 rounded-sm">
              Mark paid
            </button>
          </form>
        </section>
      )}

      <SectionCard title="Order status">
        <OrderStatusCard view={view} />
      </SectionCard>

      <div className="grid gap-sp-4 xl:grid-cols-3 items-start">
        <div className="xl:col-span-2 space-y-sp-4">
          <SectionCard
            title="Products & Decoration"
            aside={
              <span className="text-sm text-text-tertiary">
                {view.summary.quantity.toLocaleString("en-CA")}{" "}
                {view.summary.quantity === 1 ? "piece" : "pieces"} across {view.products.length}{" "}
                {view.products.length === 1 ? "product" : "products"}
              </span>
            }
          >
            <div className="space-y-sp-3">
              {view.products.map((product) => (
                <ProductLineCard key={product.key} product={product} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Artwork & Proofs">
            <ArtworkAndProofs
              jobId={view.id}
              customerPersonId={view.customerPersonId}
              proofs={view.proofs.versions}
              files={view.files}
            />
          </SectionCard>

          <SectionCard title="Inventory">
            <InventorySummary stock={view.stock} />
          </SectionCard>

          <SectionCard title="Order timeline">
            <JobTimeline timeline={view.timeline} />
          </SectionCard>
        </div>

        <div className="space-y-sp-4">
          <SectionCard title="Customer">
            <CustomerCard contact={view.contact} />
          </SectionCard>

          <SectionCard title="Fulfilment">
            <FulfillmentCard fulfillment={view.fulfillment} />
          </SectionCard>

          <SectionCard title="Quote / Order total">
            <OrderTotalCard jobId={view.id} money={view.money} />
          </SectionCard>

          <SectionCard title="Notes">
            <NotesSection view={view} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
