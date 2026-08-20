"use client";

import { Drawer } from "@/components/ui/drawer";
import { NavLinks } from "@/components/layout/nav-links";

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Society Facility Management" side="left">
      <NavLinks onNavigate={onClose} />
    </Drawer>
  );
}
