# Cod Chat Widget Logo Fix

## Issue

The Cod Chat widget logo/avatar image is broken on the GWG staging site (https://d1so4a0f4v7ki5.cloudfront.net). The widget header shows a broken-image placeholder instead of the logo.

## Root Cause (Confirmed)

**The widget's `logoUrl` is set to `https://kommodo.ai/i/D33nLk5dvvmxWhrDv0N7` which returns HTTP 200 with `Content-Type: text/html` instead of image bytes.**

This URL returns an HTML page, not an image, causing the `<img>` tag to fail and display a broken-image placeholder.

### Where is this configured?

- **NOT in GWG codebase** - searched for "kommodo" and the URL, no matches found
- **In CodCRM widget database** - the `logoUrl` field for widget ID `85dba5f0-ad5f-482c-97d4-1795cbdb0d62`
- **Cod-CRM-Suite repo** - not accessible (private or doesn't exist at the expected URL)

### GWG Embed (Not the Issue)

The GWG storefront only passes the widget key - no logo configuration:

```tsx
// components/shared/CodChatWidget.tsx
<Script
  src="https://www.codcrm.com/chat/widget.js"
  data-widget-key="cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_"
  strategy="afterInteractive"
/>
```

## Fix Required: Config-Only in CodCRM

**This is a config-only fix - no GWG code changes needed.**

Update the `logoUrl` field in CodCRM's widget database to use a valid GWG logo URL.

### Correct Logo URLs (Verified Working)

| URL | Size | Status |
|-----|------|--------|
| `https://d1so4a0f4v7ki5.cloudfront.net/images/logo-mark.png` | 77KB | ✓ Returns `image/png` |
| `https://d1so4a0f4v7ki5.cloudfront.net/images/logo.png` | 132KB | ✓ Returns `image/png` |

**Recommended:** Use `logo-mark.png` (smaller, better for 28x28px avatar size)

### CodCRM Admin Steps

1. Log into CodCRM admin
2. Navigate to widget settings for key `cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_`
3. Change `logoUrl` from:
   ```
   https://kommodo.ai/i/D33nLk5dvvmxWhrDv0N7  (BROKEN - returns HTML)
   ```
   to:
   ```
   https://d1so4a0f4v7ki5.cloudfront.net/images/logo-mark.png
   ```
4. Save and verify

## CodCRM Code Fix (Already Merged)

CodCRM PR #6 (commit `150fcc1`) already implements:
- HTTP→HTTPS URL normalization
- `onError` fallback to default icon when image fails
- "Powered by Cod Chat" link to https://www.codcrm.com

**Action needed:** Redeploy CodCRM on Replit to apply these changes.

## Verification

After CodCRM config update and redeploy:

1. Clear browser cache
2. Visit https://d1so4a0f4v7ki5.cloudfront.net
3. The Cod Chat widget bubble should display the GWG logo
4. Click widget to open - verify logo in header
5. DevTools > Network: logo request should return 200 with `image/png`

## Summary

| Component | Action Required |
|-----------|-----------------|
| GWG (Greatwestgraphics) | **None** - embed is correct |
| CodCRM Admin | Update `logoUrl` to `https://d1so4a0f4v7ki5.cloudfront.net/images/logo-mark.png` |
| CodCRM Code | Redeploy to apply PR #6 (onError fallback) |

## Widget Details

- **Widget Key:** `cw_QvxzBof5FARoSZoWlZtCFM5IptaiBVe_`
- **Widget ID:** `85dba5f0-ad5f-482c-97d4-1795cbdb0d62`
- **Staging URL:** https://d1so4a0f4v7ki5.cloudfront.net
- **Broken Logo URL:** `https://kommodo.ai/i/D33nLk5dvvmxWhrDv0N7` (returns HTML)
- **Correct Logo URL:** `https://d1so4a0f4v7ki5.cloudfront.net/images/logo-mark.png`
