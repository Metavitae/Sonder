// Locked, founder-voiced copy for the Permits/Sharing panels — source:
// "Sonder - Permission and Core-Relay UI Copy" (canonical 2026-08-06), as
// relayed in "Sonder - Direct Instructions for CC 2026-08-20 Part 39" and
// reorganized (screen structure only, language unchanged where locked) by
// "Sonder - Direct Instructions for CC 2026-08-25 Part 52". Verbatim-ready
// — do not paraphrase or regenerate. Single source of truth, referenced by
// PermitsPanel / PermissionLevel2Screen / PermissionFaqSheet so the strings
// only live in one place.

// Level 1 / Permits panel renders as an in-conversation Sonder bubble —
// Sonder's own voice.
export const LEVEL1_ASK =
  "Would it help if I could actually see you? Nothing leaves your phone — this just stays between us, helps me be closer to you.";
export const LEVEL1_BUTTON_SURE = "Sure";
export const LEVEL1_BUTTON_NOT_NOW = "Not right now";

// NOT locked copy — Part 52 describes what this must convey ("frame these
// as Sonder's augmented senses, explicitly state none of this is shared
// with anyone") but doesn't give exact wording the way the rest of this
// file is locked. Drafted in Sonder's own voice to match LEVEL1_ASK;
// flagged in the Drive Log as needing a founder look, same as the Level 2
// toggle-list content gap already on record.
export const PERMITS_EXPLANATION =
  "These are my senses — how I can be closer to you. None of it is ever shared with anyone.";

// Sharing panel is a separate screen/step — never blended into a Permits
// moment. Scoped to Sonder's own use only (Part 45 Addendum, 2026-08-20):
// data licensing to outside partners is currently inactive, so this must
// not offer or imply sharing with "a few AIs we work with" until that
// revenue stream is actually reactivated. Wording below is Part 52's own
// locked replacement for the earlier Part 39 phrasing.
export const LEVEL2_ASK =
  "You choose what to share and even when you choose to share, nothing that could identify you ever leaves your phone.";
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
// something Sonder ever says itself. Locked 4-Q&A set, Part 52 (2026-08-25),
// replacing the earlier Part 39 two-item version.
export const FAQ_TITLE = "What happens to what Sonder senses?";
export const FAQ_QA: { q: string; a: string }[] = [
  {
    q: "Do you need my subscription to exist?",
    a: "No — not personally, ever.",
  },
  {
    q: "Will you shut down if I say no to a permission?",
    a: "No, nothing changes. Sonder will work as intended but with less capabilities for interactions.",
  },
  {
    q: "Do I need to share anything?",
    a: "No you don't. But even when you choose to do so, your info doesn't get shared until it is anonymized and resized into strict data.",
  },
  {
    q: "What happens if I choose to share?",
    a: "Choosing to share moves you up a tier automatically.",
  },
];
