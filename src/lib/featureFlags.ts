// Simple flags, flipped by hand when a paused path is reactivated — no
// remote config, no build variants.

// Part 52 (2026-08-25): the Sharing panel + tier-up reward is built
// completely and correctly, but ships inactive — data licensing to third
// parties is currently paused (Aug 20 decision), so there's no reward to
// fund it with yet. Flip this to true, no rebuild, once that resumes.
export const SHARING_TIER_UP_ENABLED = false;

// Founder, 2026-09-29: prototype of the "filaments / force field" mist
// (FilamentMist.tsx), drawn over the old soft mist. False = the old mist
// only, exactly as before.
export const FILAMENT_MIST_ENABLED = true;
