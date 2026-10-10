'use client';
// 그림백업 상세 (4.11) — 로그형: 세로 스크롤 뷰어 / 단일형: 큰 이미지 + 썸네일 스트립 + 좌우 넘김
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHrefBlock } from '@/components/shell/MenuGuard';
import { sectionHref, MAIN_SEC, useSectionTitle } from '@/lib/sectionStore';
import { useAuth } from '@/lib/auth';
import { useLocalList, fmtDate, newId, CommentRow, COMMENT_KEY, COMMENT_SEED, commentsFor, Comment } from '@/lib/postStore';
import { pushNotif, notifyAdmins } from '@/lib/notifStore';   // 13th-street: 갤러리 댓글
import { BackupPost, BACKUP_SEED } from '@/lib/galleryStore';
import { ConfirmModal, useConfirmDelete } from '@/components/ui/Modal';
import { KInput } from '@/components/ui/Kit';   // 13th-street: 갤러리 댓글
import { EmotePicker } from '@/components/ui/EmotePicker';   // 13th-street: 갤러리 댓글 이모티콘
import { CommentText } from '@/components/ui/CommentText';
import { useMenuSettings } from '@/lib/menuStore';
import { useToast } from '@/components/ui/Toast';
import { useBlobUrl, putBlob, BlobImg } from '@/lib/blobStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { PageTitle } from '@/components/ui/PageText';
import { Lightbox } from '@/components/ui/Lightbox';
import { useBoardSettings, boardBadgeStyle } from '@/lib/boardStore';

// 13th-street: 댓글 이미지 — 붙여넣기·끌어다 놓기·사진 버튼 (글자가 같이 붙는 경우는 평소처럼 둔다)
const imgFilesOf = (dt?: DataTransfer | null) =>
  Array.from(dt?.files ?? []).filter(f => f.type.startsWith('image/'));
const pasteImgs = (e: React.ClipboardEvent, add: (fs: File[]) => void) => {
  const fs = imgFilesOf(e.clipboardData);
  if (fs.length === 0 || e.clipboardData.getData('text/plain')) return;
  e.preventDefault();
  add(fs);
};
const overFiles = (e: React.DragEvent) => {
  if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
};
const dropImgs = (e: React.DragEvent, add: (fs: File[]) => void) => {
  const fs = imgFilesOf(e.dataTransfer);
  if (fs.length === 0) return;
  e.preventDefault();
  add(fs);
};

export default function BackupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [posts, setPosts, loaded] = useLocalList<BackupPost>('ohome.backup.v1', BACKUP_SEED);
  const [cur, setCur] = useState(0);
  const [delAsk, setDelAsk] = useState(false);
  const [lbOpen, setLbOpen] = useState(false); // 단일형 — 클릭 확대 보기
    // 13th-street: 갤러리 회원 댓글 — 갤러리마다 환경설정에서 켠 곳만
  const toast = useToast();
  const del = useConfirmDelete();
  const [menuSet] = useMenuSettings();
  const [cmtRows, setCmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const [cmt, setCmt] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
    // 13th-street: 댓글 이미지
  const [cmtFiles, setCmtFiles] = useState<File[]>([]);
  const [cmtUrls, setCmtUrls] = useState<string[]>([]);
  const [cmtBusy, setCmtBusy] = useState(false);
  const [cmtLb, setCmtLb] = useState<{ srcs: string[]; idx: number } | null>(null);
  const cmtImgRef = useRef<HTMLInputElement>(null);
  const addCmtFiles = (list: FileList | File[] | null) => {
    if (!list || !user) return;
    const arr = Array.from(list).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    if (cmtFiles.length + arr.length > 4) toast('이미지는 최대 4장까지 첨부할 수 있습니다');
    const next = [...cmtFiles, ...arr].slice(0, 4);
    setCmtFiles(next);
    setCmtUrls(next.map(f => URL.createObjectURL(f)));
  };
  const removeCmtFile = (i: number) => {
    const next = cmtFiles.filter((_, x) => x !== i);
    setCmtFiles(next);
    setCmtUrls(next.map(f => URL.createObjectURL(f)));
  };
  const { st: boardSet } = useBoardSettings(); // 유형 뱃지 색 (환경설정 > 게시판 관리)

  const p = posts.find(x => x.id === id);
  /* 이 글이 속한 곳이 비공개면 주소로 들어와도 열리지 않게 (v2.0 사용자 요청).
     글 주소에는 섹션이 없어 MenuGuard가 못 막는다 — 글을 읽어 소속을 알아낸 여기서 판정한다.
     **다른 early return보다 먼저 불러야 한다**(훅이므로 렌더마다 개수가 같아야 한다) */
  const blocked = useHrefBlock(p && sectionHref('gallery', p.secId ?? MAIN_SEC));
  // 큰 글씨 — 추가 섹션이면 그 이름, 눌렀을 때도 그 목록으로 (v2.0 사용자 제보)
  const tt = useSectionTitle('gallery', p?.secId, 'GALLERY');
  
  // 13th-street: 글별 배경 밝게/어둡게 — 이 글을 보는 동안만 홈 색(배경·본문 칸·상단 메뉴바)을 덮어쓰고, 나가면 되돌린다
  const bgMode = p?.bgMode;
  useEffect(() => {
    if (!bgMode) return;
    const THEMES = {
      dark: {
        '--bg-g1': '#2b3038', '--bg-g2': '#121418',
        '--page-title': '#eceef1', '--page-desc': '#9aa0a9',
        '--panel': 'rgba(30,33,39,.94)', '--panel-solid': '#1e2127',
        '--ink': '#e8eaee', '--sub': '#aab0ba', '--faint': '#8b919b', '--line': '#343a44',
        '--top-bg': 'rgba(20,22,27,.82)', '--top-fg': '#aab0ba', '--top-hv': '#ffffff', '--top-brand': '#f2f3f5',
        '--dd-bg': 'rgba(28,31,37,.97)', '--dd-fg': '#c6cad1', '--dd-hv': 'rgba(255,255,255,.1)',
        '--line-dark': 'rgba(255,255,255,.14)',
      },
      light: {
        '--bg-g1': '#f3f4f6', '--bg-g2': '#dcdfe4',
        '--page-title': '#1d2025', '--page-desc': '#5d636d',
        '--top-bg': 'rgba(250,250,251,.88)', '--top-fg': '#5d636d', '--top-hv': '#1d2025', '--top-brand': '#1d2025',
        '--dd-bg': 'rgba(252,252,253,.98)', '--dd-fg': '#3a3f47', '--dd-hv': 'rgba(0,0,0,.06)',
        '--line-dark': 'rgba(0,0,0,.1)',
      },
    } as const;
    const root = document.documentElement;
    const prev: Record<string, string> = {};
    Object.entries(THEMES[bgMode]).forEach(([k, v]) => {
      prev[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    });
    // 색이 코드에 고정된 부분(설명 글씨·흰 버튼)은 변수로 못 바꾸니 규칙을 잠깐 덧붙인다
    const css = document.createElement('style');
    css.textContent = bgMode === 'dark'
      ? '.post-body,.post-body p,.post-body li{color:#d5d9df}'
        + '.btn-ghost{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.18);color:#c6cad1}'
        + '.btn-ghost:hover{border-color:rgba(255,255,255,.4);color:#fff}'
      : '';
    document.head.appendChild(css);
    return () => {
      css.remove();
      Object.entries(prev).forEach(([k, v]) => {
        if (v) root.style.setProperty(k, v); else root.style.removeProperty(k);
      });
    };
  }, [bgMode]);
  
  // 13th-street: 다른 글로 넘어가면 맨 위로, 이미지 순번은 처음으로
  useEffect(() => {
    document.getElementById('appMain')?.scrollTo({ top: 0 });
    setCur(0);
  }, [id]);
  if (blocked) return blocked;
  if (!loaded) return <section className="page" />;
  if (!p || (p.visibility === 'private' && !isAdmin) || (p.visibility === 'member' && !user)) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>게시물을 찾을 수 없거나 열람 권한이 없습니다</p></div>
      </section>
    );
  }

  const imgs: { url?: string; ph?: string }[] = p.images.length
    ? p.images.map(u => ({ url: u }))
    : p.phList.map(c => ({ ph: c }));
  /* 글쓴이 확인 (v2.0 발견) — **둘 다 없을 때 같다고 보면 안 된다.**
     예전 글이나 손님이 쓴 글은 authorId가 없는데, 비로그인 방문자도 user?.id가 없어
     `undefined === undefined`로 통과했다 — 아무나 남의 글을 고치고 지울 수 있었다 */
  const canManage = isAdmin || (!!p.authorId && p.authorId === user?.id);
  
  // 13th-street: 갤러리 댓글 — 켜 둔 갤러리에서만 보이고, 쓰는 건 로그인한 회원만 (손님은 읽기만)
  const showComments = !!menuSet.backupCommentsBySec?.[p.secId ?? MAIN_SEC];
  const comments = commentsFor(cmtRows, 'gallery', p.id);
  const cmtRoots = comments.filter(c => !c.parentId);
  const cmtChildren = (pid: string) => comments.filter(c => c.parentId === pid);
   const addComment = async () => {
    if (!user || cmtBusy || (!cmt.trim() && cmtFiles.length === 0)) return;
    // 13th-street: 이미지를 먼저 올린다
    const images: string[] = [];
    if (cmtFiles.length) {
      setCmtBusy(true);
      try { for (const f of cmtFiles) images.push(await putBlob(f)); }
      catch (e) {
        toast(`이미지를 올리지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`);
        setCmtBusy(false);
        return;
      }
      setCmtBusy(false);
    }
    const c: CommentRow = {
      id: newId(), text: cmt.trim(), date: new Date().toISOString(), parentId: replyTo ?? undefined,
      target: 'gallery', targetId: p.id, author: user.nickname, authorId: user.id,
            ...(images.length ? { images } : {}),
    };
    setCmtRows([...cmtRows, c]);
    const href = `/gallery/${p.id}`;
    // 글쓴이와 관리자에게, 답글이면 그 대화에 참여한 사람들에게도
    if (p.authorId && p.authorId !== user.id) {
      pushNotif({ type: 'comment', toUserId: p.authorId, href, title: `「${p.title}」에 새 댓글`, body: `${c.author} — ${c.text.slice(0, 50)}` });
    }
    notifyAdmins({ type: 'comment', href, title: `「${p.title}」에 새 댓글`, body: `${c.author} — ${c.text.slice(0, 50)}` });
    if (replyTo) {
      const seen = new Set<string>();
      for (const t of comments.filter(x => x.id === replyTo || x.parentId === replyTo)) {
        const to = t.authorId;
        if (!to || to === user.id || to === p.authorId || seen.has(to)) continue;
        seen.add(to);
        pushNotif({ type: 'comment', toUserId: to, href, title: '참여한 댓글에 새 답글이 달렸습니다', body: `${c.author} — ${c.text.slice(0, 50)}` });
      }
    }
    setCmt(''); setReplyTo(null); setCmtFiles([]); setCmtUrls([]);
  };
  const removeComment = (c: Comment) =>
    del.ask('이 댓글을 삭제하시겠습니까?', () =>
      setCmtRows(cmtRows.filter(x => !(x.id === c.id || x.parentId === c.id))));
  
  // 13th-street: 이전화/다음화 — 같은 갤러리에서 목록 순서 그대로 (목록은 최신 글이 위)
  const sid = p.secId ?? MAIN_SEC;
  const seq = posts.filter(x => (x.secId ?? MAIN_SEC) === sid
    && (isAdmin || x.visibility === 'public' || (x.visibility === 'member' && !!user)));
  const at = seq.findIndex(x => x.id === p.id);
  const nextPost = at > 0 ? seq[at - 1] : undefined;                               // 목록에서 바로 위 = 더 최근 글
  const prevPost = at >= 0 && at < seq.length - 1 ? seq[at + 1] : undefined;      // 목록에서 바로 아래 = 더 예전 글

  // 파일 id/URL 모두 지원 — blobStore에서 로드 (새로고침에도 유지)
  // natural: 고정 프레임 안에서 확대 없이 원본 크기 그대로 가운데 (단일형 — 프레임보다 크면 축소만)
  const Img = ({ im, ratio, natural }: { im: { url?: string; ph?: string }; ratio?: string; natural?: boolean }) => {
    const u = useBlobUrl(im.url);
    if (u) {
      // eslint-disable-next-line @next/next/no-img-element
      // 원본보다 크게 늘리지 않는다 — 폭이 모자랄 때만 줄이고, 작은 그림은 작은 그대로 (v2.0 사용자 확정)
      return <img src={u} alt="" style={natural
        ? { maxWidth: '100%', maxHeight: '100%', display: 'block' }
        : { maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />;
    }
    return <div className={`ph ${im.ph ?? ''}`}
      style={natural ? { width: '100%', height: '100%' } : { aspectRatio: ratio ?? '16/10' }}><span>IMAGE</span></div>;
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={tt.href}>{tt.title}</PageTitle>
        <p>
          {p.category} · {p.author} · {fmtDate(p.date)}{p.madeDate ? ` · 제작 ${p.madeDate}` : ''}
          {/* 태그 (v2.0 사용자 요청) — 목록과 같은 표기 */}
          {(p.tags ?? []).map(t => <i key={t} className="tag-in">#{t}</i>)}
        </p>
        <div className="head-actions">
          {canManage && <button className="btn btn-dark" onClick={() => router.push(`/gallery/${p.id}/edit`)}>EDIT</button>}
          {canManage && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
        </div>
      </div>

      {/* 본문만 폭 제한 — 헤더는 풀폭 위치 유지 */}
      <div className="panel" style={{ padding: 20, maxWidth: 960, margin: '0 auto' }}>
        {/* 제목·뱃지 세로 중앙 정렬 + 아래 여백 확보 */}
        <h2 style={{ fontSize: 18, marginBottom: p.desc ? 8 : 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {p.title}
          <span style={boardBadgeStyle(boardSet.gallery.find(b => b.id === p.type))}>
            {boardSet.gallery.find(b => b.id === p.type)?.label}
          </span>
        </h2>
        {p.desc && (
          <div className="post-body" style={{ fontSize: 12.5, margin: '0 0 16px' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.desc) }} />
        )}

        {p.type === 'log' ? (
          /* 로그형 — 웹툰식 세로 스크롤 · 이미지 사이 틈 없이 이어 붙임 (만화 연결) */
          <div style={{ borderRadius: 10, overflow: 'hidden' }}>
            {imgs.map((im, i) => <Img key={i} im={im} />)}
          </div>
                ) : p.type === 'page' ? (
          /* 페이지형 (13th-street) — 한 장씩, 좌→우 넘김 */
          <PageViewer key={p.id} imgs={imgs} />
        ) : p.type === 'vlist' ? (
          /* 단일(세로정렬) (v1.9) — 로그와 달리 이미지 사이 갭을 두고 세로로 나열, 클릭 확대 */
          <div style={{ display: 'grid', gap: 14 }}>
            {imgs.map((im, i) => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden', cursor: im.url ? 'zoom-in' : undefined }}
                onClick={() => { if (im.url) { setCur(i); setLbOpen(true); } }}>
                <Img im={im} />
              </div>
            ))}
          </div>
        ) : (
          /* 단일형 — 큰 이미지 + 좌우 넘김 + 썸네일 스트립 */
          <>
            <div className="single-viewer">
              {/* 고정 16:10 프레임 안 가운데 배치 — 실제 이미지일 때만 클릭 확대.
                  grid는 암시적 row가 콘텐츠 높이로 늘어나 max-height:100%가 무력화됨(세로 긴 그림 잘림) → flex (v1.9) */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: imgs[cur].url ? 'zoom-in' : undefined,
              }}
                onClick={() => { if (imgs[cur].url) setLbOpen(true); }}>
                <Img im={imgs[cur]} natural />
              </div>
              {imgs.length > 1 && (
                <>
                  <button className="nav" style={{ left: 10 }}
                    onClick={() => setCur(c => (c - 1 + imgs.length) % imgs.length)}>◁</button>
                  <button className="nav" style={{ right: 10 }}
                    onClick={() => setCur(c => (c + 1) % imgs.length)}>▷</button>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="thumb-strip">
                {imgs.map((im, i) => (
                  <div key={i} className={`t ${i === cur ? 'on' : ''}`} onClick={() => setCur(i)}>
                    <Img im={im} ratio="4/3" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 13th-street: 이전화 / 다음화 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, maxWidth: 960, margin: '14px auto 0' }}>
        <button className="btn btn-dark" disabled={!prevPost} title={prevPost?.title}
          onClick={() => prevPost && router.push(`/gallery/${prevPost.id}`)}>◁ 이전 화</button>
        <button className="btn btn-dark" onClick={() => router.push(tt.href)}>목록</button>
        <button className="btn btn-dark" disabled={!nextPost} title={nextPost?.title}
          onClick={() => nextPost && router.push(`/gallery/${nextPost.id}`)}>다음 화 ▷</button>
      </div>
      
      {/* 13th-street: 갤러리 회원 댓글 */}
      {showComments && (
        <div className="panel" style={{ padding: 20, maxWidth: 960, margin: '14px auto 0' }}>
          <div className="thr-cmts" style={{ padding: 0, border: 'none' }}>
            <h4>COMMENTS {comments.length > 0 && <span>{comments.length}</span>}</h4>
            {cmtRoots.map(c => (
              <React.Fragment key={c.id}>
                {[c, ...cmtChildren(c.id)].map((x, i) => (
                  <div key={x.id} className={`cmt ${i > 0 ? 'reply-depth' : ''}`}>
                    <b>{x.author}</b><small>{fmtDate(x.date)}</small>
                    {user && i === 0 && (
                      <small style={{ cursor: 'var(--cur-pointer,pointer)', color: 'var(--accent)', marginLeft: 8 }}
                        onClick={() => setReplyTo(replyTo === x.id ? null : x.id)}>
                        {replyTo === x.id ? '답글 취소' : '답글'}
                      </small>
                    )}
                    {(isAdmin || (user && x.authorId === user.id)) && (
                      <small style={{ cursor: 'var(--cur-pointer,pointer)', marginLeft: 8 }}
                        onClick={() => removeComment(x)}>삭제</small>
                    )}
                    {x.text && <p><CommentText text={x.text} /></p>}
                    {x.images && x.images.length > 0 && (
                      <div className={`thr-imgs ${x.images.length === 1 ? 'one' : ''}`} style={{ maxWidth: 260, margin: '6px 0 0' }}>
                        {x.images.map((id, k) => (
                          <div key={id} className="im" onClick={() => setCmtLb({ srcs: x.images!, idx: k })}><BlobImg fileRef={id} /></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))}
            {comments.length === 0 && <p className="hint" style={{ margin: 0 }}>{user ? '첫 댓글을 남겨보세요' : '댓글이 없습니다'}</p>}
          </div>
          {user ? (
<div onPaste={e => pasteImgs(e, addCmtFiles)} onDragOver={overFiles} onDrop={e => dropImgs(e, addCmtFiles)}>
              {cmtUrls.length > 0 && (
                <div className="thr-att" style={{ padding: '12px 0 0' }}>
                  {cmtUrls.map((u, i) => (
                    <div key={u} className="at">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" />
                      <button onClick={() => removeCmtFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="cmt-input" style={{ padding: '12px 0 0' }}>
                <KInput placeholder={replyTo ? '답글 작성...' : '댓글 남기기...'} value={cmt}
                  onChange={e => setCmt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addComment(); }} />
                <input ref={cmtImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { addCmtFiles(e.target.files); e.target.value = ''; }} />
                <button className="icobtn" data-tip="사진 추가 (최대 4장)" onClick={() => cmtImgRef.current?.click()}>
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <circle cx="9" cy="10" r="1.6" />
                    <path d="M3.5 17.5 9 13l4 3.5 3.5-3 4 4" />
                  </svg>
                </button>
                <EmotePicker onPick={t => setCmt(cmt + t)} />
                <button className="btn btn-dark" disabled={cmtBusy} onClick={addComment}>POST</button>
              </div>
            </div>
          ) : (
            <p className="hint" style={{ margin: '12px 0 0' }}>댓글은 로그인한 회원만 쓸 수 있습니다</p>
          )}
        </div>
      )}
      {/* 단일형·단일(세로) 확대 보기 — 뷰어와 같은 순번에서 시작, ‹ ›로 이어 넘김 */}
      {lbOpen && (p.type === 'single' || p.type === 'vlist') && p.images.length > 0 && (
        <Lightbox srcs={p.images} index={cur} onClose={() => setLbOpen(false)} />
      )}

      {cmtLb && <Lightbox srcs={cmtLb.srcs} index={cmtLb.idx} onClose={() => setCmtLb(null)} />}
      {del.element}
      <ConfirmModal open={delAsk} title="게시물을 삭제하시겠습니까?" body="삭제한 게시물은 복구할 수 없습니다."
        onClose={() => setDelAsk(false)}
        buttons={[
                    { label: 'DELETE', kind: 'accent', onClick: () => { setPosts(posts.filter(x => x.id !== p.id)); setCmtRows(cmtRows.filter(c => !(c.target === 'gallery' && c.targetId === p.id))); router.push(tt.href); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
        ]} />
    </section>
  );
}

/** 페이지형 뷰어 (13th-street) — 만화책처럼 한 장씩 보고 좌→우로 넘긴다.
 *  이미지의 오른쪽 절반을 누르면 다음 장, 왼쪽 절반은 이전 장. 키보드 ← → 도 된다. */
function PageViewer({ imgs }: { imgs: { url?: string; ph?: string }[] }) {
  const [n, setN] = useState(0);
    // 장을 넘기면 뷰어가 화면 맨 위에 오도록 (처음 열 때는 움직이지 않음)
  const boxRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [n]);
  const total = imgs.length;
  const go = (d: number) => setN(c => Math.min(total - 1, Math.max(0, c + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  const im = imgs[n];
  const u = useBlobUrl(im?.url);
  if (!im) return null;
  // eslint-disable-next-line @next/next/no-img-element
    const pic = u ? <img src={u} alt="" style={{ maxWidth: '100%', maxHeight: 'calc(100dvh - 180px)', width: 'auto', height: 'auto', display: 'block', margin: '0 auto' }} /> : (
    <div className={`ph ${im.ph ?? ''}`} style={{ aspectRatio: '16/10' }}><span>IMAGE</span></div>
  );
  const btn = { padding: '4px 16px' } as const;
  return (
      <div ref={boxRef} style={{ scrollMarginTop: 80 }}>
      <div style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          go(e.clientX - r.left < r.width / 2 ? -1 : 1);
        }}>
        {pic}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 14 }}>
        <button className="btn btn-ghost" style={btn} disabled={n === 0} onClick={() => go(-1)}>◁</button>
        <small style={{ letterSpacing: '.1em' }}>{n + 1} / {total}</small>
        <button className="btn btn-ghost" style={btn} disabled={n === total - 1} onClick={() => go(1)}>▷</button>
      </div>
    </div>
  );
}
