"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export function AnimatedBadgeList({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((name, i) => (
        <motion.div
          key={name}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
        >
          <Badge variant="secondary">{name}</Badge>
        </motion.div>
      ))}
    </div>
  );
}
