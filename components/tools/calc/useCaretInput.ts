"use client";

import * as React from "react";

/**
 * Lets an on-screen keypad edit a text input at the caret, while physical-keyboard typing still works
 * as normal. `inputMode="none"` should be set on the input so phones show only our keypad.
 */
export function useCaretInput(value: string, setValue: (v: string) => void) {
  const ref = React.useRef<HTMLInputElement>(null);
  const pending = React.useRef<number | null>(null);

  const insert = (text: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    pending.current = start + text.length;
    setValue(value.slice(0, start) + text + value.slice(end));
    el?.focus();
  };

  /** Deletes the selection, or the character before the caret (a whole "sin(" style name at once). */
  const backspace = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    if (start !== end) {
      pending.current = start;
      setValue(value.slice(0, start) + value.slice(end));
    } else if (start > 0) {
      const before = value.slice(0, start);
      const name = /(?:a?(?:sin|cos|tan|sec|csc|cot)h?|log2|log|ln|sqrt|cbrt|abs|exp|nroot|ncr|npr|ans|pi)\($|(?:ans|pi)$/.exec(before);
      const cut = name ? name[0].length : 1;
      pending.current = start - cut;
      setValue(before.slice(0, start - cut) + value.slice(start));
    }
    el?.focus();
  };

  React.useLayoutEffect(() => {
    if (pending.current !== null && ref.current) {
      ref.current.setSelectionRange(pending.current, pending.current);
      pending.current = null;
    }
  });

  return { ref, insert, backspace };
}
