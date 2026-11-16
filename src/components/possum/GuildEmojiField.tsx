"use client";

import { cloneElement, useRef, type ReactElement, type Ref } from "react";
import GuildEmojiPicker, { type GuildEmoji } from "@/components/possum/GuildEmojiPicker";

type TextControl = HTMLInputElement | HTMLTextAreaElement;

export default function GuildEmojiField({ children, emojis, onInsert }: {
  children: ReactElement<{ ref?: Ref<TextControl> }>;
  emojis: GuildEmoji[];
  onInsert: (value: string) => void;
}) {
  const control = useRef<TextControl>(null);

  function insert(token: string) {
    const element = control.current;
    if (!element) return;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    onInsert(element.value.slice(0, start) + token + element.value.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return <>
    {cloneElement(children, { ref: control })}
    <GuildEmojiPicker emojis={emojis} onInsert={insert} />
  </>;
}
