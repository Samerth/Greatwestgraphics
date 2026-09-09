# Cod Chat Widget Logo Fix

## Issue

The Cod Chat widget logo/avatar image is broken or not loading properly on the GWG staging site (https://d1so4a0f4v7ki5.cloudfront.net).

## Root Cause Analysis

### GWG Embed (Not the Issue)

The GWG storefront embeds the Cod Chat widget via a simple script tag:

```tsx
// components/shared/CodChatWidget.tsx
<Script
  src="https://www.codcrm.com/chat/widget.js"
  data-widget-key="cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_"
  strategy="afterInteractive"
/>
```

The embed only passes the widget key - no logo URL or branding configuration is passed from GWG to CodCRM. The widget key (`cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_`) is a public identifier, and the staging origin (`d1so4a0f4v7ki5.cloudfront.net`) is correctly allowlisted in CodCRM.

### CodCRM Widget Configuration (The Issue)

The Cod Chat widget fetches its configuration (including `logoUrl`) from the CodCRM backend based on the widget key. The widget rendering logic is:

```js
// If logoUrl is set, render the logo image
n.logoUrl ? <img src={n.logoUrl} className="h-7 w-7 rounded-full" />
// If logoUrl is empty, fall back to showing initials
         : <span>{(t.name || "A").charAt(0).toUpperCase()}</span>
```

The issue is in the `logoUrl` field configuration for widget `85dba5f0-ad5f-482c-97d4-1795cbdb0d62`:

**Possible causes:**
1. `logoUrl` is set to a URL that returns 404 or is inaccessible
2. `logoUrl` is set to a URL that has CORS issues (missing `Access-Control-Allow-Origin` header)
3. `logoUrl` uses HTTP instead of HTTPS (mixed content blocked)
4. `logoUrl` is empty/unset, causing the fallback initials to render instead of a logo
5. `logoUrl` points to an oversized image causing slow/failed loading

## Fix Required (In CodCRM Admin)

The fix must be made in the **CodCRM admin dashboard**, not in the GWG codebase:

1. Log into CodCRM admin
2. Navigate to the widget settings for key `cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_`
3. Update the `logoUrl` field to a valid, HTTPS, CORS-accessible image URL
4. Recommended: Use a CDN-hosted image (e.g., from CodCRM's own assets or a cloud storage bucket with proper CORS headers)

### Recommended Logo URL Requirements

- **Protocol:** HTTPS only (no HTTP)
- **CORS:** Server must return `Access-Control-Allow-Origin: *` or include the embedding origins
- **Size:** Under 500KB, dimensions around 200x200px or smaller
- **Format:** PNG, JPEG, or SVG

### Example Valid Logo URLs

```
https://www.codcrm.com/assets/codcrm-logo-C1AlyPKA.png  (CodCRM's own logo works)
https://storage.googleapis.com/bucket/logo.png         (with CORS configured)
```

## Verification

After updating the `logoUrl` in CodCRM admin:

1. Clear browser cache
2. Visit https://d1so4a0f4v7ki5.cloudfront.net
3. The Cod Chat widget bubble in the bottom-right should display the logo image
4. Open DevTools > Network tab and verify:
   - The logo image request returns 200
   - No CORS errors in Console
   - No mixed content warnings

## Additional P0: "Powered by Cod Chat" Link

The "Powered by Cod Chat" link in the widget footer should link to https://www.codcrm.com (opening in a new tab). This is also configured in CodCRM, not GWG.

## Related Files

- `components/shared/CodChatWidget.tsx` - GWG embed (read-only, no changes needed)
- Widget key: `cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_`
- Widget ID: `85dba5f0-ad5f-482c-97d4-1795cbdb0d62`
