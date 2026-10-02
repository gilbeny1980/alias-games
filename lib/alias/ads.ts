// Shared ad constants. Ads are OFF until the owner enables them in /admin.
export type Placement = "home" | "lobby" | "roundEnd";
export const PLACEMENTS: Placement[] = ["home", "lobby", "roundEnd"];
export const PLACEMENT_LABELS: Record<Placement, string> = {
  home: "מסך הכניסה",
  lobby: "לובי",
  roundEnd: "סיום תור / משחק",
};

// Optional Google AdSense (only used when the owner also switches it on in the admin)
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
export const ADSENSE_SLOTS: Record<Placement, string | undefined> = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
  lobby: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LOBBY,
  roundEnd: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ROUNDEND,
};
