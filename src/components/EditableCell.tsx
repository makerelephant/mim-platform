"use client";

import { useState, useRef, useEffect } from "react";

interface EditableCellProps {
  value: string | number | null;
  onSave: (value: string) => Promise<void>;
  type?: "text" | "number" | "select" | "date";
  options?: string[];
  className?: string;
  placeholder?: string;
}

export function EditableCell({ value, onSave, type = "text", options, className = "", placeholder = "—" }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const handleSave = async () => {
    if (editValue === String(value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
    } catch (e) {
      setEditValue(String(value ?? ""));
    }
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditValue(String(value ?? "")); setEditing(false); }
  };

  if (editing) {
    if (type === "select" && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => { setEditValue(e.target.value); }}
          onBlur={handleSave}
          className={`w-full border rounded px-1.5 py-0.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
          disabled={saving}
        >
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full border rounded px-1.5 py-0.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
        disabled={saving}
      />
    );
  }

  const display = value != null && value !== "" ? String(value) : placeholder;

  return (
    <span
      onClick={() => { setEditValue(String(value ?? "")); setEditing(true); }}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 -mx-1 transition-colors inline-block min-w-[2rem] ${value == null || value === "" ? "text-gray-300" : ""} ${className}`}
      title="Click to edit"
    >
      {display}
    </span>
  );
}
