# Size Chart PDF Setup Guide

## Overview

Size chart PDFs are now stored directly in the database, linked to each garment style. When a product page loads, it automatically displays a "View Size Chart" button if a PDF URL is available.

---

## How It Works

```
Database (product_styles table)
  ├─ id: style ID
  ├─ name: style name
  └─ sizeChartPdfUrl: URL to PDF ← NEW
  
Product Page
  ├─ Queries database for style
  ├─ Checks if sizeChartPdfUrl exists
  └─ If yes, shows "View Size Chart" button
      └─ Click → Opens PDF in fullscreen modal
```

---

## Adding Size Chart PDFs

### **Step 1: Get the PDF URL**

#### **Option A: From S&S Website** (Easiest)
```
1. Go to: ssactivewear.com
2. Search: Garment (e.g., "Adidas A2009")
3. Find: Size chart PDF link
4. Right-click → Copy link address
5. Example URL: https://cdn.ssactivewear.com/size-charts/adidas-a2009.pdf
```

#### **Option B: From Manufacturer**
```
1. Go to: Brand website (adidas.com, gildan.com, etc)
2. Find: Product or size guide section
3. Copy: Direct PDF URL
4. Example: https://www.gildan.com/documents/gildan-18500-size-chart.pdf
```

#### **Option C: Upload to Your CDN**
```
1. Download PDF from S&S or manufacturer
2. Upload to your CDN (Cloudflare, AWS S3, etc)
3. Get public URL
4. Example: https://your-cdn.com/size-charts/adidas-a2009.pdf
```

---

### **Step 2: Update Database**

#### **Option A: SQL Update** (Direct)
```sql
UPDATE product_styles
SET size_chart_pdf_url = 'https://cdn.ssactivewear.com/size-charts/adidas-a2009.pdf'
WHERE name = 'A2009' AND product_id IN (
  SELECT id FROM products WHERE name LIKE '%Adidas%'
);
```

#### **Option B: Admin UI** (Once built)
- Future: Create admin panel to manage size chart URLs
- For now: Use SQL directly

#### **Option C: Bulk Update SQL**
```sql
-- Update multiple styles at once
UPDATE product_styles SET size_chart_pdf_url = 
  CASE 
    WHEN name = 'A2009' THEN 'https://cdn.ssactivewear.com/size-charts/adidas-a2009.pdf'
    WHEN name = 'A2020' THEN 'https://cdn.ssactivewear.com/size-charts/adidas-a2020.pdf'
    WHEN name = '18500' THEN 'https://www.gildan.com/documents/gildan-18500-size-chart.pdf'
    ELSE size_chart_pdf_url
  END
WHERE tenant_id = '11111111-1111-4111-8111-111111111111';
```

---

## Workflow for Adding New Garments

### **When you add a new garment:**

```
1. S&S Sync runs
   └─ Adds new style to database
   └─ size_chart_pdf_url = NULL
   
2. You find the size chart PDF
   └─ Get URL from S&S or manufacturer
   
3. Update database
   └─ SET size_chart_pdf_url = '[PDF URL]'
   
4. Product page automatically shows "View Size Chart" button
   └─ No code changes needed!
```

---

## Example PDFs

### **Common S&S URLs (patterns)**
```
https://cdn.ssactivewear.com/size-charts/[brand-code].pdf

Examples:
- Adidas A2009: https://cdn.ssactivewear.com/size-charts/adidas-a2009.pdf
- Adidas A2020: https://cdn.ssactivewear.com/size-charts/adidas-a2020.pdf
- Gildan 18500: https://cdn.ssactivewear.com/size-charts/gildan-18500.pdf
```

### **Manufacturer URLs**
```
Adidas: https://www.adidas.com/us/help/size_charts
Gildan: https://www.gildan.com/documents/
American Apparel: https://www.americanapparel.net/sizing/
Hanes: https://www.hanes.com/help/sizing-and-fit
```

---

## Testing

### **Verify a PDF is displaying:**

```bash
# Check database
SELECT name, size_chart_pdf_url FROM product_styles 
WHERE size_chart_pdf_url IS NOT NULL
LIMIT 5;

# Should show:
# A2009 | https://cdn.ssactivewear.com/size-charts/adidas-a2009.pdf
# A2020 | https://cdn.ssactivewear.com/size-charts/adidas-a2020.pdf
```

### **On product page:**
1. Visit: https://yoursite.com/product/[slug]?id=[id]
2. Look for: "📄 View Size Chart" button
3. Click → PDF opens in modal
4. Features:
   - Fullscreen on mobile
   - Centered modal on desktop
   - Zoom, print, download via browser tools
   - "⬇️ Download PDF" button for direct download

---

## Batch Setup for All Garments

**Quick script to set up multiple at once:**

```sql
-- Find all styles without size charts
SELECT id, name, tenant_id FROM product_styles 
WHERE size_chart_pdf_url IS NULL
LIMIT 20;

-- Update when you find the PDFs
UPDATE product_styles 
SET size_chart_pdf_url = '[URL]'
WHERE id = '[STYLE_ID]';
```

---

## Future Enhancements

### **Phase 1: Current** ✅
- Manual URL entry via SQL
- Display PDF in modal
- Full page freeze on mobile, centered on desktop

### **Phase 2: Admin Panel** (Later)
- UI to manage size chart URLs
- Upload PDFs directly
- Auto-link by style code

### **Phase 3: Auto-Fetch** (Advanced)
- Webhook when S&S updates sizes
- Automatically fetch latest PDFs
- Version control for changes

---

## Troubleshooting

### **PDF isn't showing on product page**
1. Check: `size_chart_pdf_url` is set in database
   ```sql
   SELECT name, size_chart_pdf_url FROM product_styles 
   WHERE name = '[STYLE_NAME]';
   ```
2. Verify: URL is publicly accessible
   ```
   Paste URL in browser → Should download/display PDF
   ```
3. Check: Style is linked to product correctly
   ```sql
   SELECT * FROM product_styles ps
   JOIN products p ON ps.product_id = p.id
   WHERE ps.name = '[STYLE_NAME]';
   ```

### **PDF won't load in modal**
- Browser security: Some PDFs may be blocked
- CORS: Check if cross-origin PDF is allowed
- Fallback: "Download PDF" button still works

---

## Commands Reference

### **Add PDF for one style**
```sql
UPDATE product_styles 
SET size_chart_pdf_url = 'https://cdn.ssactivewear.com/size-charts/adidas-a2009.pdf'
WHERE name = 'A2009' 
  AND product_id = '[PRODUCT_ID]';
```

### **Remove PDF**
```sql
UPDATE product_styles 
SET size_chart_pdf_url = NULL
WHERE id = '[STYLE_ID]';
```

### **List all with PDFs**
```sql
SELECT 
  ps.name,
  p.name as product_name,
  ps.size_chart_pdf_url,
  ps.updated_at
FROM product_styles ps
JOIN products p ON ps.product_id = p.id
WHERE ps.size_chart_pdf_url IS NOT NULL
ORDER BY ps.updated_at DESC;
```

### **List all WITHOUT PDFs** (need to add)
```sql
SELECT 
  ps.name,
  p.name as product_name,
  ps.created_at
FROM product_styles ps
JOIN products p ON ps.product_id = p.id
WHERE ps.size_chart_pdf_url IS NULL
ORDER BY ps.created_at DESC;
```

---

## Next Steps

1. **Run migration**: Apply the SQL migration to add column
2. **Find PDFs**: Search for size charts for your top garments
3. **Update database**: Use SQL to set URLs
4. **Test**: Visit product pages and verify "View Size Chart" appears
5. **Expand**: Add PDFs for all garments over time

---

**Questions?**

If a PDF URL isn't working or you can't find a chart, check:
- Is the manufacturer still making this garment?
- Is there a newer version available?
- Can you contact S&S for the official PDF?
