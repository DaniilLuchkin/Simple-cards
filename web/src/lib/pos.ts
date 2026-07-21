// The card's part-of-speech is generated in the translation language, but the
// hint should show it in the user's interface language. We map the stored value
// to a canonical POS and render its label in the UI language (English fallback).

type PosKey =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "preposition"
  | "conjunction"
  | "interjection"
  | "numeral"
  | "phrase";

// Display label per interface language (must include `en` as the fallback).
const POS: Record<PosKey, Record<string, string> & { en: string }> = {
  noun: { en: "noun", ru: "существительное", uk: "іменник", es: "sustantivo", de: "Substantiv", fr: "nom", pt: "substantivo", tr: "isim", id: "kata benda", zh: "名词", hi: "संज्ञा", ar: "اسم", fa: "اسم" },
  verb: { en: "verb", ru: "глагол", uk: "дієслово", es: "verbo", de: "Verb", fr: "verbe", pt: "verbo", tr: "fiil", id: "kata kerja", zh: "动词", hi: "क्रिया", ar: "فعل", fa: "فعل" },
  adjective: { en: "adjective", ru: "прилагательное", uk: "прикметник", es: "adjetivo", de: "Adjektiv", fr: "adjectif", pt: "adjetivo", tr: "sıfat", id: "kata sifat", zh: "形容词", hi: "विशेषण", ar: "صفة", fa: "صفت" },
  adverb: { en: "adverb", ru: "наречие", uk: "прислівник", es: "adverbio", de: "Adverb", fr: "adverbe", pt: "advérbio", tr: "zarf", id: "kata keterangan", zh: "副词", hi: "क्रिया विशेषण", ar: "ظرف", fa: "قید" },
  pronoun: { en: "pronoun", ru: "местоимение", uk: "займенник", es: "pronombre", de: "Pronomen", fr: "pronom", pt: "pronome", tr: "zamir", id: "kata ganti", zh: "代词", hi: "सर्वनाम", ar: "ضمير", fa: "ضمیر" },
  preposition: { en: "preposition", ru: "предлог", uk: "прийменник", es: "preposición", de: "Präposition", fr: "préposition", pt: "preposição", tr: "edat", id: "kata depan", zh: "介词", hi: "संबंधसूचक", ar: "حرف جر", fa: "حرف اضافه" },
  conjunction: { en: "conjunction", ru: "союз", uk: "сполучник", es: "conjunción", de: "Konjunktion", fr: "conjonction", pt: "conjunção", tr: "bağlaç", id: "kata sambung", zh: "连词", hi: "संयोजक", ar: "حرف عطف", fa: "حرف ربط" },
  interjection: { en: "interjection", ru: "междометие", uk: "вигук", es: "interjección", de: "Interjektion", fr: "interjection", pt: "interjeição", tr: "ünlem", id: "kata seru", zh: "感叹词", hi: "विस्मयादिबोधक", ar: "حرف تعجب", fa: "حرف ندا" },
  numeral: { en: "numeral", ru: "числительное", uk: "числівник", es: "numeral", de: "Numerale", fr: "numéral", pt: "numeral", tr: "sayı", id: "kata bilangan", zh: "数词", hi: "संख्यावाचक", ar: "عدد", fa: "عدد" },
  phrase: { en: "phrase", ru: "фраза", uk: "фраза", es: "frase", de: "Phrase", fr: "expression", pt: "frase", tr: "deyim", id: "frasa", zh: "短语", hi: "वाक्यांश", ar: "عبارة", fa: "عبارت" },
};

// Extra tokens (abbreviations etc.) that map onto a canonical POS.
const EXTRA: Partial<Record<PosKey, string[]>> = {
  noun: ["n", "n.", "сущ", "сущ."],
  verb: ["v", "v.", "гл", "гл.", "phrasal verb", "фразовый глагол"],
  adjective: ["adj", "adj.", "прил", "прил."],
  adverb: ["adv", "adv.", "нар", "нар."],
  preposition: ["prep", "prep."],
  conjunction: ["conj", "conj."],
  interjection: ["interj", "interj."],
  numeral: ["num", "num.", "числ", "числ."],
  phrase: ["idiom", "expression", "идиома", "выражение"],
};

const KEYS = Object.keys(POS) as PosKey[];

// Renders `pos` (stored in some language) in the given UI language. Unknown
// values are returned unchanged.
export function localizePos(pos: string, uiLang: string): string {
  const norm = pos.trim().toLowerCase();
  if (!norm) return pos;
  for (const key of KEYS) {
    const aliases = [...Object.values(POS[key]).map((v) => v.toLowerCase()), ...(EXTRA[key] ?? [])];
    if (aliases.includes(norm)) {
      return POS[key][uiLang] ?? POS[key].en;
    }
  }
  return pos;
}
