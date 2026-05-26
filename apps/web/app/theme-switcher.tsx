"use client";

import { useEffect, useState } from "react";

const themes = [
  { id: "graphite", label: "Graphite" },
  { id: "copper", label: "Copper" }
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("graphite");

  useEffect(() => {
    const saved = window.localStorage.getItem("agent-governor-theme") ?? "graphite";
    setTheme(saved);
    document.documentElement.dataset.theme = saved === "copper" ? "copper" : "graphite";
  }, []);

  function selectTheme(nextTheme: string) {
    setTheme(nextTheme);
    window.localStorage.setItem("agent-governor-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme === "copper" ? "copper" : "graphite";
  }

  return (
    <div className="flex rounded-md border border-[var(--ag-line)] bg-[var(--ag-surface)] p-1">
      {themes.map((item) => (
        <button
          className="ag-theme-control h-7 rounded px-2 text-xs font-medium"
          data-active={theme === item.id}
          key={item.id}
          onClick={() => selectTheme(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
