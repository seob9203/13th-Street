'use client';
// 회원 목록 (v2.0) — 서버 모드면 DB의 회원 프로필, 아니면 브라우저 계정
import { useEffect, useState } from 'react';
import { backend, isServerMode } from './backend';
import React from 'react';
import { useBlobUrl } from './blobStore';

export interface MemberLite { id: string; nickname: string; role?: 'admin' | 'member'; avatarUrl?: string; avatarColor?: string }

/** 로컬(브라우저) 계정 목록 — 서버 없이 개발할 때 */
export function memberPool(): MemberLite[] {
  const base: MemberLite[] = [
    { id: 'admin', nickname: '관리자' },
    { id: 'guest', nickname: '지인회원' },
  ];
  try {
    const reg = JSON.parse(localStorage.getItem('ohome.mockreg.v1') ?? '{}') as
      Record<string, { user?: MemberLite }>;
    for (const k of Object.keys(reg)) {
      const u = reg[k]?.user;
      if (u && !base.some(b => b.id === u.id)) base.push({ id: u.id, nickname: u.nickname });
    }
  } catch { /* 무시 */ }
  return base;
}

/** 화면에서 쓰는 회원 목록 — 서버 모드에서는 가입 회원을 DB에서 가져온다 */
export function useMembers(): MemberLite[] {
  const [list, setList] = useState<MemberLite[]>(() => (isServerMode() ? [] : memberPool()));
  useEffect(() => {
    const be = backend();
    if (!isServerMode() || !be) { setList(memberPool()); return; }
    let alive = true;
    be.listMembers()
          .then(rows => { if (alive) setList(rows.map(r => ({ id: r.id, nickname: r.nickname, role: r.role, avatarUrl: r.avatarUrl, avatarColor: r.avatarColor }))); })
      .catch(() => { /* 권한·네트워크 문제면 빈 목록 */ });
    return () => { alive = false; };
  }, []);
  return list;
}

/** 프로필 원 (13th-street) — 사진이 있으면 사진, 없으면 프로필 색, 그것도 없으면 회색 */
export function ProfileDot({ member, size = 24 }: { member?: MemberLite; size?: number }) {
  const src = useBlobUrl(member?.avatarUrl);
  const bg = member?.avatarColor || '#b9bdc4';
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%', flexShrink: 0,
      verticalAlign: 'middle', marginRight: 7, overflow: 'hidden', background: bg,
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)',
    }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
    </span>
  );
}
