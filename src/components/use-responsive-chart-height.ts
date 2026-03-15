"use client";

import { useEffect, useState } from "react";

export function useResponsiveChartHeight() {
  const [height, setHeight] = useState(280);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const compactQuery = window.matchMedia("(max-width: 480px)");

    const updateHeight = () => {
      setHeight(compactQuery.matches ? 200 : mobileQuery.matches ? 224 : 280);
    };

    updateHeight();

    mobileQuery.addEventListener("change", updateHeight);
    compactQuery.addEventListener("change", updateHeight);

    return () => {
      mobileQuery.removeEventListener("change", updateHeight);
      compactQuery.removeEventListener("change", updateHeight);
    };
  }, []);

  return height;
}
