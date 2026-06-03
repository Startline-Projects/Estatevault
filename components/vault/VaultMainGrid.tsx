"use client";

import { type ReactNode } from "react";
import type { VaultItem } from "./vault-constants";

interface VaultMainGridProps {
  items: VaultItem[];
  itemsLoaded: boolean;
  farewellCount: number;
  isSubscribed: boolean;
  showUpgradePrompt: boolean;
  formattedPrice: string;
  categories: ReadonlyArray<{ key: string; icon: string; label: string; vaultOnly: boolean }>;
  subscriptionBanner: ReactNode;
  onManageAccess: () => void;
  onShowUpgrade: () => void;
  onDismissUpgrade: () => void;
  onUpgrade: () => void;
  onSelectCategory: (key: string) => void;
  onFarewellClick: () => void;
}

export default function VaultMainGrid({
  items,
  itemsLoaded,
  farewellCount,
  isSubscribed,
  showUpgradePrompt,
  formattedPrice,
  categories,
  subscriptionBanner,
  onManageAccess,
  onShowUpgrade,
  onDismissUpgrade,
  onUpgrade,
  onSelectCategory,
  onFarewellClick,
}: VaultMainGridProps) {
  function getCategoryCount(key: string) {
    return items.filter((i) => i.category === key).length;
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">My Family Vault</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Everything your family needs, secured and organized.
          </p>
        </div>
        <button
          onClick={onManageAccess}
          className="rounded-full border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors"
        >
          Manage Emergency Access
        </button>
      </div>

      <div className="mt-6">{subscriptionBanner}</div>

      {showUpgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
            <span className="text-4xl">🔒</span>
            <h2 className="mt-4 text-lg font-bold text-navy">Vault Plan Required</h2>
            <p className="mt-2 text-sm text-charcoal/60">
              This section is part of the EstateVault Plan ({formattedPrice}/year). Upgrade to
              securely store and protect all your important information.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={onUpgrade}
                className="w-full min-h-[44px] flex items-center justify-center rounded-full bg-gold text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
              >
                Upgrade, {formattedPrice}/year
              </button>
              <button
                onClick={onDismissUpgrade}
                className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const count = getCategoryCount(cat.key);
          const requiresUpgrade = !isSubscribed;
          return (
            <button
              key={cat.key}
              onClick={() => {
                if (requiresUpgrade) {
                  onShowUpgrade();
                  return;
                }
                onSelectCategory(cat.key);
              }}
              className={`relative rounded-xl p-5 text-left transition-all hover:shadow-md ${
                !itemsLoaded
                  ? "bg-gold/5 border border-gray-200 text-navy animate-pulse"
                  : count > 0
                  ? "bg-gold text-white"
                  : "bg-gold/5 border border-gray-200 text-navy"
              }`}
            >
              {requiresUpgrade && (
                <div className="absolute top-2.5 right-2.5 text-charcoal/30">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </div>
              )}
              <span className="text-2xl">{cat.icon}</span>
              <p className="mt-3 text-sm font-semibold">{cat.label}</p>
              {!itemsLoaded && !requiresUpgrade ? (
                <span className="mt-2 block h-3 w-10 rounded bg-charcoal/10" />
              ) : (
                <p className={`mt-1 text-xs ${count > 0 ? "text-white/60" : "text-charcoal/50"}`}>
                  {requiresUpgrade
                    ? "Vault plan required"
                    : count > 0
                    ? `${count} item${count !== 1 ? "s" : ""}`
                    : "Empty"}
                </p>
              )}
            </button>
          );
        })}

        <button
          onClick={onFarewellClick}
          className={`relative rounded-xl p-5 text-left transition-all hover:shadow-md ${
            !itemsLoaded
              ? "bg-gold/5 border border-gold/30 text-navy animate-pulse"
              : farewellCount > 0
              ? "bg-gold text-white"
              : "bg-gold/5 border border-gold/30 text-navy"
          }`}
        >
          {!isSubscribed && (
            <div className="absolute top-2.5 right-2.5 text-charcoal/30">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
          )}
          <span className="text-2xl">🎥</span>
          <p className="mt-3 text-sm font-semibold">Farewell Messages</p>
          {!itemsLoaded && isSubscribed ? (
            <span className="mt-2 block h-3 w-20 rounded bg-charcoal/10" />
          ) : (
            <p
              className={`mt-1 text-xs ${farewellCount > 0 ? "text-white/60" : "text-charcoal/60"}`}
            >
              {!isSubscribed
                ? "Vault plan required"
                : farewellCount > 0
                ? `${farewellCount} message${farewellCount !== 1 ? "s" : ""}`
                : "Video messages for loved ones"}
            </p>
          )}
        </button>
      </div>
    </div>
  );
}
