"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate } from "framer-motion";
import { money } from "@/lib/utils/quote-pricing";

export function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(value);
  const rounded = useTransform(motionVal, (v) => money(v));
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.3,
      ease: [0.16, 0.8, 0.3, 1],
    });
    return controls.stop;
  }, [value, motionVal]);

  useEffect(() => {
    return rounded.on("change", (latest) => {
      if (spanRef.current) spanRef.current.textContent = latest;
    });
  }, [rounded]);

  return <span ref={spanRef}>{money(value)}</span>;
}
