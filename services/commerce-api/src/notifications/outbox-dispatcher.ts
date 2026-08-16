import { sql } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client.js";
import type { EmailSender } from "./email.js";
import {
  BACKOFF_BASE_SECONDS,
  BACKOFF_CEILING_SECONDS,
  notificationsForEvent,
  type NotificationContext,
} from "./messages.js";

/** Events are parked rather than retried forever once they reach this many
 * attempts. Parked rows keep `published_at` null and carry their last error, so
 * they stay visible to anyone looking for stuck notifications. */
const MAX_ATTEMPTS = 8;

export interface DispatcherOptions {
  db: CommerceDatabase;
  sender: EmailSender;
  siteBaseUrl: string;
  staffEmail: string | null;
  batchSize?: number;
  logger?: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void };
}

interface ClaimedEvent extends Record<string, unknown> {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: { type?: string; data?: Record<string, unknown> };
  attempts: number;
  display_id: string | null;
  customer_email: string | null;
}

export interface DispatchResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Delivers one batch of pending outbox events as email.
 *
 * Claiming and deferring happen in a single statement: the row's next attempt
 * is pushed out *before* the send is tried, so a process that dies mid-send
 * leaves the event to be retried later rather than wedged as permanently
 * in-flight. `FOR UPDATE SKIP LOCKED` keeps two API tasks from picking up the
 * same event, which matters as soon as the service scales past one.
 */
export async function dispatchOutboxBatch(
  options: DispatcherOptions,
): Promise<DispatchResult> {
  const { db, sender, siteBaseUrl, staffEmail } = options;
  // Clamped to a whole number because it is interpolated into the statement
  // rather than bound as a parameter.
  const batchSize = Math.max(1, Math.min(200, Math.trunc(options.batchSize ?? 20)));

  // These are compile-time constants, inlined rather than bound: Postgres
  // cannot infer a type for a bare parameter inside least()/power() and rejects
  // the statement with "could not determine data type of parameter".
  //
  // In the SET clause o.attempts is the value *before* this claim, so a first
  // attempt (0) defers by the base delay, matching backoffSeconds(1).
  const backoff = sql.raw(
    `least(${BACKOFF_CEILING_SECONDS}, ${BACKOFF_BASE_SECONDS} * power(2, o.attempts))`,
  );
  const claimed = await db.execute<ClaimedEvent>(sql`
    with claimed as (
      update outbox_events o
         set attempts = o.attempts + 1,
             available_at = now() + make_interval(secs => ${backoff})
       where o.id in (
         select id from outbox_events
          where published_at is null
            and available_at <= now()
            and attempts < ${sql.raw(String(MAX_ATTEMPTS))}
          order by available_at
          limit ${sql.raw(String(batchSize))}
          for update skip locked
       )
      returning o.id, o.aggregate_id, o.event_type, o.payload, o.attempts
    )
    select c.*, j.display_id, p.email as customer_email
      from claimed c
      left join job_requests j on j.id = c.aggregate_id
      left join people p on p.id = j.customer_person_id
  `);

  // postgres-js hands back an array; other drivers wrap rows in `.rows`.
  const rows: ClaimedEvent[] = Array.isArray(claimed)
    ? (claimed as ClaimedEvent[])
    : ((claimed as { rows?: ClaimedEvent[] })?.rows ?? []);
  const result: DispatchResult = {
    claimed: rows.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const context: NotificationContext = {
      jobDisplayId: row.display_id ?? "Your job",
      customerEmail: row.customer_email,
      staffEmail,
      siteBaseUrl,
    };

    const messages = notificationsForEvent(
      row.payload ?? {},
      row.aggregate_id,
      context,
    );

    // Nothing to send is a finished event, not a failure. Marking it published
    // stops the dispatcher re-reading events it will never act on.
    if (messages.length === 0) {
      await db.execute(sql`
        update outbox_events set published_at = now(), last_error = null
         where id = ${row.id}
      `);
      result.skipped += 1;
      continue;
    }

    try {
      for (const message of messages) {
        await sender.send(message);
      }
      await db.execute(sql`
        update outbox_events set published_at = now(), last_error = null
         where id = ${row.id}
      `);
      result.sent += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // UPDATE ... RETURNING yields post-update values, so row.attempts already
      // counts the attempt that just failed.
      const parked = row.attempts >= MAX_ATTEMPTS;
      await db.execute(sql`
        update outbox_events
           set last_error = ${parked ? `Parked after ${MAX_ATTEMPTS} attempts: ${reason}` : reason}
         where id = ${row.id}
      `);
      result.failed += 1;
      options.logger?.warn(
        { outboxEventId: row.id, eventType: row.event_type, parked, reason },
        "Outbox notification failed",
      );
    }
  }

  return result;
}

export interface DispatcherHandle {
  stop: () => void;
}

/**
 * Runs the dispatcher on an interval.
 *
 * Each tick is awaited before the next is scheduled, so a slow batch cannot
 * stack up overlapping runs against the same rows.
 */
export function startOutboxDispatcher(
  options: DispatcherOptions & { intervalMs: number },
): DispatcherHandle {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    if (stopped) return;
    try {
      const result = await dispatchOutboxBatch(options);
      if (result.claimed > 0) {
        options.logger?.info(result, "Outbox batch dispatched");
      }
    } catch (error) {
      options.logger?.warn(
        { reason: error instanceof Error ? error.message : String(error) },
        "Outbox dispatch tick failed",
      );
    }
    if (!stopped) {
      timer = setTimeout(tick, options.intervalMs);
      // A pending poll should never be the reason the process stays alive.
      timer.unref?.();
    }
  };

  timer = setTimeout(tick, options.intervalMs);
  timer.unref?.();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
