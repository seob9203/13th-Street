'use client';
// 이모티콘 저장소 — 「사이트 설정」에 저장해서 모든 방문자에게 보이게 한다
import { useEffect, useState } from 'react';
import { isServerMode } from '@/lib/supabase';
import { fetchSetting, saveSetting } from '@/lib/db';

export type Emote = { id: string; name: string; src: string };

const SETTING_KEY = 'emotes';
const LOCAL_KEY = 'ohome.emotes.v1';

// 화면 여러 곳(댓글마다)이 한 번만 불러오도록 같이 쓰는 보관함
let cache: Emote[] = [];
let loadedOnce = false;
let loading: Promise<void> | null = null;
const listeners = new Set<(l: Emote[]) => void>();
const emit = () => listeners.forEach(fn => fn(cache));

function loadOnce() {
  if (loadedOnce) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        if (isServerMode()) {
          cache = (await fetchSetting<Emote[]>(SETTING_KEY)) ?? [];
        } else {
          cache = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        }
      } catch { cache = []; }
      loadedOnce = true;
      emit();
    })();
  }
  return loading;
}

export function useEmotes() {
  const [emotes, setList] = useState<Emote[]>(cache);
  const [loaded, setLoaded] = useState(loadedOnce);
  useEffect(() => {
    const fn = (l: Emote[]) => { setList(l); setLoaded(true); };
    listeners.add(fn);
    loadOnce().then(() => fn(cache));
    return () => { listeners.delete(fn); };
  }, []);

  const setEmotes = async (next: Emote[]) => {
    const prev = cache;
    cache = next; emit();                 // 화면엔 바로 반영
    try {
      if (isServerMode()) await saveSetting(SETTING_KEY, next);
      else localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch (e) {
      cache = prev; emit();               // 실패하면 되돌리고 알려준다
      alert('이모티콘을 저장하지 못했어요: ' + (e instanceof Error ? e.message : String(e)));
    }
  };
  return { emotes, setEmotes, loaded };
}

// 올린 이미지를 작게 줄여서 저장 (서버 용량 절약) — 최대 120px
export function shrinkImage(file: File, max = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif') {
      if (file.size > 300 * 1024) { reject(new Error('GIF는 300KB 이하만 올릴 수 있어요')); return; }
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
