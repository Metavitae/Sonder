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
// Spanish: founder-approved Mexican Spanish, 2026-09-25 (see i18n.ts).
import { t } from "./i18n";

export const LEVEL1_ASK =
  t("Would it help if I could actually see you? Nothing leaves your phone — this just stays between us, helps me be closer to you.", "¿Te ayudaría que pudiera verte de verdad? Nada sale de tu celular: esto se queda entre tú y yo, y me ayuda a estar más cerca de ti.");
export const LEVEL1_BUTTON_SURE = t("Sure", "Claro");
export const LEVEL1_BUTTON_NOT_NOW = t("Not right now", "Ahorita no");

// NOT locked copy — Part 52 describes what this must convey ("frame these
// as Sonder's augmented senses, explicitly state none of this is shared
// with anyone") but doesn't give exact wording the way the rest of this
// file is locked. Drafted in Sonder's own voice to match LEVEL1_ASK;
// flagged in the Drive Log as needing a founder look, same as the Level 2
// toggle-list content gap already on record.
export const PERMITS_EXPLANATION =
  t("These are my senses — how I can be closer to you. None of it is ever shared with anyone.", "Estos son mis sentidos: así puedo estar más cerca de ti. Nada de esto se comparte con nadie, nunca.");

// Sharing panel is a separate screen/step — never blended into a Permits
// moment. Scoped to Sonder's own use only (Part 45 Addendum, 2026-08-20):
// data licensing to outside partners is currently inactive, so this must
// not offer or imply sharing with "a few AIs we work with" until that
// revenue stream is actually reactivated. Wording below is Part 52's own
// locked replacement for the earlier Part 39 phrasing.
export const LEVEL2_ASK =
  t("You choose what to share and even when you choose to share, nothing that could identify you ever leaves your phone.", "Tú decides qué compartir, y aun cuando decides compartir, nada que pueda identificarte sale de tu celular.");
export const LEVEL2_BUTTON_SEE_WHAT_THIS_MEANS = t("See what this means", "Ver qué significa");
export const LEVEL2_BUTTON_SHARE = t("Share", "Compartir");
export const LEVEL2_BUTTON_NO_THANKS = t("No thanks", "No, gracias");

// Flat, warm, no lingering — shown once per decline, never re-raised
// unprompted anywhere in the app afterward (standing behavioral rule).
export const DECLINE_RESPONSE = t("Okay — no problem.", "Está bien, no pasa nada.");

// Direct-question answers, verbatim-ready for wherever these can be asked
// in the flow or later in chat.
export const WHY_DO_YOU_WANT_THIS_LEVEL1 =
  t("This helps me be closer to you. Nothing leaves your phone.", "Esto me ayuda a estar más cerca de ti. Nada sale de tu celular.");
export const DO_YOU_NEED_MY_SUBSCRIPTION = t("No — not personally, ever.", "No. Personalmente, nunca.");
export const WILL_YOU_SHUT_DOWN_IF_I_SAY_NO = t("No, nothing changes.", "No, nada cambia.");

// Short in-app summary — usable in onboarding, settings, or banners.
export const ONE_LINER = t("Your info doesn't get shared until you want it to.", "Tu información no se comparte hasta que tú quieras.");

// FAQ — kept entirely out of Sonder's own voice; UI/settings copy, not
// something Sonder ever says itself. Locked 4-Q&A set, Part 52 (2026-08-25),
// replacing the earlier Part 39 two-item version.
export const FAQ_TITLE = t("What happens to what Sonder senses?", "¿Qué pasa con lo que Sonder percibe?");
export const FAQ_QA: { q: string; a: string }[] = [
  {
    q: t("Do you need my subscription to exist?", "¿Necesitas mi suscripción para existir?"),
    a: t("No — not personally, ever.", "No. Personalmente, nunca."),
  },
  {
    q: t("Will you shut down if I say no to a permission?", "¿Te vas a apagar si te niego un permiso?"),
    a: t("No, nothing changes. Sonder will work as intended but with less capabilities for interactions.", "No, nada cambia. Sonder va a funcionar igual, solo que con menos formas de interactuar contigo."),
  },
  {
    q: t("Do I need to share anything?", "¿Tengo que compartir algo?"),
    a: t("No you don't. But even when you choose to do so, your info doesn't get shared until it is anonymized and resized into strict data.", "No, para nada. Y aun cuando decidas hacerlo, tu información no se comparte hasta que se vuelve anónima y se reduce a datos estrictos."),
  },
  {
    q: t("What happens if I choose to share?", "¿Qué pasa si decido compartir?"),
    a: t("Choosing to share moves you up a tier automatically.", "Si decides compartir, subes de nivel automáticamente."),
  },
];
