import { useState, useEffect, useRef, useCallback } from "react";

export type SavedValues = Record<string, string>;

const STORAGE_PREFIX = "form_autosave_";

export function useFormAutoSave(formId: number | null) {
  const storageKey = formId != null ? `${STORAGE_PREFIX}${formId}` : null;

  const [savedValues, setSavedValues] = useState<SavedValues>({});
  const [hasSavedData, setHasSavedData] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved data on mount (once per formId)
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedValues;
        const hasValues = Object.values(parsed).some((v) => v.trim() !== "");
        if (hasValues) {
          setSavedValues(parsed);
          setHasSavedData(true);
        }
      }
    } catch {
      // Corrupted data — remove silently
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  /** Persist current field values (debounced 500 ms) */
  const save = useCallback(
    (values: SavedValues) => {
      if (!storageKey) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(values));
        } catch {
          // Storage quota exceeded — ignore silently
        }
      }, 500);
    },
    [storageKey]
  );

  /** Remove saved data after successful submission */
  const clearSave = useCallback(() => {
    if (!storageKey) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    localStorage.removeItem(storageKey);
    setSavedValues({});
    setHasSavedData(false);
  }, [storageKey]);

  /** Hide restore banner without applying saved data */
  const dismissBanner = useCallback(() => {
    setHasSavedData(false);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { savedValues, hasSavedData, save, clearSave, dismissBanner };
}
