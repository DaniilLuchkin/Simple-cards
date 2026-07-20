import { LANGUAGES } from "../lib/i18n";

// Native select — reliable inside the Telegram webview and accessible.
export function LanguageSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border-2 border-black bg-surface px-4 py-3 shadow-toon">
      <span className="text-sm text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border-2 border-black bg-white px-2 py-1 text-sm font-semibold text-ink outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
