import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("SanMar media password vs Bulk", () => {
  it("tells staff the media password does not unlock Bulk", () => {
    const page = read("app/admin/sync/page.tsx");
    expect(page).toContain("media password does not unlock Bulk");
    expect(page).toContain("up to 50 styles");
  });

  it("injects SANMAR_MEDIA_PASSWORD on the API task when the secret key exists", () => {
    const ecs = read("infra/cloudshell/scripts/09-create-ecs.sh");
    const retarget = read("infra/cloudshell/scripts/18-retarget-ecs.sh");
    expect(ecs).toContain('name:"SANMAR_MEDIA_PASSWORD"');
    expect(ecs).toContain("vendor_has_media");
    expect(retarget).toContain("SANMAR_MEDIA_PASSWORD");
  });
});
