"use client";

import { useId, useRef, useState } from "react";
import {
  CSV_FILE_ACCEPT,
  checkCsvFile,
} from "@/lib/admin/csv-file";

/**
 * One CSV input: choose a file, or paste the rows, whichever suits.
 *
 * The file is read here in the browser and its text put into the box below,
 * so what gets submitted is identical either way and the importer needs no
 * change at all. Keeping the text visible is deliberate — the admin can see
 * what they actually picked, and fix a stray column, before running anything.
 */
export function CsvFileField({
  name,
  label,
  placeholder,
  rows = 6,
  value,
  onChange,
}: {
  name: string;
  label: string;
  placeholder: string;
  rows?: number;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<string>();
  const [error, setError] = useState<string>();
  const fieldId = useId();

  async function load(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setSummary(undefined);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError(`${file.name} could not be read.`);
      return;
    }
    const checked = checkCsvFile(file.name, file.size, text);
    if (!checked.ok) {
      setError(checked.error);
      // Clearing lets the same file be re-picked after it is fixed on disk;
      // a browser fires no change event for an identical selection.
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onChange(text);
    setSummary(checked.summary);
    if (inputRef.current) inputRef.current.value = "";
  }

  function clear() {
    onChange("");
    setSummary(undefined);
    setError(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="text-sm block" data-admin="csv-field">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={fieldId} className="font-semibold">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            data-admin="csv-choose-file"
            className="rounded-sm border border-border px-2.5 py-1 text-xs font-bold hover:border-accent hover:text-accent transition-colors"
          >
            Choose .csv file
          </button>
          {value ? (
            <button
              type="button"
              onClick={clear}
              className="text-xs font-semibold text-text-tertiary hover:text-accent"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* The real control. Hidden rather than absent so the button above can
          drive it and keyboard users still reach it through the label. */}
      <input
        ref={inputRef}
        type="file"
        accept={CSV_FILE_ACCEPT}
        aria-label={`${label} — choose a CSV file`}
        onChange={(event) => void load(event.target.files?.[0])}
        className="sr-only"
      />

      <textarea
        id={fieldId}
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          // Typing over a loaded file means the summary no longer describes
          // what is in the box.
          setSummary(undefined);
        }}
        placeholder={placeholder}
        className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 font-mono text-xs"
      />

      {error ? (
        <p
          role="alert"
          className="mt-1 mb-0 text-xs font-semibold text-red-800"
        >
          {error}
        </p>
      ) : summary ? (
        <p
          data-admin="csv-summary"
          className="mt-1 mb-0 text-xs text-text-tertiary"
        >
          Loaded {summary}
        </p>
      ) : null}
    </div>
  );
}
