-- Add size_chart_pdf_url column to product_styles table
-- Stores the URL to the official size chart PDF for each garment style

ALTER TABLE "product_styles"
ADD COLUMN "size_chart_pdf_url" text;

-- Add index for faster lookups
CREATE INDEX "product_styles_size_chart_idx" ON "product_styles" ("size_chart_pdf_url");
