import { saveSettingsAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  let settings: Record<string, unknown> | null = null;
  let error: string | undefined;
  try {
    settings = await adminClient().getCatalogSettings(requireAdminToken());
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Settings unavailable";
  }

  const allowlist = Array.isArray(settings?.brandAllowlist)
    ? (settings!.brandAllowlist as string[]).join("\n")
    : "";

  return (
    <div className="space-y-sp-4 max-w-xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Tenant
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Settings</h1>
        <p className="text-text-secondary mt-2 mb-0">
          Retail price = max(MAP, cost × markup). Floor never below MAP.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <form
        action={saveSettingsAction}
        className="border border-border rounded-md p-sp-4 space-y-sp-3 bg-bg-raised"
      >
        <label className="block text-sm font-semibold">
          Retail markup multiplier
          <input
            name="retailMarkup"
            type="number"
            step="0.01"
            min="1"
            defaultValue={String(settings?.retailMarkup ?? "2.0")}
            className="mt-1 w-full border border-border rounded-sm px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Brand allowlist (optional, one per line)
          <textarea
            name="brandAllowlist"
            rows={6}
            defaultValue={allowlist}
            placeholder="Leave empty to sync all brands"
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 font-mono text-sm"
          />
        </label>
        <p className="text-xs text-text-tertiary m-0">
          Staff note: S&S credentials live in server env (
          SS_ACCOUNT_NUMBER / SS_API_KEY), not in this form.
        </p>
        <button
          type="submit"
          className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
        >
          Save settings
        </button>
      </form>
    </div>
  );
}
