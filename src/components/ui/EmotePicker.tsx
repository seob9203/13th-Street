'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEmotes, shrinkImage } from '@/lib/emoteStore';
import { newId } from '@/lib/postStore';
import { useAuth } from '@/lib/auth';

export function EmotePicker({ onPick }: { onPick: (token: string) => void }) {
  const { emotes, setEmotes } = useEmotes();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  // 13th-street: 이모티콘 창을 body로 꺼내서 위치를 직접 잡는다 — 댓글 칸이 넘치는 부분을 잘라서 창이 잘려 보이던 문제
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 8 });
  const fileRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const W = 260;
      const left = Math.min(Math.max(8, r.right - W), Math.max(8, window.innerWidth - W - 8));
      // 위쪽에 자리가 넉넉하면 위로, 모자라면 아래로 띄운다
      const above = r.top > 290 || r.top > window.innerHeight - r.bottom;
      setPos(above
        ? { left, bottom: window.innerHeight - r.top + 6 }
        : { left, top: r.bottom + 6 });
    }
    setOpen(true);
  };

  // 바깥을 누르거나 화면을 스크롤하거나 Esc를 누르면 닫는다 (창 안의 스크롤은 제외)
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const scroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const add = async (file?: File) => {
    if (!file) return;
    const name = (prompt('이모티콘 이름을 입력하세요 (띄어쓰기·콜론 없이)', file.name.replace(/\.[^.]+$/, '')) || '')
      .trim().replace(/[\s:]/g, '');
    if (!name) return;
    if (emotes.some(e => e.name === name)) { alert('같은 이름이 이미 있어요'); return; }
    let src = '';
    try { src = await shrinkImage(file); }
    catch (err) { alert(err instanceof Error ? err.message : '이미지를 읽지 못했어요'); return; }

    setEmotes([...emotes, { id: newId(), name, src }]);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button ref={btnRef} type="button" className="btn" onClick={toggle}
        style={{ padding: '0 10px', fontSize: 16, background: 'transparent' }} title="이모티콘">
        😊
      </button>
      {open && createPortal(
        <div ref={popRef} style={{
          position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, zIndex: 140, width: 260,
          background: 'var(--bg, #fff)', border: '1px solid var(--line, #ddd)',
          borderRadius: 8, padding: 10, boxShadow: '0 4px 14px rgba(0,0,0,.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8, color: 'var(--faint)' }}>
            <span>EMOTICON</span>
            {isAdmin && (
              <span>
                <span style={{ cursor: 'pointer', marginRight: 8 }} onClick={() => fileRef.current?.click()}>+ 추가</span>
                <span style={{ cursor: 'pointer' }} onClick={() => setEdit(!edit)}>{edit ? '완료' : '편집'}</span>
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
            {emotes.map(e => (
              <div key={e.id} style={{ position: 'relative', cursor: 'pointer', textAlign: 'center' }}
                title={`:${e.name}:`}
                onClick={() => { if (!edit) { onPick(`:${e.name}:`); setOpen(false); } }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.src} alt={e.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                {edit && (
                  <span onClick={() => { if (confirm(`「${e.name}」을 지울까요?`)) setEmotes(emotes.filter(x => x.id !== e.id)); }}
                    style={{ position: 'absolute', top: -4, right: -2, background: '#e55', color: '#fff',
                      borderRadius: '50%', width: 16, height: 16, fontSize: 11, lineHeight: '16px' }}>×</span>
                )}
              </div>
            ))}
          </div>
          {emotes.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--faint)' }}>
              {isAdmin ? '「+ 추가」로 이모티콘을 올려보세요' : '아직 이모티콘이 없어요'}
            </p>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => { add(e.target.files?.[0]); e.target.value = ''; }} />
        </div>,
        document.body,
      )}
    </span>
  );
}
