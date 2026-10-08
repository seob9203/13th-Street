'use client';
import React, { useRef, useState } from 'react';
import { useEmotes, shrinkImage } from '@/lib/emoteStore';
import { newId } from '@/lib/postStore';
import { useAuth } from '@/lib/auth';

export function EmotePicker({ onPick }: { onPick: (token: string) => void }) {
  const { emotes, setEmotes } = useEmotes();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = async (file?: File) => {
    if (!file) return;
    const name = (prompt('이모티콘 이름을 입력하세요 (띄어쓰기·콜론 없이)', file.name.replace(/\.[^.]+$/, '')) || '')
      .trim().replace(/[\s:]/g, '');
    if (!name) return;
    if (emotes.some(e => e.name === name)) { alert('같은 이름이 이미 있어요'); return; }
    const src = await shrinkImage(file);
    setEmotes([...emotes, { id: newId(), name, src }]);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="btn" onClick={() => setOpen(!open)}
        style={{ padding: '0 10px', fontSize: 16, background: 'transparent' }} title="이모티콘">
        😊
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '110%', right: 0, zIndex: 50, width: 260,
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {emotes.map(e => (
              <div key={e.id} style={{ position: 'relative', cursor: 'pointer', textAlign: 'center' }}
                title={`:${e.name}:`}
                onClick={() => { if (!edit) { onPick(`:${e.name}:`); setOpen(false); } }}>
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
        </div>
      )}
    </span>
  );
}
