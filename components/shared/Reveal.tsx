"use client";

import { motion, useReducedMotion } from "framer-motion";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08, margin: "0px 0px -24px 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 0.8, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
