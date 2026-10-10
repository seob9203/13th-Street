'use client';
import React from 'react';
import { useBlobUrl } from '@/lib/blobStore';
import type { MemberLite } from '@/lib/members';

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
