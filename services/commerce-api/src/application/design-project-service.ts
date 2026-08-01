import { and, desc, eq } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import { designProjects } from "../db/schema.js";
import { ResourceNotFoundError } from "./job-request-service.js";

export class DesignProjectService {
  constructor(private readonly db: CommerceDatabase) {}

  async list(tenantId: string, personId: string) {
    return this.db
      .select()
      .from(designProjects)
      .where(
        and(
          eq(designProjects.tenantId, tenantId),
          eq(designProjects.personId, personId),
        ),
      )
      .orderBy(desc(designProjects.updatedAt));
  }

  async get(tenantId: string, personId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(designProjects)
      .where(
        and(
          eq(designProjects.tenantId, tenantId),
          eq(designProjects.personId, personId),
          eq(designProjects.id, id),
        ),
      )
      .limit(1);
    if (!row) throw new ResourceNotFoundError("Saved design not found");
    return row;
  }

  async save(
    tenantId: string,
    personId: string,
    input: {
      name: string;
      garmentProductId: string | null;
      artworksBySide?: unknown;
      proofImageUrl: string | null;
    },
    actor: Actor,
  ) {
    const [created] = await this.db
      .insert(designProjects)
      .values({
        tenantId,
        personId,
        name: input.name,
        garmentProductId: input.garmentProductId,
        artworksBySide: input.artworksBySide,
        proofImageUrl: input.proofImageUrl,
        createdBy: actor,
        source: { system: "storefront" },
      })
      .returning();
    if (!created) throw new Error("Failed to save design");
    return created;
  }

  async update(
    tenantId: string,
    personId: string,
    id: string,
    input: Partial<{
      name: string;
      garmentProductId: string | null;
      artworksBySide: unknown;
      proofImageUrl: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(designProjects)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(designProjects.tenantId, tenantId),
          eq(designProjects.personId, personId),
          eq(designProjects.id, id),
        ),
      )
      .returning();
    if (!updated) throw new ResourceNotFoundError("Saved design not found");
    return updated;
  }

  async delete(tenantId: string, personId: string, id: string) {
    const [deleted] = await this.db
      .delete(designProjects)
      .where(
        and(
          eq(designProjects.tenantId, tenantId),
          eq(designProjects.personId, personId),
          eq(designProjects.id, id),
        ),
      )
      .returning();
    if (!deleted) throw new ResourceNotFoundError("Saved design not found");
    return deleted;
  }
}
