import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService, connectionService, postService, fileService } from '../services';
import { resolveFileUrl } from '../services/api';
import { User, Post, Comment } from '../types';
import { formatDistanceToNow } from 'date-fns';

type ConnStatus = 'NONE' | 'CONNECTED' | 'SENT' | 'RECEIVED' | 'LOADING';

const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, updateUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'about' | 'posts'>('about');

  // Connection
  const [connStatus, setConnStatus] = useState<ConnStatus>('LOADING');
  const [connId, setConnId] = useState<number | null>(null);
  const [connLoading, setConnLoading] = useState(false);

  // Edit modals
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ headline: '', location: '', summary: '', profilePhotoUrl: '' });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Education/Experience/Skill forms
  const [showEduForm, setShowEduForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editingEduId, setEditingEduId] = useState<number | null>(null);
  const [editingExpId, setEditingExpId] = useState<number | null>(null);
  const [eduForm, setEduForm] = useState({ school: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', description: '' });
  const [expForm, setExpForm] = useState({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' });
  const [skillName, setSkillName] = useState('');

  const isOwnProfile = id === 'me' || id === String(currentUser?.id);
  const initials = (u: User) => `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();

  // Post detail modal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [modalComments, setModalComments] = useState<Comment[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Load profile
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = isOwnProfile ? await userService.getCurrentUser() : await userService.getUserById(Number(id));
        setProfile(res.data.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [id, isOwnProfile]);

  // Load connection status for other user's profile
  useEffect(() => {
    if (!profile || isOwnProfile) { setConnStatus('NONE'); return; }
    const check = async () => {
      setConnStatus('LOADING');
      try {
        const res = await connectionService.getConnectionStatus(profile.id);
        const { status, connectionId } = res.data.data;
        setConnStatus(status as ConnStatus);
        setConnId(connectionId);
      } catch { setConnStatus('NONE'); }
    };
    check();
  }, [profile, isOwnProfile]);

  // Load posts when posts tab active
  useEffect(() => {
    if (!profile || activeSection !== 'posts') return;
    const loadPosts = async () => {
      setPostsLoading(true);
      try {
        const res = await postService.getUserPosts(profile.id, 0, 20);
        setPosts(res.data.data.content);
      } catch { console.error('Could not load posts'); }
      finally { setPostsLoading(false); }
    };
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeSection]);

  // --- Profile photo upload from PC ---
  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const res = await fileService.upload(file);
      setEditForm(prev => ({ ...prev, profilePhotoUrl: res.data.data }));
      showToast('Photo uploaded!');
    } catch { alert('Photo upload failed. Please try again.'); }
    finally { setUploadingPhoto(false); }
  };

  // --- Save profile ---
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await userService.updateProfile(editForm);
      setProfile(res.data.data);
      if (isOwnProfile) updateUser(res.data.data);
      setEditingProfile(false);
      showToast('Profile updated!');
    } catch { console.error('Save failed'); }
    finally { setSaving(false); }
  };

  // --- Connection actions ---
  const handleConnect = async () => {
    if (!profile) return;
    setConnLoading(true);
    try {
      await connectionService.sendRequest(profile.id);
      setConnStatus('SENT');
      showToast('Connection request sent!');
    } catch (err: any) { alert(err.response?.data?.message || 'Failed to send request'); }
    finally { setConnLoading(false); }
  };

  const handleRemoveConnection = async () => {
    if (!connId) return;
    if (!window.confirm('Remove this connection?')) return;
    setConnLoading(true);
    try {
      await connectionService.removeConnection(connId);
      setConnStatus('NONE'); setConnId(null);
      showToast('Connection removed');
    } catch { console.error('Failed to remove'); }
    finally { setConnLoading(false); }
  };

  // --- Education CRUD ---
  const handleAddEducation = async () => {
    if (!eduForm.school.trim()) return;
    setSaving(true);
    try {
      const payload = {
        school: eduForm.school, degree: eduForm.degree, fieldOfStudy: eduForm.fieldOfStudy,
        startYear: eduForm.startYear ? parseInt(eduForm.startYear) : undefined,
        endYear: eduForm.endYear ? parseInt(eduForm.endYear) : undefined,
        description: eduForm.description,
      };
      if (editingEduId) {
        const updated = await userService.updateEducation(editingEduId, payload);
        setProfile(prev => prev ? { ...prev, educations: prev.educations?.map(e => e.id === editingEduId ? updated.data.data : e) } : prev);
      } else {
        const created = await userService.addEducation(payload);
        setProfile(prev => prev ? { ...prev, educations: [...(prev.educations || []), created.data.data] } : prev);
      }
      setEduForm({ school: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', description: '' });
      setShowEduForm(false); setEditingEduId(null);
    } catch { console.error('Education save failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteEducation = async (eduId: number) => {
    if (!window.confirm('Remove this education?')) return;
    try {
      await userService.deleteEducation(eduId);
      setProfile(prev => prev ? { ...prev, educations: prev.educations?.filter(e => e.id !== eduId) } : prev);
    } catch { console.error('Delete failed'); }
  };

  const startEditEducation = (edu: any) => {
    setEduForm({ school: edu.school || '', degree: edu.degree || '', fieldOfStudy: edu.fieldOfStudy || '', startYear: edu.startYear?.toString() || '', endYear: edu.endYear?.toString() || '', description: edu.description || '' });
    setEditingEduId(edu.id); setShowEduForm(true);
  };

  // --- Experience CRUD ---
  const handleAddExperience = async () => {
    if (!expForm.title.trim() || !expForm.company.trim()) return;
    setSaving(true);
    try {
      const payload = { title: expForm.title, company: expForm.company, location: expForm.location, startDate: expForm.startDate || undefined, endDate: expForm.isCurrent ? undefined : (expForm.endDate || undefined), isCurrent: expForm.isCurrent, description: expForm.description };
      if (editingExpId) {
        const updated = await userService.updateExperience(editingExpId, payload);
        setProfile(prev => prev ? { ...prev, experiences: prev.experiences?.map(e => e.id === editingExpId ? updated.data.data : e) } : prev);
      } else {
        const created = await userService.addExperience(payload);
        setProfile(prev => prev ? { ...prev, experiences: [...(prev.experiences || []), created.data.data] } : prev);
      }
      setExpForm({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' });
      setShowExpForm(false); setEditingExpId(null);
    } catch { console.error('Experience save failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteExperience = async (expId: number) => {
    if (!window.confirm('Remove this experience?')) return;
    try {
      await userService.deleteExperience(expId);
      setProfile(prev => prev ? { ...prev, experiences: prev.experiences?.filter(e => e.id !== expId) } : prev);
    } catch { console.error('Delete failed'); }
  };

  const startEditExperience = (exp: any) => {
    setExpForm({ title: exp.title || '', company: exp.company || '', location: exp.location || '', startDate: exp.startDate || '', endDate: exp.endDate || '', isCurrent: exp.isCurrent || false, description: exp.description || '' });
    setEditingExpId(exp.id); setShowExpForm(true);
  };

  // --- Skill CRUD ---
  const handleAddSkill = async () => {
    if (!skillName.trim()) return;
    setSaving(true);
    try {
      const res = await userService.addSkill(skillName.trim());
      setProfile(prev => prev ? { ...prev, skills: [...(prev.skills || []), res.data.data] } : prev);
      setSkillName(''); setShowSkillForm(false);
    } catch { console.error('Skill add failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteSkill = async (skillId: number) => {
    try {
      await userService.deleteSkill(skillId);
      setProfile(prev => prev ? { ...prev, skills: prev.skills?.filter(s => s.id !== skillId) } : prev);
    } catch { console.error('Delete failed'); }
  };

  const openPostDetail = async (post: Post) => {
    setSelectedPost(post);
    setModalComments([]);
    setModalLoading(true);
    try {
      const res = await postService.getComments(post.id, 0, 100);
      setModalComments(res.data.data.content);
    } catch { console.error('Failed to load comments'); }
    finally { setModalLoading(false); }
  };

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:28px;right:28px;background:#191919;color:white;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  };

  const sectionHeader = (title: string, onAdd?: () => void, onAddLabel = '+') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
      {isOwnProfile && onAdd && (
        <button onClick={onAdd} className="btn btn-ghost" style={{ fontSize: 20, padding: '2px 10px', color: '#0a66c2' }}>{onAddLabel}</button>
      )}
    </div>
  );

  const inlineFormBox = (children: React.ReactNode, onSave: () => void, onCancel: () => void, saveLabel = 'Save') => (
    <div style={{ margin: '0 24px 16px', background: '#f8f9fa', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      {children}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
      </div>
    </div>
  );

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!profile) return <div style={{ padding: 48, textAlign: 'center', color: '#666' }}>User not found</div>;

  // Connection button rendering
  const renderConnectButton = () => {
    if (isOwnProfile) return null;
    if (connStatus === 'LOADING') return <button className="btn btn-outline" disabled>Loading…</button>;
    if (connStatus === 'CONNECTED') return (
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ padding: '8px 16px', background: '#e8f5e9', color: '#057642', borderRadius: 20, fontSize: 14, fontWeight: 600 }}>✓ Connected</span>
        <button className="btn btn-ghost" onClick={handleRemoveConnection} disabled={connLoading} style={{ fontSize: 13, color: '#b24020', border: '1px solid #f5c2bb' }}>
          {connLoading ? '…' : 'Remove'}
        </button>
      </div>
    );
    if (connStatus === 'SENT') return (
      <button className="btn" style={{ background: '#f3f2ef', color: '#666', cursor: 'default', borderRadius: 20 }} disabled>
        Pending…
      </button>
    );
    if (connStatus === 'RECEIVED') return (
      <button className="btn btn-primary" onClick={() => connId && connectionService.acceptConnection(connId).then(() => { setConnStatus('CONNECTED'); showToast('Connection accepted!'); })} disabled={connLoading}>
        Accept request
      </button>
    );
    return (
      <button className="btn btn-primary" onClick={handleConnect} disabled={connLoading}>
        {connLoading ? 'Sending…' : '+ Connect'}
      </button>
    );
  };

  return (
    <div className="container" style={{ maxWidth: 860, paddingTop: 20, paddingBottom: 48 }}>

      {/* ── Profile header ── */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ background: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)', height: 100 }} />
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', marginTop: -64 }}>
              <div style={{ width: 128, height: 128, borderRadius: '50%', border: '4px solid white', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 40, overflow: 'hidden' }}>
                {profile.profilePhotoUrl
                  ? <img src={resolveFileUrl(profile.profilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials(profile)
                }
              </div>
            </div>

            {/* Name + headline */}
            <div style={{ flex: 1, minWidth: 200, paddingTop: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800 }}>{profile.firstName} {profile.lastName}</h1>
              {profile.headline && <p style={{ fontSize: 14, color: '#555', marginTop: 3 }}>{profile.headline}</p>}
              {profile.location && <p style={{ fontSize: 13, color: '#888', marginTop: 3 }}>📍 {profile.location}</p>}
            </div>

            {/* Action buttons */}
            <div style={{ paddingTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isOwnProfile ? (
                <>
                  <button className="btn btn-outline" onClick={() => {
                    setEditForm({ headline: profile.headline || '', location: profile.location || '', summary: profile.summary || '', profilePhotoUrl: profile.profilePhotoUrl || '' });
                    setEditingProfile(true);
                  }}>✏️ Edit profile</button>
                  <Link to="/profile/setup" className="btn btn-ghost" style={{ fontSize: 13 }}>+ Add section</Link>
                </>
              ) : renderConnectButton()}
            </div>
          </div>

          {profile.summary && <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginTop: 12, maxWidth: 700 }}>{profile.summary}</p>}
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {editingProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16, overflowY: 'auto' }}>
          <div className="card" style={{ width: '100%', maxWidth: 580, padding: 28, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Edit profile</h2>
              <button onClick={() => setEditingProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22 }}>✕</button>
            </div>

            {/* Profile photo upload */}
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Profile Photo</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 22, overflow: 'hidden', flexShrink: 0 }}>
                  {editForm.profilePhotoUrl
                    ? <img src={resolveFileUrl(editForm.profilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(profile)
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                  <button className="btn btn-outline" style={{ fontSize: 13, marginBottom: 8 }} onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                    {uploadingPhoto ? '⏳ Uploading…' : '📷 Upload from PC'}
                  </button>
                  <input className="form-input" value={editForm.profilePhotoUrl} onChange={e => setEditForm(p => ({ ...p, profilePhotoUrl: e.target.value }))} placeholder="Or paste photo URL…" style={{ fontSize: 13 }} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Headline <span style={{ color: '#999', fontWeight: 400, fontSize: 12 }}>(max 220)</span></label>
              <input className="form-input" value={editForm.headline} onChange={e => setEditForm(p => ({ ...p, headline: e.target.value }))} placeholder="e.g. Software Engineer at Company" maxLength={220} />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} placeholder="City, Country" />
            </div>
            <div className="form-group">
              <label className="form-label">Summary</label>
              <textarea value={editForm.summary} onChange={e => setEditForm(p => ({ ...p, summary: e.target.value }))}
                placeholder="Describe your professional background…"
                style={{ width: '100%', minHeight: 100, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setEditingProfile(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['about', 'posts'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveSection(tab)} className="btn"
            style={{ background: activeSection === tab ? '#0a66c2' : 'white', color: activeSection === tab ? 'white' : '#666', border: '1px solid #e0e0e0', borderRadius: 20 }}>
            {tab === 'about' ? '👤 About' : '📝 Posts & Activity'}
          </button>
        ))}
      </div>

      {/* ── Posts tab ── */}
      {activeSection === 'posts' && (
        <div>
          {postsLoading ? <div className="loading-center"><div className="spinner" /></div>
          : posts.length === 0
            ? <div className="card" style={{ padding: 32, textAlign: 'center', color: '#666' }}>No posts yet.</div>
            : posts.map(post => (
              <div key={post.id} className="card" style={{ padding: 16, marginBottom: 8, cursor: 'pointer' }}
                onClick={() => openPostDetail(post)}>
                {/* Post header */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                    {profile.profilePhotoUrl
                      ? <img src={resolveFileUrl(profile.profilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials(profile)
                    }
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{profile.firstName} {profile.lastName}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, background: '#f0f7ff', color: '#0a66c2', borderRadius: 10, padding: '1px 8px' }}>{post.postType}</span>
                      <span style={{ fontSize: 11, color: '#999' }}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>

                {/* Post content — render HTML for articles, plain text for posts */}
                <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: post.imageUrl ? 10 : 0 }}>
                  {post.postType === 'ARTICLE'
                    ? <div dangerouslySetInnerHTML={{ __html: post.content }} />
                    : <p style={{ whiteSpace: 'pre-wrap' }}>
                        {post.content.slice(0, 300)}{post.content.length > 300 ? '…' : ''}
                      </p>
                  }
                </div>

                {/* ── FIX: render post image if present ── */}
                {post.imageUrl && (
                  <img
                    src={resolveFileUrl(post.imageUrl)}
                    alt="Post"
                    style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8, marginTop: 10 }}
                  />
                )}

                {/* Engagement counts */}
                <p style={{ fontSize: 12, color: '#999', marginTop: 10 }}>👍 {post.likeCount} · 💬 {post.commentCount}</p>
              </div>
            ))
          }
        </div>
      )}

      {/* ── About tab ── */}
      {activeSection === 'about' && (
        <>
          {/* Experience */}
          <div className="card" style={{ marginBottom: 8 }}>
            {sectionHeader('Experience', () => { setShowExpForm(true); setEditingExpId(null); setExpForm({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' }); })}
            {showExpForm && isOwnProfile && inlineFormBox(
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={expForm.title} onChange={e => setExpForm(p => ({ ...p, title: e.target.value }))} placeholder="Job title" /></div>
                <div className="form-group"><label className="form-label">Company *</label><input className="form-input" value={expForm.company} onChange={e => setExpForm(p => ({ ...p, company: e.target.value }))} placeholder="Company" /></div>
                <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={expForm.location} onChange={e => setExpForm(p => ({ ...p, location: e.target.value }))} placeholder="City" /></div>
                <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={expForm.startDate} onChange={e => setExpForm(p => ({ ...p, startDate: e.target.value }))} /></div>
                {!expForm.isCurrent && <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={expForm.endDate} onChange={e => setExpForm(p => ({ ...p, endDate: e.target.value }))} /></div>}
                <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}><input type="checkbox" checked={expForm.isCurrent} onChange={e => setExpForm(p => ({ ...p, isCurrent: e.target.checked }))} />I currently work here</label></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><textarea value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none' }} /></div>
              </div>,
              handleAddExperience, () => { setShowExpForm(false); setEditingExpId(null); },
              editingExpId ? 'Update' : 'Save'
            )}
            <div style={{ padding: '8px 24px 16px' }}>
              {(!profile.experiences || profile.experiences.length === 0)
                ? <p style={{ color: '#999', fontSize: 14 }}>No experience added yet.</p>
                : profile.experiences.map(exp => (
                  <div key={exp.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: 44, height: 44, background: '#e8f0fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💼</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{exp.title}</p>
                      <p style={{ fontSize: 13, color: '#555' }}>{exp.company}{exp.location && ` · ${exp.location}`}</p>
                      <p style={{ fontSize: 12, color: '#888' }}>{exp.startDate} – {exp.isCurrent ? 'Present' : (exp.endDate || '')}</p>
                      {exp.description && <p style={{ fontSize: 13, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{exp.description}</p>}
                    </div>
                    {isOwnProfile && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost" onClick={() => startEditExperience(exp)} style={{ fontSize: 12, padding: '4px 8px' }}>✏️</button>
                        <button className="btn btn-ghost" onClick={() => handleDeleteExperience(exp.id)} style={{ color: '#b24020', fontSize: 12, padding: '4px 8px' }}>🗑</button>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </div>

          {/* Education */}
          <div className="card" style={{ marginBottom: 8 }}>
            {sectionHeader('Education', () => { setShowEduForm(true); setEditingEduId(null); setEduForm({ school: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', description: '' }); })}
            {showEduForm && isOwnProfile && inlineFormBox(
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">School *</label><input className="form-input" value={eduForm.school} onChange={e => setEduForm(p => ({ ...p, school: e.target.value }))} placeholder="University name" /></div>
                <div className="form-group"><label className="form-label">Degree</label><input className="form-input" value={eduForm.degree} onChange={e => setEduForm(p => ({ ...p, degree: e.target.value }))} placeholder="Bachelor's" /></div>
                <div className="form-group"><label className="form-label">Field of Study</label><input className="form-input" value={eduForm.fieldOfStudy} onChange={e => setEduForm(p => ({ ...p, fieldOfStudy: e.target.value }))} placeholder="Computer Science" /></div>
                <div className="form-group"><label className="form-label">Start Year</label><input className="form-input" type="number" value={eduForm.startYear} onChange={e => setEduForm(p => ({ ...p, startYear: e.target.value }))} placeholder="2018" min="1950" max="2099" /></div>
                <div className="form-group"><label className="form-label">End Year</label><input className="form-input" type="number" value={eduForm.endYear} onChange={e => setEduForm(p => ({ ...p, endYear: e.target.value }))} placeholder="2022" min="1950" max="2099" /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Description</label><textarea value={eduForm.description} onChange={e => setEduForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, resize: 'vertical', outline: 'none' }} /></div>
              </div>,
              handleAddEducation, () => { setShowEduForm(false); setEditingEduId(null); },
              editingEduId ? 'Update' : 'Save'
            )}
            <div style={{ padding: '8px 24px 16px' }}>
              {(!profile.educations || profile.educations.length === 0)
                ? <p style={{ color: '#999', fontSize: 14 }}>No education added yet.</p>
                : profile.educations.map(edu => (
                  <div key={edu.id} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, background: '#e8f5e9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎓</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{edu.school}</p>
                      <p style={{ fontSize: 13, color: '#555' }}>{edu.degree}{edu.fieldOfStudy && `, ${edu.fieldOfStudy}`}</p>
                      {(edu.startYear || edu.endYear) && <p style={{ fontSize: 12, color: '#888' }}>{edu.startYear} – {edu.endYear}</p>}
                      {edu.description && <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{edu.description}</p>}
                    </div>
                    {isOwnProfile && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost" onClick={() => startEditEducation(edu)} style={{ fontSize: 12, padding: '4px 8px' }}>✏️</button>
                        <button className="btn btn-ghost" onClick={() => handleDeleteEducation(edu.id)} style={{ color: '#b24020', fontSize: 12, padding: '4px 8px' }}>🗑</button>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </div>

          {/* Skills */}
          <div className="card" style={{ marginBottom: 8 }}>
            {sectionHeader('Skills', () => setShowSkillForm(true))}
            {showSkillForm && isOwnProfile && (
              <div style={{ margin: '0 24px 12px', display: 'flex', gap: 8 }}>
                <input className="form-input" value={skillName} onChange={e => setSkillName(e.target.value)}
                  placeholder="e.g. React, Java, SQL" style={{ flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && handleAddSkill()} />
                <button className="btn btn-ghost" onClick={() => setShowSkillForm(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddSkill} disabled={saving || !skillName.trim()}>Add</button>
              </div>
            )}
            <div style={{ padding: '8px 24px 20px' }}>
              {(!profile.skills || profile.skills.length === 0)
                ? <p style={{ color: '#999', fontSize: 14 }}>No skills added yet.</p>
                : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {profile.skills.map(skill => (
                      <span key={skill.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f0fe', color: '#0a66c2', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500 }}>
                        {skill.skillName}
                        {isOwnProfile && (
                          <button onClick={() => handleDeleteSkill(skill.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5588bb', fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                        )}
                      </span>
                    ))}
                  </div>
              }
            </div>
          </div>
        </>
      )}
      {/* ── Post Detail Modal ── */}
      {selectedPost && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                  {profile.profilePhotoUrl
                    ? <img src={resolveFileUrl(profile.profilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(profile)
                  }
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{profile.firstName} {profile.lastName}</p>
                  <p style={{ fontSize: 11, color: '#999' }}>{formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPost(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#666' }}>✕</button>
            </div>

            {/* Post content */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', flexShrink: 0, maxHeight: 220, overflowY: 'auto' }}>
              {selectedPost.postType === 'ARTICLE'
                ? <div dangerouslySetInnerHTML={{ __html: selectedPost.content }} style={{ fontSize: 14, lineHeight: 1.7 }} />
                : <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedPost.content}</p>
              }
              {selectedPost.imageUrl && (
                <img src={resolveFileUrl(selectedPost.imageUrl)} alt="Post" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8, marginTop: 10 }} />
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 20, padding: '10px 20px', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: '#666' }}>👍 {selectedPost.likeCount} like{selectedPost.likeCount !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 13, color: '#666' }}>💬 {selectedPost.commentCount} comment{selectedPost.commentCount !== 1 ? 's' : ''}</span>
            </div>

            {/* Comments header */}
            <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>💬 Comments</p>
            </div>

            {/* Comments list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : modalComments.length === 0 ? (
                <p style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: 24 }}>No comments yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {modalComments.map(comment => (
                    <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
                      <Link to={`/profile/${comment.userId}`} onClick={() => setSelectedPost(null)}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                          {comment.userProfilePhotoUrl
                            ? <img src={resolveFileUrl(comment.userProfilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : `${comment.userFirstName?.[0] ?? ''}${comment.userLastName?.[0] ?? ''}`.toUpperCase()
                          }
                        </div>
                      </Link>
                      <div style={{ flex: 1, background: '#f3f2ef', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Link to={`/profile/${comment.userId}`} onClick={() => setSelectedPost(null)}
                            style={{ fontWeight: 600, fontSize: 13, color: '#191919' }}>
                            {comment.userFirstName} {comment.userLastName}
                          </Link>
                          <span style={{ fontSize: 11, color: '#999' }}>
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
