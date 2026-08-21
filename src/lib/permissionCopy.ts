// Locked, founder-voiced copy for Stage 5's permission showcase — source:
// "Sonder - Permission and Core-Relay UI Copy" (canonical 2026-08-06), as
// relayed in "Sonder - Direct Instructions for CC 2026-08-20 Part 39".
// Verbatim-ready — do not paraphrase or regenerate. Single source of truth,
// referenced by PermissionLevel1Prompt / PermissionLevel2Screen /
// PermissionFaqSheet so the strings only live in one place.

// Level 1 renders as an in-conversation Sonder bubble even though it's
// Stage 5 UI — Sonder's own voice.
export const LEVEL1_ASK =
  "Would it help if I could actually see you? Nothing leaves your phone — this just stays between us, helps me be closer to you.";
export const LEVEL1_BUTTON_SURE = "Sure";
export const LEVEL1_BUTTON_NOT_NOW = "Not right now";

// Level 2 is a separate screen/step — never blended into a Level 1 moment.
export const LEVEL2_ASK =
  "Want to help Sonder — and a few AIs we work with — get better? You choose what to share. Nothing that could identify you ever leaves your phone.";
export const LEVEL2_BUTTON_SEE_WHAT_THIS_MEANS = "See what this means";
export const LEVEL2_BUTTON_SHARE = "Share";
export const LEVEL2_BUTTON_NO_THANKS = "No thanks";

// Flat, warm, no lingering — shown once per decline, never re-raised
// unprompted anywhere in the app afterward (standing behavioral rule).
export const DECLINE_RESPONSE = "Okay — no problem.";

// Direct-question answers, verbatim-ready for wherever these can be asked
// in the flow or later in chat.
export const WHY_DO_YOU_WANT_THIS_LEVEL1 =
  "This helps me be closer to you. Nothing leaves your phone.";
export const DO_YOU_NEED_MY_SUBSCRIPTION = "No — not personally, ever.";
export const WILL_YOU_SHUT_DOWN_IF_I_SAY_NO = "No, nothing changes.";

// Short in-app summary — usable in onboarding, settings, or banners.
export const ONE_LINER = "Your info doesn't get shared until you want it to.";

// FAQ — kept entirely out of Sonder's own voice; UI/settings copy, not
// something Sonder ever says itself.
export const FAQ_TITLE = "What happens to what Sonder senses?";
export const FAQ_LEVEL1_DEFAULT =
  "Everything's processed on your device. Sonder turns what it senses into a compressed signal — never raw video, audio, or photos — and that signal may help Sonder improve. Nothing identifiable ever leaves your phone.";
export const FAQ_LEVEL2_OPTIONAL =
  "The same kind of signal may also go to select partners helping build AI tools. Your identity is never included — no photos, no names, no contacts, no birthday. Choosing to share moves you up a tier automatically.";
