import { notFound } from "next/navigation";
import { GarmentViewer3D } from "@/components/3d/GarmentViewer3D";

export const metadata = {
  title: "3D Garment Viewer Demo",
  robots: "noindex",
};

/**
 * Scratch page for the 3D garment viewer: integration notes to ourselves, and
 * a viewer pointed at /models/garments/hoodie-sample.glb, which is not in
 * /public. In production it therefore served a broken viewer under a heading
 * that reads "3D Garment Viewer Demo" to anyone who guessed the URL — noindex
 * keeps it out of search but does not keep anyone out. The file's own comment
 * asked for it to be removed or gated before shipping; gating keeps it usable
 * locally, which is the point of it.
 */
export default function Demo3DPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-bg p-sp-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-sp-6">
          <h1 className="text-display font-bold mb-sp-2">3D Garment Viewer Demo</h1>
          <p className="text-text-secondary">
            This is a development/testing page. To integrate into the design studio:
          </p>
          <ol className="list-decimal list-inside text-sm text-text-secondary mt-sp-3 space-y-1">
            <li>Create 3D models (.glb format) for your garments</li>
            <li>Store them in <code className="bg-bg-raised px-1 rounded">/public/models/garments/</code></li>
            <li>Add model URLs to your product database</li>
            <li>Use <code className="bg-bg-raised px-1 rounded">use3DViewer</code> hook in DesignStudio</li>
            <li>Import <code className="bg-bg-raised px-1 rounded">GarmentViewer3D</code> component</li>
          </ol>
        </div>

        {/* Demo Viewer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-sp-5">
          <div className="h-[500px]">
            <GarmentViewer3D
              productId="demo-1"
              productName="Sample Hoodie (3D Model Needed)"
              modelUrl="/models/garments/hoodie-sample.glb"
              productImageUrl="/images/prod-hoodie.jpg"
            />
          </div>

          <div>
            <div className="bg-bg-raised border border-border rounded-lg p-sp-4">
              <h2 className="font-semibold mb-sp-3">Next Steps</h2>

              <div className="space-y-sp-3 text-sm">
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">1. Get 3D Models</h3>
                  <p className="text-text-secondary">
                    Source .glb files from TurboSquid, CGTrader, or commission custom models.
                    Recommended: ~2-5MB per model after Draco compression.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-1">2. Prepare Model</h3>
                  <p className="text-text-secondary">
                    Ensure the model is UV-mapped so textures apply correctly. Named meshes
                    (e.g., &quot;Front_Chest&quot;, &quot;Back_Body&quot;) help with
                    multi-surface designs.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-1">3. Store Files</h3>
                  <p className="text-text-secondary">
                    Place .glb files in <code className="bg-bg px-1 rounded text-[12px]">/public/models/garments/</code>
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-text-primary mb-1">4. Integrate with Design Studio</h3>
                  <p className="text-text-secondary">
                    Add a &quot;3D Preview&quot; button in DesignStudio that opens the
                    viewer modal.
                  </p>
                </div>
              </div>

              <div className="mt-sp-4 p-sp-3 bg-accent/10 border border-accent/20 rounded text-sm">
                <p className="font-semibold text-accent mb-1">📋 Sample Folder Structure</p>
                <pre className="text-[11px] text-text-secondary overflow-x-auto">
                  {`public/models/garments/
├── adidas-a2009.glb
├── adidas-a2020.glb
├── adidas-hoodie.glb
└── gildan-tshirt.glb`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
