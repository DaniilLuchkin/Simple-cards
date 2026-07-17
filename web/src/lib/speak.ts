// Speaks text via an audio URL when available, otherwise the browser's
// SpeechSynthesis. `lang` is a BCP-47 code for the synthesized voice.
export function speak(text: string, opts?: { audioUrl?: string; lang?: string }) {
  if (opts?.audioUrl) {
    new Audio(opts.audioUrl).play().catch(() => fallbackTts(text, opts.lang));
    return;
  }
  fallbackTts(text, opts?.lang);
}

function fallbackTts(text: string, lang = "en-US") {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  synth.speak(utterance);
}
