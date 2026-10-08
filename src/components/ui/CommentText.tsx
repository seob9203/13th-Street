'use client';
import React from 'react';
import { useEmotes } from '@/lib/emoteStore';

export function CommentText({ text }: { text: string }) {
  const { emotes } = useEmotes();
  const map = new Map(emotes.map(e => [e.name, e.src]));
  const parts = text.split(/(:[^:\s]{1,30}:)/g);
  return (
    <>
      {parts.map((p, i) => {
        const src = /^:[^:\s]+:$/.test(p) ? map.get(p.slice(1, -1)) : undefined;
        return src
          ? <img key={i} src={src} alt={p} title={p}
              style={{ height: 60, verticalAlign: 'middle', margin: '2px 2px' }} />
          : <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}
