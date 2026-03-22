import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postService, fileService, userService } from '../services';
import { Post, Comment, PostType, PostStatus, User } from '../types';
import { formatDistanceToNow } from 'date-fns';

type CreateMode = 'post' | 'article' | null;
type FeedTab = 'feed' | 'drafts';

const FeedPage: React.FC = () => {
  const { user } = useAuth();
  const [feedTab, setFeedTab] = useState<FeedTab>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  // Post form
  const [postContent, setPostContent] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postStatus, setPostStatus] = useState<PostStatus>('PUBLISHED');
  const [scheduledAt, setScheduledAt] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creating, setCreating] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Article form
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Draft editing
  const [editingDraft, setEditingDraft] = useState<Post | null>(null);

  // Comments state
  const [openCommentPostId, setOpenCommentPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Share modal
  const [sharePostId, setSharePostId] = useState<number | null>(null);
  const [shareText, setShareText] = useState('');
  const [sharing, setSharing] = useState(false);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);

  const initials = (fn = '', ln = '') => `${fn[0] ?? ''}${ln[0] ?? ''}`.toUpperCase();

  // ── Load feed ──────────────────────────────────────────────────────────────
  const loadPosts = useCallback(async (pageNum: number) => {
    try {
      const res = await postService.getFeedPosts(pageNum, 10);
      const { content, last } = res.data.data;
      setPosts(prev => pageNum === 0 ? content : [...prev, ...content]);
      setHasMore(!last);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const res = await postService.getDraftPosts(0, 20);
      setDrafts(res.data.data.content);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadPosts(0); }, [loadPosts]);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await fileService.upload(file);
      setPostImageUrl(res.data.data);
    } catch (err) {
      alert('Image upload failed. Please try again.');
    } finally { setUploadingImage(false); }
  };

  // ── Create post ───────────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!postContent.trim()) return;
    setCreating(true);
    try {
      const hashtags = (postContent.match(/#\w+/g) || []).map(h => h.slice(1));
      const payload = {
        content: postContent, postType: 'POST' as PostType,
        status: postStatus, imageUrl: postImageUrl || undefined,
        hashtags, scheduledAt: postStatus === 'SCHEDULED' && scheduledAt ? scheduledAt : undefined,
      };

      if (editingDraft) {
        await postService.updatePost(editingDraft.id, { ...payload, status: 'DRAFT' as PostStatus });
        if (postStatus === 'PUBLISHED') {
          const publishRes = await postService.publishDraft(editingDraft.id);
          setDrafts(prev => prev.filter(d => d.id !== editingDraft.id));
          setPosts(prev => [publishRes.data.data, ...prev]);
          showToast('Draft published to feed!');
        } else {
          loadDrafts();
          showToast('Draft updated!');
        }
        setEditingDraft(null);
      } else {
        const res = await postService.createPost(payload);
        if (postStatus === 'PUBLISHED') {
          setPosts(prev => [res.data.data, ...prev]);
          showToast('Post published!');
        } else if (postStatus === 'DRAFT') {
          loadDrafts();
          showToast('Draft saved!');
        } else {
          showToast('Post scheduled!');
        }
      }

      setPostContent(''); setPostImageUrl(''); setPostStatus('PUBLISHED');
      setScheduledAt(''); setCreateMode(null);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  // ── Rich text editor helpers ───────────────────────────────────────────────
  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateActiveFormats();
  };

  const insertBlock = (tag: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // If cursor is inside an existing block, wrap the line
    const block = document.createElement(tag);
    block.innerHTML = '&#8203;'; // zero-width space to allow cursor
    range.deleteContents();
    range.insertNode(block);
    // Move cursor inside the new block
    const newRange = document.createRange();
    newRange.setStart(block, block.childNodes.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    syncEditorContent();
    updateActiveFormats();
  };

  const insertHorizontalRule = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, '<hr/><p><br></p>');
    syncEditorContent();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (!url) return;
    execFormat('createLink', url);
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
    if (document.queryCommandState('insertUnorderedList')) formats.add('ul');
    if (document.queryCommandState('insertOrderedList')) formats.add('ol');
    setActiveFormats(formats);
  };

  const syncEditorContent = () => {
    if (editorRef.current) setArticleContent(editorRef.current.innerHTML);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); execFormat('bold'); }
      if (e.key === 'i') { e.preventDefault(); execFormat('italic'); }
      if (e.key === 'u') { e.preventDefault(); execFormat('underline'); }
    }
  };

  // Sync editor HTML → articleContent on every input
  const handleEditorInput = () => {
    syncEditorContent();
    updateActiveFormats();
  };

  // When article mode opens, init the editor
  useEffect(() => {
    if (createMode === 'article' && editorRef.current) {
      if (!editorRef.current.innerHTML || editorRef.current.innerHTML === '<br>') {
        editorRef.current.innerHTML = '<p><br></p>';
      }
      editorRef.current.focus();
    }
  }, [createMode]);

  // ── Create article ─────────────────────────────────────────────────────────
  const handleCreateArticle = async (status: PostStatus) => {
    const content = editorRef.current?.innerHTML || '';
    const plainText = editorRef.current?.innerText || '';
    if (!articleTitle.trim() || !plainText.trim()) return;
    setCreating(true);
    try {
      const res = await postService.createPost({
        content: `<h1>${articleTitle}</h1>${content}`,
        postType: 'ARTICLE' as PostType, status,
        hashtags: (plainText.match(/#\w+/g) || []).map(h => h.slice(1)),
      });
      setArticleTitle('');
      setArticleContent('');
      if (editorRef.current) editorRef.current.innerHTML = '<p><br></p>';
      setCreateMode(null);
      if (status === 'PUBLISHED') {
        setPosts(prev => [res.data.data, ...prev]);
        showToast('Article published!');
      } else {
        loadDrafts();
        showToast('Article draft saved!');
      }
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  // ── Publish draft ──────────────────────────────────────────────────────────
  const handlePublishDraft = async (postId: number) => {
    try {
      const res = await postService.publishDraft(postId);
      setDrafts(prev => prev.filter(d => d.id !== postId));
      setPosts(prev => [res.data.data, ...prev]);
      showToast('Draft published to feed!');
    } catch (err) { console.error(err); }
  };

  // ── Delete post ────────────────────────────────────────────────────────────
  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await postService.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setDrafts(prev => prev.filter(p => p.id !== postId));
      showToast('Post deleted');
    } catch (err) { console.error(err); }
  };

  // ── Like ───────────────────────────────────────────────────────────────────
  const handleLike = async (postId: number) => {
    try {
      await postService.toggleLike(postId);
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likedByCurrentUser: !p.likedByCurrentUser, likeCount: p.likedByCurrentUser ? p.likeCount - 1 : p.likeCount + 1 }
        : p));
    } catch (err) { console.error(err); }
  };

  // ── Comments ───────────────────────────────────────────────────────────────
  const handleToggleComments = async (postId: number) => {
    if (openCommentPostId === postId) { setOpenCommentPostId(null); return; }
    setOpenCommentPostId(postId);
    if (!comments[postId]) {
      setCommentLoading(true);
      try {
        const res = await postService.getComments(postId, 0, 50);
        setComments(prev => ({ ...prev, [postId]: res.data.data.content }));
      } catch (err) { console.error(err); }
      finally { setCommentLoading(false); }
    }
  };

  const handleSubmitComment = async (postId: number) => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await postService.addComment(postId, commentText);
      setComments(prev => ({ ...prev, [postId]: [res.data.data, ...(prev[postId] || [])] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
      setCommentText('');
    } catch (err) { console.error(err); }
    finally { setSubmittingComment(false); }
  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    try {
      await postService.deleteComment(commentId);
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount - 1 } : p));
    } catch (err) { console.error(err); }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!sharePostId) return;
    setSharing(true);
    try {
      await postService.sharePost(sharePostId, shareText);
      setSharePostId(null); setShareText('');
      setPage(0); loadPosts(0);
      showToast('Post shared to your feed!');
    } catch (err) { console.error(err); }
    finally { setSharing(false); }
  };

  // ── @Mention handler ───────────────────────────────────────────────────────
  const handlePostContentChange = async (value: string) => {
    setPostContent(value);
    const textarea = postTextareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionCursorPos(cursor);
      setShowMentions(true);
      if (query.length >= 1) {
        try {
          const res = await userService.searchUsers(query);
          setMentionResults(res.data.data.slice(0, 5));
        } catch { setMentionResults([]); }
      } else {
        setMentionResults([]);
      }
    } else {
      setShowMentions(false);
      setMentionResults([]);
    }
  };

  const insertMention = (mentionUser: User) => {
    const textBeforeCursor = postContent.slice(0, mentionCursorPos);
    const textAfterCursor = postContent.slice(mentionCursorPos);
    const replaced = textBeforeCursor.replace(/@\w*$/, `@${mentionUser.firstName} ${mentionUser.lastName} `);
    setPostContent(replaced + textAfterCursor);
    setShowMentions(false);
    setMentionResults([]);
    postTextareaRef.current?.focus();
  };

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:28px;right:28px;background:#191919;color:white;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  const renderContent = (content: string) =>
    content.split('\n').map((line, i) => (
      <p key={i} style={{ margin: '2px 0', minHeight: 4 }}>
        {line.split(/(#\w+|@[\w\s]+)/g).map((part, j) => {
          if (part.startsWith('#')) return <span key={j} style={{ color: '#0a66c2', fontWeight: 500 }}>{part}</span>;
          if (part.startsWith('@')) return <span key={j} style={{ color: '#0a66c2', fontWeight: 600 }}>{part}</span>;
          return part;
        })}
      </p>
    ));

  // Toolbar button config
  const toolbarGroups = [
    {
      group: 'headings',
      buttons: [
        { label: 'H1', title: 'Heading 1', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('formatBlock', 'h1'); } },
        { label: 'H2', title: 'Heading 2', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('formatBlock', 'h2'); } },
        { label: 'H3', title: 'Heading 3', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('formatBlock', 'h3'); } },
      ],
    },
    {
      group: 'inline',
      buttons: [
        { label: 'B', title: 'Bold (Ctrl+B)', key: 'bold', style: { fontWeight: 700 }, onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('bold'); } },
        { label: 'I', title: 'Italic (Ctrl+I)', key: 'italic', style: { fontStyle: 'italic' }, onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('italic'); } },
        { label: 'U', title: 'Underline (Ctrl+U)', key: 'underline', style: { textDecoration: 'underline' }, onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('underline'); } },
        { label: 'S', title: 'Strikethrough', key: 'strikeThrough', style: { textDecoration: 'line-through' }, onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('strikeThrough'); } },
      ],
    },
    {
      group: 'blocks',
      buttons: [
        { label: '• List', title: 'Bullet list', key: 'ul', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('insertUnorderedList'); } },
        { label: '1. List', title: 'Numbered list', key: 'ol', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('insertOrderedList'); } },
        { label: '" Quote', title: 'Blockquote', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('formatBlock', 'blockquote'); } },
        { label: '⎯ Rule', title: 'Horizontal rule', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); insertHorizontalRule(); } },
        { label: '🔗 Link', title: 'Insert link', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); insertLink(); } },
      ],
    },
    {
      group: 'align',
      buttons: [
        { label: '⬅', title: 'Align left', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('justifyLeft'); } },
        { label: '↔', title: 'Align center', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('justifyCenter'); } },
        { label: '➡', title: 'Align right', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('justifyRight'); } },
      ],
    },
    {
      group: 'history',
      buttons: [
        { label: '↩', title: 'Undo', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('undo'); } },
        { label: '↪', title: 'Redo', onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); execFormat('redo'); } },
      ],
    },
  ];

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="container">
      <div className="page-layout">
        {/* Left sidebar */}
        <aside>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ background: 'linear-gradient(135deg,#0a66c2,#004182)', height: 52 }} />
            <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', border: '3px solid white', margin: '-30px auto 8px', overflow: 'hidden', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {user?.profilePhotoUrl
                  ? <img src={user.profilePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{user ? initials(user.firstName, user.lastName) : 'U'}</span>
                }
              </div>
              <Link to="/profile/me" style={{ fontWeight: 600, fontSize: 14 }}>{user?.firstName} {user?.lastName}</Link>
              {user?.headline && <p style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{user.headline}</p>}
            </div>
            <div style={{ borderTop: '1px solid #eee', padding: '10px 16px' }}>
              {[['My Network', '/connections'], ['Jobs', '/jobs'], ['Notifications', '/notifications']].map(([l, p]) => (
                <Link key={p} to={p} style={{ display: 'block', fontSize: 13, color: '#0a66c2', padding: '3px 0' }}>{l}</Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{ minWidth: 0 }}>
          {/* Feed / Drafts tab */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['feed', 'drafts'] as FeedTab[]).map(tab => (
              <button key={tab} onClick={() => { setFeedTab(tab); if (tab === 'drafts') loadDrafts(); }}
                className="btn" style={{ background: feedTab === tab ? '#0a66c2' : 'white', color: feedTab === tab ? 'white' : '#666', border: '1px solid #e0e0e0', borderRadius: 20, textTransform: 'capitalize', fontSize: 13 }}>
                {tab === 'feed' ? '🏠 Feed' : `📝 Drafts${drafts.length > 0 ? ` (${drafts.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* ── DRAFTS TAB ── */}
          {feedTab === 'drafts' && (
            <div>
              {drafts.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: 16 }}>No drafts saved</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Create a post and save it as a draft to continue editing later.</p>
                </div>
              ) : drafts.map(draft => (
                <div key={draft.id} className="card" style={{ marginBottom: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, background: '#fff3cd', color: '#856404', borderRadius: 10, padding: '2px 10px', fontWeight: 500 }}>
                      📝 Draft — {draft.postType}
                    </span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {formatDistanceToNow(new Date(draft.updatedAt || draft.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: 12 }}>
                    {draft.content.slice(0, 200)}{draft.content.length > 200 ? '...' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => {
                      setEditingDraft(draft);
                      setPostContent(draft.content);
                      setPostImageUrl(draft.imageUrl || '');
                      setCreateMode('post');
                      setFeedTab('feed');
                    }}>✏️ Edit</button>
                    <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => handlePublishDraft(draft.id)}>
                      🚀 Publish now
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 13, color: '#b24020' }} onClick={() => handleDeletePost(draft.id)}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FEED TAB ── */}
          {feedTab === 'feed' && (
            <>
              {/* Create post card */}
              {createMode === null && (
                <div className="card" style={{ padding: 16, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                      {user ? initials(user.firstName, user.lastName) : 'U'}
                    </div>
                    <button onClick={() => setCreateMode('post')} style={{ flex: 1, padding: '10px 16px', border: '1px solid #ccc', borderRadius: 24, background: 'transparent', textAlign: 'left', color: '#666', fontSize: 14, cursor: 'pointer' }}>
                      {editingDraft ? 'Editing draft...' : 'Start a post'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCreateMode('post')} className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }}>📝 Post</button>
                    <button onClick={() => setCreateMode('article')} className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }}>📰 Article</button>
                  </div>
                </div>
              )}

              {/* ── Short post creation ── */}
              {createMode === 'post' && (
                <div className="card" style={{ padding: 20, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ fontWeight: 600 }}>{editingDraft ? 'Edit draft' : 'Create a post'}</h3>
                    <button onClick={() => { setCreateMode(null); setEditingDraft(null); setShowMentions(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666' }}>✕</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <textarea
                      ref={postTextareaRef}
                      value={postContent}
                      onChange={e => handlePostContentChange(e.target.value)}
                      placeholder="What do you want to talk about? Use #hashtags or @mention people"
                      style={{ width: '100%', minHeight: 120, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 15, resize: 'vertical', outline: 'none' }}
                      autoFocus
                    />
                    {showMentions && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                        {mentionResults.length === 0 ? (
                          <p style={{ padding: '10px 14px', color: '#999', fontSize: 13 }}>
                            {mentionQuery ? 'No users found' : 'Type a name to mention someone…'}
                          </p>
                        ) : mentionResults.map(u => (
                          <button key={u.id} onMouseDown={() => insertMention(u)}
                            style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f3f2ef')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                              {u.profilePhotoUrl
                                ? <img src={u.profilePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : `${u.firstName[0]}${u.lastName[0]}`}
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 600 }}>{u.firstName} {u.lastName}</p>
                              {u.headline && <p style={{ fontSize: 12, color: '#666' }}>{u.headline}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {postImageUrl && (
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      <img src={postImageUrl} alt="Preview" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8 }} />
                      <button onClick={() => setPostImageUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                    <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                      {uploadingImage ? '⏳ Uploading...' : '📷 Upload photo'}
                    </button>
                    <input className="form-input" value={postImageUrl} onChange={e => setPostImageUrl(e.target.value)}
                      placeholder="Or paste image URL..." style={{ flex: 1, fontSize: 13 }} />
                  </div>

                  {(postContent.match(/#\w+/g) || []).length > 0 && (
                    <p style={{ fontSize: 12, color: '#0a66c2', marginBottom: 8 }}>
                      {(postContent.match(/#\w+/g) || []).join(' ')}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={postStatus} onChange={e => setPostStatus(e.target.value as PostStatus)}
                      style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                      <option value="PUBLISHED">Publish now</option>
                      <option value="DRAFT">Save as draft</option>
                      <option value="SCHEDULED">Schedule for later</option>
                    </select>
                    {postStatus === 'SCHEDULED' && (
                      <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                        className="form-input" style={{ fontSize: 13, width: 'auto' }} min={new Date().toISOString().slice(0, 16)} />
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => { setCreateMode(null); setEditingDraft(null); }}>Cancel</button>
                      <button className="btn btn-primary" onClick={handleCreatePost}
                        disabled={!postContent.trim() || creating || (postStatus === 'SCHEDULED' && !scheduledAt)}>
                        {creating ? 'Saving...' : postStatus === 'PUBLISHED' ? 'Post' : postStatus === 'DRAFT' ? 'Save Draft' : 'Schedule'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Article creation with rich text editor ── */}
              {createMode === 'article' && (
                <div className="card" style={{ padding: 20, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontWeight: 600 }}>Write an article</h3>
                    <button onClick={() => setCreateMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666' }}>✕</button>
                  </div>

                  {/* Article title */}
                  <input
                    className="form-input"
                    value={articleTitle}
                    onChange={e => setArticleTitle(e.target.value)}
                    placeholder="Article title"
                    style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, borderColor: '#e0e0e0' }}
                  />

                  {/* ── Rich text toolbar ── */}
                  <div style={{
                    display: 'flex', gap: 2, padding: '6px 8px',
                    background: '#f8f9fa', border: '1px solid #e0e0e0',
                    borderBottom: 'none', borderRadius: '8px 8px 0 0',
                    flexWrap: 'wrap', alignItems: 'center',
                  }}>
                    {toolbarGroups.map((group, gi) => (
                      <React.Fragment key={group.group}>
                        {gi > 0 && (
                          <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px', flexShrink: 0 }} />
                        )}
                        {group.buttons.map(btn => {
                          const isActive = btn.key ? activeFormats.has(btn.key) : false;
                          return (
                            <button
                              key={btn.label}
                              title={btn.title}
                              onMouseDown={btn.onMouseDown}
                              style={{
                                padding: '4px 8px',
                                border: `1px solid ${isActive ? '#0a66c2' : '#ddd'}`,
                                borderRadius: 4,
                                background: isActive ? '#e8f0fe' : 'white',
                                color: isActive ? '#0a66c2' : '#333',
                                cursor: 'pointer',
                                fontSize: 12,
                                minWidth: 30,
                                ...(btn as any).style,
                              }}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* ── contentEditable editor ── */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    onKeyDown={handleEditorKeyDown}
                    onMouseUp={updateActiveFormats}
                    onKeyUp={updateActiveFormats}
                    style={{
                      minHeight: 320,
                      padding: '14px 16px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '0 0 8px 8px',
                      fontSize: 15,
                      lineHeight: 1.8,
                      outline: 'none',
                      fontFamily: 'inherit',
                      color: '#333',
                      overflowY: 'auto',
                      // Render formatted HTML properly
                    }}
                    data-placeholder="Start writing your article... Use the toolbar above or keyboard shortcuts Ctrl+B, Ctrl+I, Ctrl+U to format text."
                  />

                  {/* Placeholder via CSS injected inline */}
                  <style>{`
                    [contenteditable][data-placeholder]:empty:before {
                      content: attr(data-placeholder);
                      color: #aaa;
                      pointer-events: none;
                    }
                    [contenteditable] h1 { font-size: 22px; font-weight: 700; margin: 12px 0 6px; }
                    [contenteditable] h2 { font-size: 18px; font-weight: 600; margin: 10px 0 4px; }
                    [contenteditable] h3 { font-size: 15px; font-weight: 600; margin: 8px 0 4px; }
                    [contenteditable] blockquote { border-left: 3px solid #0a66c2; padding-left: 12px; color: #555; font-style: italic; margin: 8px 0; }
                    [contenteditable] ul { padding-left: 24px; margin: 6px 0; }
                    [contenteditable] ol { padding-left: 24px; margin: 6px 0; }
                    [contenteditable] li { margin: 2px 0; }
                    [contenteditable] hr { border: none; border-top: 1px solid #e0e0e0; margin: 12px 0; }
                    [contenteditable] a { color: #0a66c2; text-decoration: underline; }
                    [contenteditable] p { margin: 4px 0; }
                  `}</style>

                  {/* Word count */}
                  <p style={{ fontSize: 12, color: '#999', marginTop: 6, textAlign: 'right' }}>
                    {(editorRef.current?.innerText || '').trim().split(/\s+/).filter(Boolean).length} words
                  </p>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={() => setCreateMode(null)}>Cancel</button>
                    <button className="btn btn-outline"
                      onClick={() => handleCreateArticle('DRAFT')}
                      disabled={creating || !(editorRef.current?.innerText || '').trim() || !articleTitle.trim()}>
                      Save Draft
                    </button>
                    <button className="btn btn-primary"
                      onClick={() => handleCreateArticle('PUBLISHED')}
                      disabled={creating || !(editorRef.current?.innerText || '').trim() || !articleTitle.trim()}>
                      {creating ? 'Publishing...' : 'Publish Article'}
                    </button>
                  </div>
                </div>
              )}

              {/* Posts list */}
              {posts.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: 20, marginBottom: 8 }}>📭 Your feed is empty</p>
                  <p style={{ fontSize: 14 }}>Connect with professionals to see their posts here.</p>
                  <Link to="/connections" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
                    Find connections
                  </Link>
                </div>
              ) : posts.map(post => (
                <div key={post.id} className="card" style={{ marginBottom: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Link to={`/profile/${post.userId}`}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0, overflow: 'hidden' }}>
                          {post.userProfilePhotoUrl
                            ? <img src={post.userProfilePhotoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : initials(post.userFirstName, post.userLastName)}
                        </div>
                      </Link>
                      <div>
                        <Link to={`/profile/${post.userId}`} style={{ fontWeight: 600, fontSize: 14 }}>
                          {post.userFirstName} {post.userLastName}
                        </Link>
                        {post.postType === 'ARTICLE' && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: '#e8f0fe', color: '#0a66c2', borderRadius: 10, padding: '1px 8px' }}>Article</span>
                        )}
                        {post.userHeadline && <p style={{ fontSize: 12, color: '#666' }}>{post.userHeadline}</p>}
                        <p style={{ fontSize: 11, color: '#999' }}>
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {post.userId === user?.id && (
                      <button onClick={() => handleDeletePost(post.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b24020', fontSize: 13, alignSelf: 'flex-start', padding: '4px 8px' }}
                        title="Delete post">🗑</button>
                    )}
                  </div>

                  <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>
                    {post.postType === 'ARTICLE'
                      ? <div dangerouslySetInnerHTML={{ __html: post.content }} />
                      : renderContent(post.content)
                    }
                  </div>

                  {post.imageUrl && (
                    <img src={post.imageUrl} alt="Post" style={{ width: '100%', borderRadius: 8, marginBottom: 10, maxHeight: 400, objectFit: 'cover' }} />
                  )}

                  {(post.likeCount > 0 || post.commentCount > 0) && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666', paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                      {post.likeCount > 0 && <span>👍 {post.likeCount}</span>}
                      {post.commentCount > 0 && (
                        <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#0a66c2' }}
                          onClick={() => handleToggleComments(post.id)}>
                          {post.commentCount} comment{post.commentCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 2, paddingTop: 4 }}>
                    <button onClick={() => handleLike(post.id)} className="btn btn-ghost"
                      style={{ flex: 1, fontSize: 13, color: post.likedByCurrentUser ? '#0a66c2' : '#555', fontWeight: post.likedByCurrentUser ? 600 : 400 }}>
                      {post.likedByCurrentUser ? '👍 Liked' : '👍 Like'}
                    </button>
                    <button onClick={() => handleToggleComments(post.id)} className="btn btn-ghost" style={{ flex: 1, fontSize: 13, color: '#555' }}>
                      💬 Comment {post.commentCount > 0 ? `(${post.commentCount})` : ''}
                    </button>
                    <button onClick={() => setSharePostId(post.id)} className="btn btn-ghost" style={{ flex: 1, fontSize: 13, color: '#555' }}>
                      ↗ Share
                    </button>
                  </div>

                  {openCommentPostId === post.id && (
                    <div style={{ borderTop: '1px solid #eee', marginTop: 8, paddingTop: 12 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {user ? initials(user.firstName, user.lastName) : 'U'}
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                          <input className="form-input" value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Add a comment…" style={{ borderRadius: 20, fontSize: 13 }}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmitComment(post.id))} />
                          <button className="btn btn-primary" onClick={() => handleSubmitComment(post.id)}
                            disabled={!commentText.trim() || submittingComment} style={{ borderRadius: 20, fontSize: 13, padding: '8px 16px' }}>
                            Post
                          </button>
                        </div>
                      </div>

                      {commentLoading ? (
                        <div style={{ textAlign: 'center', padding: 16 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                      ) : (comments[post.id] || []).length === 0 ? (
                        <p style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: 8 }}>No comments yet. Be the first!</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {(comments[post.id] || []).map(comment => (
                            <div key={comment.id} style={{ display: 'flex', gap: 8 }}>
                              <Link to={`/profile/${comment.userId}`}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                                  {comment.userProfilePhotoUrl
                                    ? <img src={comment.userProfilePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : initials(comment.userFirstName, comment.userLastName)}
                                </div>
                              </Link>
                              <div style={{ flex: 1, background: '#f3f2ef', borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <Link to={`/profile/${comment.userId}`} style={{ fontWeight: 600, fontSize: 13 }}>
                                      {comment.userFirstName} {comment.userLastName}
                                    </Link>
                                    <p style={{ fontSize: 12, color: '#999' }}>
                                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                    </p>
                                  </div>
                                  {comment.userId === user?.id && (
                                    <button onClick={() => handleDeleteComment(post.id, comment.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b24020', fontSize: 12 }}>🗑</button>
                                  )}
                                </div>
                                <p style={{ fontSize: 14, marginTop: 4, color: '#333' }}>{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {hasMore && posts.length > 0 && (
                <button className="btn btn-outline" style={{ width: '100%', marginTop: 8 }}
                  onClick={() => { const next = page + 1; setPage(next); loadPosts(next); }}>
                  Load more
                </button>
              )}
            </>
          )}
        </main>

        {/* Right sidebar */}
        <aside>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add to your feed</h3>
            <p style={{ fontSize: 13, color: '#666' }}>Follow people to personalise your feed.</p>
            <Link to="/connections" className="btn btn-outline" style={{ marginTop: 12, width: '100%', fontSize: 13 }}>
              Find people
            </Link>
          </div>
        </aside>
      </div>

      {/* ── Share Modal ── */}
      {sharePostId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Share this post</h2>
              <button onClick={() => { setSharePostId(null); setShareText(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666' }}>✕</button>
            </div>
            <textarea value={shareText} onChange={e => setShareText(e.target.value)}
              placeholder="Add a comment to share with your network (optional)..."
              style={{ width: '100%', minHeight: 100, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setSharePostId(null); setShareText(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleShare} disabled={sharing}>{sharing ? 'Sharing...' : '↗ Share to feed'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedPage;
