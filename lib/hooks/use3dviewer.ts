import { useState, useCallback } from "react";

export interface Viewer3DState {
  isOpen: boolean;
  productId: string | null;
  productName: string | null;
  modelUrl: string | null;
  productImageUrl: string | null;
}

/**
 * Hook to manage 3D viewer state. Used in DesignStudio to toggle
 * between 2D canvas and 3D preview.
 */
export function use3DViewer() {
  const [state, setState] = useState<Viewer3DState>({
    isOpen: false,
    productId: null,
    productName: null,
    modelUrl: null,
    productImageUrl: null,
  });

  const open = useCallback(
    (productId: string, productName: string, modelUrl: string, imageUrl?: string | null) => {
      setState({
        isOpen: true,
        productId,
        productName,
        modelUrl,
        productImageUrl: imageUrl ?? null,
      });
    },
    [],
  );

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggle = useCallback(
    (productId: string, productName: string, modelUrl: string, imageUrl?: string | null) => {
      if (state.isOpen && state.productId === productId) {
        close();
      } else {
        open(productId, productName, modelUrl, imageUrl);
      }
    },
    [state.isOpen, state.productId, open, close],
  );

  return { state, open, close, toggle };
}
