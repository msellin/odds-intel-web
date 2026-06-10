"use client";

// Wires AuthProvider's upgrade-modal state to the actual UpgradeModal
// component. Mounted once in the root layout so any descendant can call
// useAuth().openUpgradeModal(trigger) to surface it.

import { useAuth } from "@/components/auth-provider";
import { UpgradeModal } from "@/components/upgrade-modal";

export function UpgradeModalMount() {
  const { upgradeModalOpen, upgradeTrigger, closeUpgradeModal } = useAuth();
  return (
    <UpgradeModal
      open={upgradeModalOpen}
      onOpenChange={(next) => {
        if (!next) closeUpgradeModal();
      }}
      trigger={upgradeTrigger}
    />
  );
}
