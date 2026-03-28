import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface FormErrors {
  firstName?: string; lastName?: string; email?: string;
  password?: string; confirmPassword?: string; phoneNumber?: string; general?: string;
}

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '', phoneNumber: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.firstName.trim()) e.firstName = 'Please provide a valid firstName';
    else if (!/^[A-Z][a-zA-Z]*$/.test(form.firstName))
      e.firstName = 'First name must start with a capital letter and contain only English letters';
    if (!form.lastName.trim()) e.lastName = 'Please provide a valid lastName';
    else if (!/^[a-zA-Z]+$/.test(form.lastName))
      e.lastName = 'Last name must contain only English letters';
    if (!form.email.trim()) e.email = 'Please provide a valid email';
    else if (!/^[\w._%+-]+@[\w.-]+\.(com|org|in)$/.test(form.email))
      e.email = 'Email must end in .com, .org, or .in';
    if (!form.password) e.password = 'Please provide a valid password';
    else if (form.password.length < 8 || form.password.length > 16)
      e.password = 'Password must be 8–16 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/.test(form.password))      
      e.password = 'Must have uppercase, lowercase, digit and special character';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (form.phoneNumber && !/^[0-9]{10}$/.test(form.phoneNumber))
      e.phoneNumber = 'Please provide a valid 10-digit phoneNumber';
    return e;
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field as keyof FormErrors]) setErrors(p => ({ ...p, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({}); setLoading(true);
    try {
      await register(form);
      setSuccessMsg('🎉 Account created successfully! Welcome to LinkedIn.');
      setTimeout(() => navigate('/profile/setup'), 1800);
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.message?.toLowerCase().includes('already'))
        setErrors({ email: 'This email is already associated with an existing account' });
      else if (data?.data && typeof data.data === 'object')
        setErrors(data.data);
      else
        setErrors({ general: data?.message || 'Registration failed. Please try again.' });
    } finally { setLoading(false); }
  };

  const strength = (() => {
    const p = form.password; if (!p) return null;
    let s = 0;
    if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++; if (/[@$!%*?&]/.test(p)) s++;
    if (s <= 2) return { label: 'Weak', color: '#b24020', w: '30%' };
    if (s <= 3) return { label: 'Fair', color: '#915907', w: '65%' };
    return { label: 'Strong', color: '#057642', w: '100%' };
  })();

  if (successMsg) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ padding: 40, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#057642', marginBottom: 8 }}>Account Created!</h2>
          <p style={{ fontSize: 15, color: '#444', marginBottom: 8 }}>{successMsg}</p>
          <p style={{ fontSize: 13, color: '#999' }}>Redirecting to profile setup…</p>
          <div style={{ marginTop: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f2ef', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 40 }}>
      <Link to="/"><div style={{ fontSize: 40, fontWeight: 800, color: '#0a66c2', marginBottom: 20 }}>in</div></Link>

      <div className="card" style={{ width: '100%', maxWidth: 520, padding: '32px 40px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Make the most of your professional life</h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>Create your LinkedIn account</p>

        {errors.general && (
          <div style={{ background: '#fde8e4', border: '1px solid #f5c2bb', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: '#b24020', fontSize: 14 }}>
            ⚠ {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Name row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">First name *</label>
              <input className="form-input" value={form.firstName}
                onChange={e => handleChange('firstName', e.target.value)}
                placeholder="First name"
                style={errors.firstName ? { borderColor: '#b24020' } : {}} />
              {errors.firstName && <span className="form-error">⚠ {errors.firstName}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Last name *</label>
              <input className="form-input" value={form.lastName}
                onChange={e => handleChange('lastName', e.target.value)}
                placeholder="Last name"
                style={errors.lastName ? { borderColor: '#b24020' } : {}} />
              {errors.lastName && <span className="form-error">⚠ {errors.lastName}</span>}
            </div>
          </div>

          {/* ── Email ── */}
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="Email address"
              style={errors.email ? { borderColor: '#b24020' } : {}} />
            {errors.email && <span className="form-error">⚠ {errors.email}</span>}
          </div>

          {/* ── Password ── */}
          <div className="form-group">
            <label className="form-label">Password * <span style={{ color: '#999', fontWeight: 400, fontSize: 12 }}>(8–16 chars)</span></label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showPwd ? 'text' : 'password'}
                value={form.password} onChange={e => handleChange('password', e.target.value)}
                placeholder="Password"
                style={{ paddingRight: 44, ...(errors.password ? { borderColor: '#b24020' } : {}) }} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {form.password && strength && (
              <div style={{ marginTop: 5 }}>
                <div style={{ height: 4, background: '#e0e0e0', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: strength.w, background: strength.color, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: strength.color }}>{strength.label} password</span>
              </div>
            )}
            {errors.password && <span className="form-error">⚠ {errors.password}</span>}
          </div>

          {/* ── Confirm Password ── */}
          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                style={{ paddingRight: 44, borderColor: form.confirmPassword ? (form.password === form.confirmPassword ? '#057642' : '#b24020') : undefined }} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
            {form.confirmPassword && form.password !== form.confirmPassword &&
              <span className="form-error">⚠ Passwords do not match</span>}
            {form.confirmPassword && form.password === form.confirmPassword &&
              <span style={{ fontSize: 12, color: '#057642' }}>✓ Passwords match</span>}
          </div>

          {/* ── Phone ── */}
          <div className="form-group">
            <label className="form-label">
              Phone Number <span style={{ color: '#999', fontWeight: 400 }}>(optional — needed for password reset)</span>
            </label>
            <input className="form-input" type="tel" value={form.phoneNumber}
              onChange={e => handleChange('phoneNumber', e.target.value)}
              placeholder="10-digit mobile number" maxLength={10}
              style={errors.phoneNumber ? { borderColor: '#b24020' } : {}} />
            {errors.phoneNumber && <span className="form-error">⚠ {errors.phoneNumber}</span>}
          </div>

          <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
            By clicking Agree & Join, you agree to the LinkedIn{' '}
            <span style={{ color: '#0a66c2', cursor: 'pointer' }}>User Agreement</span>,{' '}
            <span style={{ color: '#0a66c2', cursor: 'pointer' }}>Privacy Policy</span>, and{' '}
            <span style={{ color: '#0a66c2', cursor: 'pointer' }}>Cookie Policy</span>.
          </p>

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 28 }}
            disabled={loading}>
            {loading ? 'Creating account…' : 'Agree & Join'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          <span style={{ fontSize: 13, color: '#999' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
        </div>
        <p style={{ textAlign: 'center', fontSize: 14 }}>
          Already on LinkedIn?{' '}
          <Link to="/login" style={{ color: '#0a66c2', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
