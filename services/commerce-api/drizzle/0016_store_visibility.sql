-- Whether a store is the operator's own retail storefront, open to anyone who
-- signs in, or a private team store that only invited people may join.
--
-- This used to be inferred from cosmetics: a store with no logo and no accent
-- colour was treated as public, which meant a corporate customer who signed up
-- without picking a colour got a store where any signed-in stranger was
-- silently added to their account and could read their orders. Branding is a
-- styling choice and was never a safe stand-in for access control.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- Only stores the operator created are public. Every self-serve store is
-- raised by a customer actor through the corporate wizard, so those stay
-- private no matter how they happen to be styled.
UPDATE "stores"
   SET "is_public" = true
 WHERE COALESCE("created_by" ->> 'type', 'system') <> 'customer';
