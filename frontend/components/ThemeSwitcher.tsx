"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ThemeSwitcher() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.toggle("bus-theme", pathname.startsWith("/bus"));
  }, [pathname]);

  return null;
}
