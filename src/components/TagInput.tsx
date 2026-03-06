"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Reusable tag chip editor for text arrays.
 * Renders each tag as a Badge with an X button.
 * Type + Enter or comma adds new tags.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Add keyword...",
  className = "",
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div
      className={`flex flex-wrap gap-1 items-center border rounded-md px-2 py-1.5 bg-white min-h-[36px] cursor-text ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="text-[11px] h-5 px-1.5 gap-0.5 font-normal"
        >
          {tag}
          {!disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 hover:text-red-600 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] text-xs border-0 outline-none bg-transparent py-0.5"
        />
      )}
    </div>
  );
}
