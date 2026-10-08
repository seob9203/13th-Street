// 이모티콘 저장소 — 댓글에서 :이름: 으로 불러 쓴다
import { useLocalList } from '@/lib/postStore';

export type Emote = { id: string; name: string; src: string };

export const EMOTE_KEY = 'ohome.emotes.v1';
export const EMOTE_SEED: Emote[] = [];

export function useEmotes() {
  const [emotes, setEmotes, loaded] = useLocalList<Emote>(EMOTE_KEY, EMOTE_SEED);
  return { emotes, setEmotes, loaded };
}

// 올린 이미지를 작게 줄여서 저장 (용량 절약) — 최대 120px
export function shrinkImage(file: File, max = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    // GIF는 줄이면 움직임이 사라지므로 그대로 둔다
    if (file.type === 'image/gif') {
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
