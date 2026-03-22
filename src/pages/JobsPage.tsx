import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jobService, fileService } from '../services';
import { resolveFileUrl } from '../services/api';
import { Job, JobApplication, JobType, ExperienceLevel } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';

type ActiveTab = 'all' | 'saved' | 'applied' | 'posted' | 'post-job';

const JOB_TYPES: Record<JobType, string> = {
  FULL_TIME: 'Full-time', PART_TIME: 'Part-time',
  REMOTE: 'Remote', CONTRACT: 'Contract', INTERNSHIP: 'Internship',
};
const EXP_LEVELS: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry level', MID: 'Mid level', SENIOR: 'Senior', EXECUTIVE: 'Executive',
};
const APP_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  APPLIED:   { bg: '#e8f0fe', color: '#0a66c2', label: '📩 Applied' },
  REVIEWING: { bg: '#fff3cd', color: '#856404', label: '👀 Under Review' },
  INTERVIEW: { bg: '#d1ecf1', color: '#0c5460', label: '🎙️ Interview' },
  OFFERED:   { bg: '#d4edda', color: '#155724', label: '🎉 Offered!' },
  REJECTED:  { bg: '#f8d7da', color: '#721c24', label: '❌ Not Selected' },
  WITHDRAWN: { bg: '#e2e3e5', color: '#383d41', label: '↩ Withdrawn' },
};

const JobsPage: React.FC = () => {
  const { user } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');

  // Search filters
  const [keyword, setKeyword] = useState('');
  const [jobType, setJobType] = useState<JobType | ''>('');
  const [expLevel, setExpLevel] = useState<ExperienceLevel | ''>('');
  const [location, setLocation] = useState('');

  // My applications
  const [myApplications, setMyApplications] = useState<JobApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // Posted jobs
  const [postedJobs, setPostedJobs] = useState<Job[]>([]);
  const [selectedPostedJob, setSelectedPostedJob] = useState<Job | null>(null);
  const [postedApplicants, setPostedApplicants] = useState<JobApplication[]>([]);
  const [postedLoading, setPostedLoading] = useState(false);

  // Apply modal
  const [applyModal, setApplyModal] = useState(false);
  const [applyStep, setApplyStep] = useState<1 | 2 | 3>(1);
  const [applyForm, setApplyForm] = useState({ resumeUrl: '', coverLetter: '' });
  const [uploadingResume, setUploadingResume] = useState(false);
  const [applying, setApplying] = useState(false);
  const resumeRef = useRef<HTMLInputElement>(null);

  // Post job form
  const [jobForm, setJobForm] = useState({
    title: '', company: '', location: '',
    jobType: '' as JobType | '', experienceLevel: '' as ExperienceLevel | '',
    description: '', requirements: '', benefits: '', applicationDeadline: '',
  });
  const [jobFormErrors, setJobFormErrors] = useState<Record<string, string>>({});
  const [postingJob, setPostingJob] = useState(false);

  // Status update modal
  const [statusModal, setStatusModal] = useState<{ app: JobApplication } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Load jobs ─────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async (pageNum = 0, reset = false) => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'saved') {
        res = await jobService.getSavedJobs(pageNum, 10);
      } else if (keyword || jobType || expLevel || location) {
        res = await jobService.searchJobs({
          keyword, jobType, experienceLevel: expLevel, location, page: pageNum, size: 10,
        });
      } else {
        res = await jobService.getAllJobs(pageNum, 10);
      }
      const { content, last } = res!.data.data;
      setJobs(prev => reset ? content : [...prev, ...content]);
      setHasMore(!last);
      if (reset && content.length > 0) setSelectedJob(prev => prev ?? content[0]);
    } catch { console.error('Failed to load jobs'); }
    finally { setLoading(false); }
  }, [activeTab, keyword, jobType, expLevel, location]);

  const loadMyApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await jobService.getMyApplications(0, 100);
      setMyApplications(res.data.data.content);
    } catch { console.error('Failed to load applications'); }
    finally { setAppsLoading(false); }
  }, []);

  const loadPostedJobs = useCallback(async () => {
    setPostedLoading(true);
    try {
      const res = await jobService.getMyPostedJobs(0, 50);
      const content = res.data.data.content;
      setPostedJobs(content);
      if (content.length > 0) setSelectedPostedJob(content[0]);
    } catch { console.error('Failed to load posted jobs'); }
    finally { setPostedLoading(false); }
  }, []);

  const loadPostedApplicants = useCallback(async (jobId: number) => {
    try {
      const res = await jobService.getJobApplications(jobId, 0, 100);
      setPostedApplicants(res.data.data.content);
    } catch { console.error('Failed to load applicants'); }
  }, []);

  // ── Always load posted jobs count on mount so the tab badge is correct ──
  useEffect(() => {
    loadPostedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load applications alongside jobs so withdrawn state is always in sync ─
  useEffect(() => {
    setPage(0); setJobs([]); setSelectedJob(null);
    if (activeTab === 'applied') {
      loadMyApplications();
    } else if (activeTab === 'posted') {
      loadPostedJobs();
    } else if (activeTab !== 'post-job') {
      // Always load applications together with jobs so the withdrawn
      // status coming from the server is reflected correctly on reload
      loadMyApplications();
      loadJobs(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (selectedPostedJob) loadPostedApplicants(selectedPostedJob.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostedJob]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0); loadJobs(0, true);
  };

  const handleSave = async (jobId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await jobService.saveJob(jobId);
      const saved = !jobs.find(j => j.id === jobId)?.savedByCurrentUser;
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, savedByCurrentUser: saved } : j));
      if (selectedJob?.id === jobId)
        setSelectedJob(prev => prev ? { ...prev, savedByCurrentUser: saved } : prev);
      showToast(res.data.data);
    } catch { console.error('Save failed'); }
  };

  const handleResumeUpload = async (file: File) => {
    setUploadingResume(true);
    try {
      const res = await fileService.upload(file);
      setApplyForm(p => ({ ...p, resumeUrl: res.data.data }));
      showToast('Resume uploaded!');
    } catch { alert('Upload failed. Try a URL instead.'); }
    finally { setUploadingResume(false); }
  };

  const applyWithProfile = () => {
    if (!user || !selectedJob) return;
    setApplyForm(prev => ({
      resumeUrl: prev.resumeUrl,
      coverLetter: prev.coverLetter ||
        `Dear Hiring Manager,\n\nI am writing to express my interest in the ${selectedJob.title} position at ${selectedJob.company}.\n\n${user.summary || ''}\n\nBest regards,\n${user.firstName} ${user.lastName}`,
    }));
    setApplyStep(2);
  };

  const handleApplySubmit = async () => {
    if (!selectedJob) return;
    setApplying(true);
    try {
      const res = await jobService.applyForJob(selectedJob.id, applyForm);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, appliedByCurrentUser: true } : j));
      setSelectedJob(prev => prev ? { ...prev, appliedByCurrentUser: true } : prev);
      setMyApplications(prev => [res.data.data, ...prev]);
      setApplyModal(false);
      setApplyForm({ resumeUrl: '', coverLetter: '' });
      setApplyStep(1);
      showToast('✅ Application submitted! Track it in "My Applications" tab.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Application failed');
    } finally { setApplying(false); }
  };

  const handleWithdraw = async (appId: number) => {
    if (!window.confirm('Are you sure you want to withdraw this application? This action cannot be undone.')) return;
    try {
      await jobService.withdrawApplication(appId);
      setMyApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'WITHDRAWN' as any } : a));
      showToast('✅ Application withdrawn successfully.');
    } catch { console.error('Withdraw failed'); }
  };

  const handleDeleteJob = async (jobId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this job posting? This cannot be undone and all applications will be removed.')) return;
    try {
      await jobService.deleteJob(jobId);
      setPostedJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedPostedJob?.id === jobId) {
        const remaining = postedJobs.filter(j => j.id !== jobId);
        setSelectedPostedJob(remaining.length > 0 ? remaining[0] : null);
        setPostedApplicants([]);
      }
      showToast('✅ Job deleted successfully.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete job');
    }
  };

  const validateJobForm = () => {
    const errs: Record<string, string> = {};
    if (!jobForm.title.trim()) errs.title = 'Job title is required';
    if (!jobForm.company.trim()) errs.company = 'Company is required';
    if (!jobForm.location.trim()) errs.location = 'Location is required';
    if (!jobForm.jobType) errs.jobType = 'Job type is required';
    if (!jobForm.description.trim()) errs.description = 'Description is required';
    return errs;
  };

  const handlePostJob = async () => {
    const errs = validateJobForm();
    if (Object.keys(errs).length > 0) { setJobFormErrors(errs); return; }
    setJobFormErrors({});
    setPostingJob(true);
    try {
      const payload = {
        title: jobForm.title, company: jobForm.company, location: jobForm.location,
        jobType: jobForm.jobType as JobType,
        experienceLevel: (jobForm.experienceLevel as ExperienceLevel) || undefined,
        description: jobForm.description,
        requirements: jobForm.requirements || undefined,
        benefits: jobForm.benefits || undefined,
        applicationDeadline: jobForm.applicationDeadline || undefined,
      };
      const res = await jobService.createJob(payload);
      setPostedJobs(prev => [res.data.data, ...prev]);
      setJobForm({ title: '', company: '', location: '', jobType: '', experienceLevel: '', description: '', requirements: '', benefits: '', applicationDeadline: '' });
      setActiveTab('posted');
      showToast('✅ Job posted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to post job');
    } finally { setPostingJob(false); }
  };

  const handleUpdateStatus = async () => {
    if (!statusModal || !newStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await jobService.updateApplicationStatus(statusModal.app.id, newStatus);
      setPostedApplicants(prev => prev.map(a => a.id === statusModal.app.id ? res.data.data : a));
      setStatusModal(null);
      showToast('Status updated — applicant notified');
    } catch { console.error('Status update failed'); }
    finally { setUpdatingStatus(false); }
  };

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:28px;right:28px;background:#191919;color:white;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  const isProfileComplete = !!(user?.headline && user?.summary);

  // ── FIX: derive applied/withdrawn state from myApplications (server truth)
  // instead of trusting job.appliedByCurrentUser which doesn't reflect withdrawals
  const getAppForJob = (jobId: number) => myApplications.find(a => a.jobId === jobId);

  const isAppliedAndActive = (jobId: number) => {
    const app = getAppForJob(jobId);
    // Has an application that is NOT withdrawn
    return !!app && app.status !== 'WITHDRAWN';
  };

  const isWithdrawn = (jobId: number) => {
    const app = getAppForJob(jobId);
    return app?.status === 'WITHDRAWN';
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          { key: 'all',      label: '💼 All Jobs' },
          { key: 'saved',    label: '🔖 Saved' },
          { key: 'applied',  label: `📋 My Applications${myApplications.length > 0 ? ` (${myApplications.length})` : ''}` },
          { key: 'posted',   label: `🏢 My Postings${postedJobs.length > 0 ? ` (${postedJobs.length})` : ''}` },
          { key: 'post-job', label: '➕ Post a Job' },
        ] as { key: ActiveTab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} className="btn"
            style={{ background: activeTab === key ? '#0a66c2' : 'white', color: activeTab === key ? 'white' : '#666', border: '1px solid #e0e0e0', borderRadius: 20, fontSize: 13 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── POST A JOB ── */}
      {activeTab === 'post-job' && (
        <div className="card" style={{ padding: 28, maxWidth: 700 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Post a Job</h2>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>Fill in the details to attract the right candidates.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { key: 'title', label: 'Job Title *', placeholder: 'e.g. Software Engineer' },
              { key: 'company', label: 'Company *', placeholder: 'Company name' },
              { key: 'location', label: 'Location *', placeholder: 'City or Remote' },
            ].map(({ key, label, placeholder }) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-input"
                  value={(jobForm as any)[key]}
                  onChange={e => setJobForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={jobFormErrors[key] ? { borderColor: '#b24020' } : {}} />
                {jobFormErrors[key] && <span className="form-error">{jobFormErrors[key]}</span>}
              </div>
            ))}

            <div className="form-group">
              <label className="form-label">Job Type *</label>
              <select className="form-input" value={jobForm.jobType}
                onChange={e => setJobForm(p => ({ ...p, jobType: e.target.value as JobType }))}
                style={jobFormErrors.jobType ? { borderColor: '#b24020' } : {}}>
                <option value="">Select type</option>
                {Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {jobFormErrors.jobType && <span className="form-error">{jobFormErrors.jobType}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Experience Level</label>
              <select className="form-input" value={jobForm.experienceLevel}
                onChange={e => setJobForm(p => ({ ...p, experienceLevel: e.target.value as ExperienceLevel }))}>
                <option value="">Select level</option>
                {Object.entries(EXP_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Application Deadline</label>
              <input className="form-input" type="date" value={jobForm.applicationDeadline}
                onChange={e => setJobForm(p => ({ ...p, applicationDeadline: e.target.value }))}
                min={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Job Description *</label>
              <textarea value={jobForm.description}
                onChange={e => setJobForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the role, responsibilities and what you're looking for…"
                style={{ width: '100%', minHeight: 130, padding: 12, border: `1px solid ${jobFormErrors.description ? '#b24020' : '#e0e0e0'}`, borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
              {jobFormErrors.description && <span className="form-error">{jobFormErrors.description}</span>}
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Requirements <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
              <textarea value={jobForm.requirements}
                onChange={e => setJobForm(p => ({ ...p, requirements: e.target.value }))}
                placeholder="Skills and qualifications required…"
                style={{ width: '100%', minHeight: 90, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
            </div>

            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Benefits <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
              <textarea value={jobForm.benefits}
                onChange={e => setJobForm(p => ({ ...p, benefits: e.target.value }))}
                placeholder="Health insurance, remote work, stock options…"
                style={{ width: '100%', minHeight: 70, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-ghost"
              onClick={() => setJobForm({ title: '', company: '', location: '', jobType: '', experienceLevel: '', description: '', requirements: '', benefits: '', applicationDeadline: '' })}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={handlePostJob} disabled={postingJob} style={{ minWidth: 140 }}>
              {postingJob ? '⏳ Posting…' : '🚀 Post Job'}
            </button>
          </div>
        </div>
      )}

      {/* ── MY APPLICATIONS ── */}
      {activeTab === 'applied' && (
        <div>
          {appsLoading
            ? <div className="loading-center"><div className="spinner" /></div>
            : myApplications.length === 0
              ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: 17, marginBottom: 8 }}>No applications yet</p>
                  <button onClick={() => setActiveTab('all')} className="btn btn-primary">Browse jobs</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                    {myApplications.length} application{myApplications.length !== 1 ? 's' : ''}
                  </p>
                  {myApplications.map(app => {
                    const s = APP_STATUS[app.status] || APP_STATUS.APPLIED;
                    return (
                      <div key={app.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 15 }}>{app.jobTitle}</p>
                          <p style={{ fontSize: 13, color: '#444' }}>{app.company}</p>
                          <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            Applied {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ padding: '5px 14px', borderRadius: 16, fontSize: 13, fontWeight: 600, background: s.bg, color: s.color }}>
                            {s.label}
                          </span>
                          {app.status !== 'WITHDRAWN' && app.status !== 'REJECTED' && (
                            <button className="btn btn-ghost" onClick={() => handleWithdraw(app.id)}
                              style={{ fontSize: 12, color: '#b24020' }}>
                              Withdraw
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          }
        </div>
      )}

      {/* ── MY POSTINGS ── */}
      {activeTab === 'posted' && (
        <div>
          {postedLoading
            ? <div className="loading-center"><div className="spinner" /></div>
            : postedJobs.length === 0
              ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: 17, marginBottom: 8 }}>No jobs posted yet</p>
                  <button onClick={() => setActiveTab('post-job')} className="btn btn-primary">Post a job</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {postedJobs.map(job => (
                      <div key={job.id} className="card" onClick={() => setSelectedPostedJob(job)}
                        style={{ padding: 14, cursor: 'pointer', borderLeft: selectedPostedJob?.id === job.id ? '3px solid #0a66c2' : '3px solid transparent', background: selectedPostedJob?.id === job.id ? '#f0f7ff' : 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, color: '#0a66c2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
                            <p style={{ fontSize: 12, color: '#555' }}>{job.company}</p>
                            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <button
                            onClick={e => handleDeleteJob(job.id, e)}
                            title="Delete job"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b24020', fontSize: 16, flexShrink: 0, padding: '2px 4px', marginLeft: 6 }}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedPostedJob && (
                    <div className="card" style={{ padding: 20, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
                      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{selectedPostedJob.title}</h2>
                      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                        {postedApplicants.length} applicant{postedApplicants.length !== 1 ? 's' : ''}
                      </p>

                      {postedApplicants.length === 0
                        ? <p style={{ color: '#999', fontSize: 14 }}>No applications yet.</p>
                        : postedApplicants.map(app => {
                          const s = APP_STATUS[app.status] || APP_STATUS.APPLIED;
                          return (
                            <div key={app.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                  <p style={{ fontWeight: 600, fontSize: 14 }}>{app.userFirstName} {app.userLastName}</p>
                                  <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                                    Applied {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                                  </p>
                                  {app.resumeUrl && (
                                    <a
                                      href={resolveFileUrl(app.resumeUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: 12, color: '#0a66c2', display: 'block', marginTop: 4 }}
                                    >
                                      📄 View Resume
                                    </a>
                                  )}
                                  {app.coverLetter && (
                                    <details style={{ marginTop: 6 }}>
                                      <summary style={{ fontSize: 12, color: '#666', cursor: 'pointer' }}>Cover Letter</summary>
                                      <p style={{ fontSize: 13, color: '#444', marginTop: 6, lineHeight: 1.6, padding: '8px 12px', background: '#f9f9f9', borderRadius: 6 }}>
                                        {app.coverLetter}
                                      </p>
                                    </details>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                                  <span style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                                    {s.label}
                                  </span>
                                  {app.status !== 'WITHDRAWN' && (
                                    <button className="btn btn-outline" style={{ fontSize: 11 }}
                                      onClick={() => { setStatusModal({ app }); setNewStatus(app.status); }}>
                                      Update Status
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              )
          }
        </div>
      )}

      {/* ── ALL JOBS / SAVED ── */}
      {(activeTab === 'all' || activeTab === 'saved') && (
        <>
          {activeTab === 'all' && (
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Search</label>
                <input className="form-input" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Title, company or keyword" />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Location</label>
                <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="City or remote" />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Type</label>
                <select className="form-input" value={jobType} onChange={e => setJobType(e.target.value as any)}>
                  <option value="">All types</option>
                  {Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Experience</label>
                <select className="form-input" value={expLevel} onChange={e => setExpLevel(e.target.value as any)}>
                  <option value="">All levels</option>
                  {Object.entries(EXP_LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
              {loading && jobs.length === 0
                ? <div className="loading-center"><div className="spinner" /></div>
                : jobs.length === 0
                  ? <div className="card" style={{ padding: 24, textAlign: 'center', color: '#666' }}>No jobs found</div>
                  : jobs.map(job => {
                    // ── FIX: use myApplications as source of truth, not job.appliedByCurrentUser
                    const withdrawn = isWithdrawn(job.id);
                    const appliedActive = isAppliedAndActive(job.id);
                    return (
                      <div key={job.id} className="card" onClick={() => setSelectedJob(job)}
                        style={{ padding: 14, cursor: 'pointer', borderLeft: selectedJob?.id === job.id ? '3px solid #0a66c2' : '3px solid transparent', background: selectedJob?.id === job.id ? '#f0f7ff' : 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, color: '#0a66c2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
                            <p style={{ fontSize: 13, color: '#444' }}>{job.company}</p>
                            {job.location && <p style={{ fontSize: 12, color: '#888' }}>📍 {job.location}</p>}
                          </div>
                          <button onClick={e => handleSave(job.id, e)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: job.savedByCurrentUser ? '#0a66c2' : '#bbb', flexShrink: 0, marginLeft: 6 }}>
                            {job.savedByCurrentUser ? '🔖' : '🏷️'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, background: '#f0f7ff', color: '#0a66c2', borderRadius: 10, padding: '2px 8px' }}>{JOB_TYPES[job.jobType]}</span>
                          {withdrawn && <span style={{ fontSize: 11, background: '#e2e3e5', color: '#383d41', borderRadius: 10, padding: '2px 8px' }}>↩ Withdrawn</span>}
                          {!withdrawn && appliedActive && <span style={{ fontSize: 11, background: '#d4edda', color: '#155724', borderRadius: 10, padding: '2px 8px' }}>✓ Applied</span>}
                        </div>
                        <p style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    );
                  })
              }
              {hasMore && !loading && jobs.length > 0 && (
                <button className="btn btn-outline" onClick={() => { const n = page + 1; setPage(n); loadJobs(n); }}>
                  Show more
                </button>
              )}
            </div>

            {/* Detail panel */}
            {selectedJob ? (
              <div className="card" style={{ padding: 28, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selectedJob.title}</h1>
                    <p style={{ fontSize: 15, color: '#444' }}>{selectedJob.company}</p>
                    {selectedJob.location && <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>📍 {selectedJob.location}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, background: '#f0f7ff', color: '#0a66c2', borderRadius: 14, padding: '4px 12px' }}>{JOB_TYPES[selectedJob.jobType]}</span>
                      <span style={{ fontSize: 12, background: '#f3f2ef', color: '#555', borderRadius: 14, padding: '4px 12px' }}>{EXP_LEVELS[selectedJob.experienceLevel]}</span>
                    </div>
                    {selectedJob.applicationDeadline && (
                      <p style={{ fontSize: 12, color: '#b24020', marginTop: 8 }}>
                        ⏰ Apply by {format(new Date(selectedJob.applicationDeadline), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => handleSave(selectedJob.id)}
                      style={{ color: selectedJob.savedByCurrentUser ? '#0a66c2' : undefined }}>
                      {selectedJob.savedByCurrentUser ? '🔖 Saved' : '🏷️ Save'}
                    </button>
                    {/* ── FIX: use myApplications as source of truth for the action button too */}
                    {(() => {
                      if (isWithdrawn(selectedJob.id))
                        return <button className="btn" style={{ background: '#e2e3e5', color: '#383d41', cursor: 'default' }} disabled>↩ Withdrawn</button>;
                      if (isAppliedAndActive(selectedJob.id))
                        return <button className="btn" style={{ background: '#d4edda', color: '#155724', cursor: 'default' }} disabled>✓ Applied</button>;
                      return <button className="btn btn-primary" onClick={() => { setApplyStep(1); setApplyModal(true); }}>Easy Apply</button>;
                    })()}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>About the job</h2>
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap' }}>{selectedJob.description}</p>
                  {selectedJob.requirements && (
                    <>
                      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 12px' }}>Requirements</h2>
                      <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap' }}>{selectedJob.requirements}</p>
                    </>
                  )}
                  {selectedJob.benefits && (
                    <>
                      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 12px' }}>Benefits</h2>
                      <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap' }}>{selectedJob.benefits}</p>
                    </>
                  )}
                  <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>
                    Posted by {selectedJob.postedByName} · {formatDistanceToNow(new Date(selectedJob.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 60, textAlign: 'center', color: '#999' }}>
                <p style={{ fontSize: 22 }}>💼</p>
                <p style={{ marginTop: 8 }}>Select a job to view details</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Apply Modal ── */}
      {applyModal && selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Apply to {selectedJob.company}</h2>
                <p style={{ fontSize: 13, color: '#666' }}>{selectedJob.title}</p>
              </div>
              <button onClick={() => { setApplyModal(false); setApplyStep(1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22 }}>✕</button>
            </div>

            {/* Step indicators */}
            <div style={{ display: 'flex', marginBottom: 24 }}>
              {['Contact info', 'Resume & Letter', 'Review'].map((label, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: applyStep > i + 1 ? '#057642' : applyStep === i + 1 ? '#0a66c2' : '#e0e0e0', color: applyStep >= i + 1 ? 'white' : '#999' }}>
                    {applyStep > i + 1 ? '✓' : i + 1}
                  </div>
                  <p style={{ fontSize: 11, color: applyStep === i + 1 ? '#0a66c2' : '#999' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Step 1 */}
            {applyStep === 1 && (
              <div>
                <div style={{ background: '#f3f2ef', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>From your LinkedIn profile:</p>
                  <p style={{ fontSize: 13, color: '#555' }}>✓ {user?.firstName} {user?.lastName} · {user?.email}</p>
                  {user?.headline && <p style={{ fontSize: 13, color: '#555' }}>✓ {user.headline}</p>}
                </div>
                {isProfileComplete ? (
                  <div style={{ background: '#e8f5e9', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: '#057642', fontWeight: 600, marginBottom: 6 }}>✓ Profile complete — quick apply available!</p>
                    <button className="btn btn-primary" onClick={applyWithProfile} style={{ fontSize: 13 }}>⚡ Apply with LinkedIn profile</button>
                  </div>
                ) : (
                  <div style={{ background: '#fff3cd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: '#856404' }}>💡 Complete your headline & summary to enable one-click apply.</p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => setApplyStep(2)}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {applyStep === 2 && (
              <div>
                <div className="form-group">
                  <label className="form-label">Resume</label>
                  <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && handleResumeUpload(e.target.files[0])} />
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button className="btn btn-outline" style={{ fontSize: 13 }}
                      onClick={() => resumeRef.current?.click()} disabled={uploadingResume}>
                      {uploadingResume ? '⏳ Uploading…' : '📁 Upload from PC'}
                    </button>
                    <span style={{ fontSize: 13, color: '#999', alignSelf: 'center' }}>or paste URL</span>
                  </div>
                  <input className="form-input" value={applyForm.resumeUrl}
                    onChange={e => setApplyForm(p => ({ ...p, resumeUrl: e.target.value }))}
                    placeholder="https://your-resume.pdf" />
                  {applyForm.resumeUrl && <p style={{ fontSize: 12, color: '#057642', marginTop: 4 }}>✓ Resume attached</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Cover Letter <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
                  <textarea value={applyForm.coverLetter}
                    onChange={e => setApplyForm(p => ({ ...p, coverLetter: e.target.value }))}
                    placeholder="Dear Hiring Manager, I am excited to apply for…"
                    style={{ width: '100%', minHeight: 140, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={() => setApplyStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={() => setApplyStep(3)}>Review →</button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {applyStep === 3 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Review your application</h3>
                <div style={{ background: '#f3f2ef', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedJob.title}</p>
                  <p style={{ fontSize: 13, color: '#555' }}>{selectedJob.company} · {selectedJob.location}</p>
                </div>
                {applyForm.resumeUrl && (
                  <p style={{ fontSize: 13, marginBottom: 8 }}>📄 Resume: <span style={{ color: '#0a66c2' }}>{applyForm.resumeUrl.length > 60 ? applyForm.resumeUrl.slice(0, 60) + '…' : applyForm.resumeUrl}</span></p>
                )}
                {applyForm.coverLetter && (
                  <div style={{ background: '#f9f9f9', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Cover Letter preview:</p>
                    <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                      {applyForm.coverLetter.slice(0, 200)}{applyForm.coverLetter.length > 200 ? '…' : ''}
                    </p>
                  </div>
                )}
                <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
                  By submitting, your information will be shared with {selectedJob.company}.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={() => setApplyStep(2)}>← Back</button>
                  <button className="btn btn-primary" onClick={handleApplySubmit} disabled={applying}>
                    {applying ? 'Submitting…' : '✓ Submit Application'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status Update Modal ── */}
      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Update Application Status</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              Applicant: <strong>{statusModal.app.userFirstName} {statusModal.app.userLastName}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">New Status</label>
              <select className="form-input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="">Select status</option>
                {Object.entries(APP_STATUS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            {newStatus && APP_STATUS[newStatus] && (
              <div style={{ background: APP_STATUS[newStatus].bg, borderRadius: 8, padding: 10, marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: APP_STATUS[newStatus].color }}>
                  The applicant will be notified about this status change.
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setStatusModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateStatus} disabled={updatingStatus || !newStatus}>
                {updatingStatus ? 'Updating…' : 'Update & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsPage;
