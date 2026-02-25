"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  width: number; // default width in px
  align?: "left" | "right";
}

export function useResizableColumns(columns: ColumnDef[]) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    columns.forEach((c) => { w[c.key] = c.width; });
    return w;
  });

  const dragRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = e.clientX - dragRef.current.startX;
      const newW = Math.max(50, dragRef.current.startW + diff);
      setColWidths((prev) => ({ ...prev, [dragRef.current!.col]: newW }));
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { col, startX: e.clientX, startW: colWidths[col] };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [colWidths],
  );

  const totalWidth = Object.values(colWidths).reduce((s, w) => s + w, 0);

  return { colWidths, startResize, totalWidth };
}
