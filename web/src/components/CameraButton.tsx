import { useRef, useState } from "react";
import { usePrefs } from "../lib/prefs";

// Round camera button in the top row. Opens the device camera, shows a
// use/retake preview, and generates a card from the chosen photo.
export function CameraButton({ onGenerate }: { onGenerate: (file: File) => Promise<void> }) {
  const { t } = usePrefs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCamera() {
    inputRef.current?.click();
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setBusy(false);
    setError(null);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function use() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onGenerate(file);
      reset();
    } catch {
      setError(t("captureFailed"));
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openCamera}
        aria-label={t("camera")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-base shadow-toon-sm"
      >
        📷
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-[18px] border-2 border-black bg-surface p-5 shadow-toon-lg">
            <h3 className="mb-3 text-base font-bold text-ink">{t("camera")}</h3>
            <img
              src={preview}
              alt=""
              className="mb-4 max-h-72 w-full rounded-xl border-2 border-black object-contain"
            />
            {error && <p className="mb-3 text-sm font-semibold text-red-500">{error}</p>}
            {busy ? (
              <p className="py-2 text-center text-sm font-semibold text-ink">{t("captureGenerating")}</p>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={openCamera}
                  className="flex-1 rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
                >
                  {t("retakePhoto")}
                </button>
                <button
                  type="button"
                  onClick={use}
                  className="flex-1 rounded-2xl border-2 border-black bg-mint px-4 py-2.5 text-sm font-semibold text-ink shadow-toon-sm"
                >
                  {t("useThisPhoto")}
                </button>
              </div>
            )}
            {!busy && (
              <button
                type="button"
                onClick={reset}
                className="mt-3 w-full text-center text-sm text-muted"
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
