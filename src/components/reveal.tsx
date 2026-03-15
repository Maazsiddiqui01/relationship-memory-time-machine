"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";

export function Reveal({ children }: PropsWithChildren) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // Custom spring-like easing
    >
      {children}
    </motion.div>
  );
}
