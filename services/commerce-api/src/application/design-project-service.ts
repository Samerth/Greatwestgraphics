import { and, desc, eq } from "drizzle-orm";
import type { Actor, DesignDocument, DesignProjectWrite } from "@gwg/contracts";
import {
  assertDesignDocumentDurable,
  normalizeDesignDocument,
  toStoredDesignDocument,
} from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import { designProjects, people } from "../db/schema.js";
import { ResourceNotFoundError } from "./job-request-service.js";

type DesignProjectRow = {
  id: string;
  tenantId: string;
  personId: string;
  name: string;
  garmentProductId: string | null;
  artworksBySide: unknown;
  placementBySide: unknown;
  proofImageUrl: string | null;
  updatedBy: Actor | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * What every caller of this service sees: the stored columns plus the design
 * migrated forward into the current document shape, so no reader has to know
 * which generation of the studio wrote the row.
 */
export type DesignProjectView = Omit<
  DesignProjectRow,
  "artworksBySide" | "placementBySide"
> & {
  design: DesignDocument;
  /** Kept for older clients that read the raw artwork map directly. */
  artworksBySide: unknown;
  placementBySide: unknown;
};

function toView(row: DesignProjectRow): DesignProjectView {
  return { ...row, design: normalizeDesignDocument(row) };
}

export interface DesignProjectInput {
  name: string;
  garmentProductId: string | null;
  design: DesignDocument;
  proofImageUrl: string | null;
}

/**
 * Turns a validated write body into a patch, keeping "absent" and "explicitly
 * null" distinct — clearing a garment and not mentioning it are different
 * requests, and collapsing them would let a rename wipe the garment.
 */
export function designProjectPatch(
  body: DesignProjectWrite,
): Partial<DesignProjectInput> {
  const patch: Partial<DesignProjectInput> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.garmentProductId !== undefined) {
    patch.garmentProductId = body.garmentProductId;
  }
  if (body.proofImageUrl !== undefined) {
    patch.proofImageUrl = body.proofImageUrl;
  }
  const design = body.design ?? body.artworksBySide;
  if (design !== undefined) patch.design = normalizeDesignDocument(design);
  return patch;
}

export class DesignProjectService {
  constructor(private readonly db: CommerceDatabase) {}

  async list(tenantId: string, personId: string) {
    const rows = await this.db
      .select()
      .from(designProjects)
      .where(
        and(
          eq(designProjects.tenantId, tenantId),
          eq(designProjects.personId, personId),
        ),
      )
      .orderBy(desc(designProjects.updatedAt));
    return rows.map((row) => toView(row as DesignProjectRow));
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
    return toView(row as DesignProjectRow);
  }

  async save(
    tenantId: string,
    personId: string,
    input: DesignProjectInput,
    actor: Actor,
  ) {
    assertDesignDocumentDurable(input.design);
    const [created] = await this.db
      .insert(designProjects)
      .values({
        tenantId,
        personId,
        name: input.name,
        garmentProductId: input.garmentProductId,
        ...toStoredDesignDocument(input.design),
        proofImageUrl: input.proofImageUrl,
        createdBy: actor,
        source: { system: "storefront" },
      })
      .returning();
    if (!created) throw new Error("Failed to save design");
    return toView(created as DesignProjectRow);
  }

  async update(
    tenantId: string,
    personId: string,
    id: string,
    input: Partial<DesignProjectInput>,
  ) {
    return this.applyUpdate(
      and(
        eq(designProjects.tenantId, tenantId),
        eq(designProjects.personId, personId),
        eq(designProjects.id, id),
      ),
      input,
    );
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
    return toView(deleted as DesignProjectRow);
  }

  /**
   * Staff view of the whole tenant's saved work. Deliberately a separate
   * method from `list` rather than a nullable `personId` argument — a caller
   * that forgets to pass the customer would silently hand one customer every
   * other customer's designs, and that mistake should not be expressible.
   */
  async listForStaff(tenantId: string, options: { limit: number; offset: number }) {
    const rows = await this.db
      .select({
        project: designProjects,
        customerName: people.displayName,
        customerEmail: people.email,
      })
      .from(designProjects)
      .leftJoin(people, eq(people.id, designProjects.personId))
      .where(eq(designProjects.tenantId, tenantId))
      .orderBy(desc(designProjects.updatedAt))
      .limit(options.limit)
      .offset(options.offset);
    return rows.map((row) => ({
      ...toView(row.project as DesignProjectRow),
      customerName: row.customerName,
      customerEmail: row.customerEmail,
    }));
  }

  async getForStaff(tenantId: string, id: string) {
    const [row] = await this.db
      .select({
        project: designProjects,
        customerName: people.displayName,
        customerEmail: people.email,
      })
      .from(designProjects)
      .leftJoin(people, eq(people.id, designProjects.personId))
      .where(
        and(eq(designProjects.tenantId, tenantId), eq(designProjects.id, id)),
      )
      .limit(1);
    if (!row) throw new ResourceNotFoundError("Saved design not found");
    return {
      ...toView(row.project as DesignProjectRow),
      customerName: row.customerName,
      customerEmail: row.customerEmail,
    };
  }

  /**
   * Staff edits are tenant-scoped but not person-scoped, which is the one
   * legitimate reason to reach across customers: fixing artwork before it
   * goes to the press. The audit columns record who did it.
   */
  async updateForStaff(
    tenantId: string,
    id: string,
    input: Partial<DesignProjectInput>,
    actor: Actor,
  ) {
    return this.applyUpdate(
      and(eq(designProjects.tenantId, tenantId), eq(designProjects.id, id)),
      input,
      actor,
    );
  }

  private async applyUpdate(
    where: ReturnType<typeof and>,
    input: Partial<DesignProjectInput>,
    actor?: Actor,
  ) {
    if (input.design) assertDesignDocumentDurable(input.design);
    const changes: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) changes.name = input.name;
    if (input.garmentProductId !== undefined) {
      changes.garmentProductId = input.garmentProductId;
    }
    if (input.proofImageUrl !== undefined) {
      changes.proofImageUrl = input.proofImageUrl;
    }
    if (input.design) Object.assign(changes, toStoredDesignDocument(input.design));
    if (actor) changes.updatedBy = actor;

    const [updated] = await this.db
      .update(designProjects)
      .set(changes)
      .where(where)
      .returning();
    if (!updated) throw new ResourceNotFoundError("Saved design not found");
    return toView(updated as DesignProjectRow);
  }
}
