"use client";

import { useState, useCallback } from "react";
import { GarmentScene } from "./GarmentScene";
import { Button } from "@/components/shared/Button";

export interface Garment3DProps {
  productId: string;
  productName: string;
  modelUrl: string;
  productImageUrl?: string | null;
  designCanvasData?: string | null;
  onClose?: () => void;
}

/**
 * 3D Garment Viewer component. Displays a 3D model of the garment with
 * optional texture from the design canvas. Part of the Design Studio.
 */
export function GarmentViewer3D({
  productId,
  productName,
  modelUrl,
  productImageUrl,
  designCanvasData,
  onClose,
}: Garment3DProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSceneLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleSceneError = useCallback((err: Error) => {
    setError(err.message || "Failed to load 3D model");
    setIsLoading(false);
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-raised rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-sp-4 py-sp-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{productName}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">3D Preview</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close 3D viewer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Scene */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-raised/50 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Loading 3D model...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-raised/50 backdrop-blur-sm z-10">
            <div className="text-center px-sp-4">
              <p className="text-sm font-semibold text-red-600 mb-2">Unable to load</p>
              <p className="text-xs text-text-secondary">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSceneError}
                className="mt-sp-3"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        <GarmentScene
          modelUrl={modelUrl}
          textureUrl={productImageUrl}
          onLoad={handleSceneLoad}
          onError={handleSceneError}
        />
      </div>

      {/* Footer */}
      <div className="px-sp-4 py-sp-3 border-t border-border bg-bg bg-opacity-50 text-xs text-text-tertiary">
        <p>💡 Rotate to view • Scroll to zoom</p>
      </div>
    </div>
  );
}
