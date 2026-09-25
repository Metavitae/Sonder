// Sonder mirrors the user's language (Complete Reference §11: English and
// Spanish, US/Canada/Mexico), but the on-device voices (Piper Kristin/Joe)
// and Orpheus are English-only — reading a Spanish reply with them sounds
// awful. So each line is routed by language before it's spoken. A cheap
// local check is enough: it only has to tell these two languages apart.
// Words spelled the same in both ("no", "me") are left out of both lists.
const SPANISH_ONLY_CHARS = /[ñ¿¡áéíóú]/i;
const SPANISH_WORDS = new Set([
  "que", "de", "el", "la", "los", "las", "y", "en", "un", "una", "es", "por",
  "para", "con", "te", "lo", "pero", "como", "estás", "estas",
  "hola", "bien", "muy", "eso", "esta", "está", "gracias", "qué", "cómo",
  "tu", "tú", "yo", "mi", "se", "del", "al", "hoy", "aquí", "aqui", "sí",
  "también", "tambien", "algo", "cuando", "donde", "dónde", "porque",
]);
const ENGLISH_WORDS = new Set([
  "the", "and", "you", "is", "are", "to", "of", "it", "that", "i", "what",
  "how", "hello", "hi", "your", "my", "in", "for", "with", "this",
  "was", "be", "have", "do", "so", "just", "here", "today", "there",
]);

export function looksSpanish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [];
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (SPANISH_WORDS.has(w)) es++;
    if (ENGLISH_WORDS.has(w)) en++;
  }
  if (SPANISH_ONLY_CHARS.test(text)) es += 2;
  return es > en;
}
