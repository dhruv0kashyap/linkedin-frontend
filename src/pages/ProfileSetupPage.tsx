import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService, fileService } from '../services';
import { resolveFileUrl } from '../services/api';

const STEPS = ['Photo & Headline', 'Location & Summary', 'Education', 'Experience', 'Skills'];

const ProfileSetupPage: React.FC = () => {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const res = await fileService.upload(file);
      setProfilePhotoUrl(res.data.data);
    } catch {
      alert('Photo upload failed. Please try a URL instead.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Step 1: Photo & Headline
  const [headline, setHeadline] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  // Step 2: Location & Summary
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');

  // Step 3: Education
  const [eduList, setEduList] = useState<Array<{ school: string; degree: string; fieldOfStudy: string; startYear: string; endYear: string }>>([]);
  const [eduForm, setEduForm] = useState({ school: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' });

  // Step 4: Experience
  const [expList, setExpList] = useState<Array<{ title: string; company: string; location: string; startDate: string; endDate: string; isCurrent: boolean; description: string }>>([]);
  const [expForm, setExpForm] = useState({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' });

  // Step 5: Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSkip = () => handleNext();

  const handleAddEducation = () => {
    if (!eduForm.school.trim()) return;
    setEduList(prev => [...prev, { ...eduForm }]);
    setEduForm({ school: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' });
  };

  const handleAddExperience = () => {
    if (!expForm.title.trim() || !expForm.company.trim()) return;
    setExpList(prev => [...prev, { ...expForm }]);
    setExpForm({ title: '', company: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' });
  };

  const handleAddSkill = () => {
    if (!skillInput.trim()) return;
    setSkills(prev => [...prev, skillInput.trim()]);
    setSkillInput('');
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Update basic profile
      const profileRes = await userService.updateProfile({ headline, location, summary, profilePhotoUrl });
      updateUser(profileRes.data.data);

      // Add education
      for (const edu of eduList) {
        await userService.addEducation({
          school: edu.school, degree: edu.degree, fieldOfStudy: edu.fieldOfStudy,
          startYear: edu.startYear ? parseInt(edu.startYear) : undefined,
          endYear: edu.endYear ? parseInt(edu.endYear) : undefined,
        });
      }

      // Add experience
      for (const exp of expList) {
        await userService.addExperience({
          title: exp.title, company: exp.company, location: exp.location,
          startDate: exp.startDate || undefined, endDate: exp.isCurrent ? undefined : (exp.endDate || undefined),
          isCurrent: exp.isCurrent, description: exp.description,
        });
      }

      // Add skills
      for (const skill of skills) {
        await userService.addSkill(skill);
      }

      navigate('/feed');
    } catch (err) {
      console.error('Profile setup error', err);
    } finally {
      setSaving(false);
    }
  };

  const stepContent = [
    // Step 0: Photo & Headline
    <div key="step0">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Add a profile photo</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
        Members with a photo get up to 21x more profile views.
      </p>

      {/* Avatar preview */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: profilePhotoUrl ? 'transparent' : '#e8f0fe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', marginBottom: 16,
          border: '3px dashed #0a66c2'
        }}>
          {profilePhotoUrl
            ? <img src={resolveFileUrl(profilePhotoUrl)} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 48 }}>👤</span>
          }
        </div>

        {/* Hidden file input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
        />

        {/* Upload from PC button */}
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: 12, minWidth: 200 }}
          onClick={() => photoInputRef.current?.click()}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? '⏳ Uploading…' : '📷 Upload photo from PC'}
        </button>

        {profilePhotoUrl && (
          <p style={{ fontSize: 12, color: '#057642', marginBottom: 8 }}>✓ Photo set successfully</p>
        )}
      </div>

      {/* Or paste URL */}
      <div className="form-group">
        <label className="form-label">Or paste a photo URL <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
        <input
          className="form-input"
          value={profilePhotoUrl}
          onChange={e => setProfilePhotoUrl(e.target.value)}
          placeholder="https://your-photo-url.com/photo.jpg"
        />
        <span style={{ fontSize: 11, color: '#999' }}>Recommended: Square image, at least 400×400px</span>
      </div>

      {/* Headline */}
      <div className="form-group">
        <label className="form-label">Headline <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
        <input
          className="form-input"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="e.g. Software Engineer at Company | Open to work"
          maxLength={220}
        />
        <span style={{ fontSize: 11, color: '#999' }}>{headline.length}/220</span>
      </div>
    </div>,

    // Step 1: Location & Summary
    <div key="step1">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Where are you located?</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>This helps recruiters and connections find you.</p>
      <div className="form-group">
        <label className="form-label">Location</label>
        <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" />
      </div>
      <div className="form-group">
        <label className="form-label">Summary <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
        <textarea value={summary} onChange={e => setSummary(e.target.value)}
          placeholder="Write a compelling summary that highlights your skills, experience and aspirations..."
          style={{ width: '100%', minHeight: 120, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
        <span style={{ fontSize: 11, color: '#999' }}>💡 Tip: Mention your key skills, accomplishments and career goals</span>
      </div>
    </div>,

    // Step 2: Education
    <div key="step2">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Add your education</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>Members with education get 10x more connection requests.</p>

      {eduList.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {eduList.map((edu, i) => (
            <div key={i} style={{ background: '#f3f2ef', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{edu.school}</p>
                <p style={{ fontSize: 12, color: '#666' }}>{edu.degree}{edu.fieldOfStudy && `, ${edu.fieldOfStudy}`} {edu.startYear && `· ${edu.startYear}–${edu.endYear}`}</p>
              </div>
              <button onClick={() => setEduList(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">School *</label>
            <input className="form-input" value={eduForm.school} onChange={e => setEduForm(prev => ({ ...prev, school: e.target.value }))} placeholder="School or University name" />
          </div>
          <div className="form-group">
            <label className="form-label">Degree</label>
            <input className="form-input" value={eduForm.degree} onChange={e => setEduForm(prev => ({ ...prev, degree: e.target.value }))} placeholder="e.g. Bachelor's" />
          </div>
          <div className="form-group">
            <label className="form-label">Field of Study</label>
            <input className="form-input" value={eduForm.fieldOfStudy} onChange={e => setEduForm(prev => ({ ...prev, fieldOfStudy: e.target.value }))} placeholder="e.g. Computer Science" />
          </div>
          <div className="form-group">
            <label className="form-label">Start Year</label>
            <input className="form-input" type="number" value={eduForm.startYear} onChange={e => setEduForm(prev => ({ ...prev, startYear: e.target.value }))} placeholder="2018" min="1950" max="2099" />
          </div>
          <div className="form-group">
            <label className="form-label">End Year</label>
            <input className="form-input" type="number" value={eduForm.endYear} onChange={e => setEduForm(prev => ({ ...prev, endYear: e.target.value }))} placeholder="2022" min="1950" max="2099" />
          </div>
        </div>
        <button className="btn btn-outline" onClick={handleAddEducation} disabled={!eduForm.school.trim()} style={{ marginTop: 4 }}>
          + Add Education
        </button>
      </div>
    </div>,

    // Step 3: Experience
    <div key="step3">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Add your work experience</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>Showcase your professional journey.</p>

      {expList.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {expList.map((exp, i) => (
            <div key={i} style={{ background: '#f3f2ef', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{exp.title}</p>
                <p style={{ fontSize: 12, color: '#666' }}>{exp.company} {exp.location && `· ${exp.location}`}</p>
              </div>
              <button onClick={() => setExpList(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Job Title *</label>
            <input className="form-input" value={expForm.title} onChange={e => setExpForm(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Software Engineer" />
          </div>
          <div className="form-group">
            <label className="form-label">Company *</label>
            <input className="form-input" value={expForm.company} onChange={e => setExpForm(prev => ({ ...prev, company: e.target.value }))} placeholder="Company name" />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={expForm.location} onChange={e => setExpForm(prev => ({ ...prev, location: e.target.value }))} placeholder="City, Country" />
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={expForm.startDate} onChange={e => setExpForm(prev => ({ ...prev, startDate: e.target.value }))} />
          </div>
          {!expForm.isCurrent && (
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={expForm.endDate} onChange={e => setExpForm(prev => ({ ...prev, endDate: e.target.value }))} />
            </div>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}>
          <input type="checkbox" checked={expForm.isCurrent} onChange={e => setExpForm(prev => ({ ...prev, isCurrent: e.target.checked }))} />
          I currently work here
        </label>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea value={expForm.description} onChange={e => setExpForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your key responsibilities and achievements..."
            style={{ width: '100%', minHeight: 80, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
        </div>
        <button className="btn btn-outline" onClick={handleAddExperience} disabled={!expForm.title.trim() || !expForm.company.trim()}>
          + Add Experience
        </button>
      </div>
    </div>,

    // Step 4: Skills
    <div key="step4">
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Add your top skills</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>Skills help recruiters and peers find and recognize your expertise.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="form-input" value={skillInput} onChange={e => setSkillInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
          placeholder="e.g. React, Java, SQL, Python..." style={{ flex: 1 }} />
        <button className="btn btn-outline" onClick={handleAddSkill} disabled={!skillInput.trim()}>Add</button>
      </div>
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {skills.map((skill, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#e8f0fe', color: '#0a66c2', borderRadius: 16,
              padding: '6px 14px', fontSize: 13, fontWeight: 500
            }}>
              {skill}
              <button onClick={() => setSkills(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 12, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      {skills.length === 0 && (
        <p style={{ color: '#999', fontSize: 13 }}>No skills added yet. Type a skill and press Add or Enter.</p>
      )}
    </div>,
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f3f2ef', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 48 }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#0a66c2', marginBottom: 24 }}>in</div>

      <div className="card" style={{ width: '100%', maxWidth: 600, padding: '32px 40px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 13, color: '#666' }}>Step {currentStep + 1} of {STEPS.length}</p>
            <button onClick={() => navigate('/feed')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 13 }}>
              Skip setup →
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: '#e0e0e0', borderRadius: 2, marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${((currentStep + 1) / STEPS.length) * 100}%`, background: '#0a66c2', borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>

          {/* Step tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STEPS.map((step, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 12,
                background: i === currentStep ? '#0a66c2' : i < currentStep ? '#e8f0fe' : '#f3f2ef',
                color: i === currentStep ? 'white' : i < currentStep ? '#0a66c2' : '#999',
                fontWeight: i === currentStep ? 600 : 400
              }}>
                {i < currentStep ? '✓ ' : ''}{step}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ minHeight: 300 }}>
          {stepContent[currentStep]}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid #e0e0e0' }}>
          <button className="btn btn-ghost" onClick={handleBack} disabled={currentStep === 0} style={{ opacity: currentStep === 0 ? 0.4 : 1 }}>
            ← Back
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {currentStep < STEPS.length - 1 ? (
              <>
                <button className="btn btn-ghost" onClick={handleSkip} style={{ fontSize: 13 }}>Skip this step</button>
                <button className="btn btn-primary" onClick={handleNext}>Continue →</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleFinish} disabled={saving} style={{ padding: '10px 24px' }}>
                {saving ? 'Saving profile...' : '🎉 Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#999', marginTop: 16 }}>
        You can always edit your profile later from your profile page.
      </p>
    </div>
  );
};

export default ProfileSetupPage;
