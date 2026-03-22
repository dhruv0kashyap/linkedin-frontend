import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services';

type Step = 'verify' | 'reset' | 'done';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('verify');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = (p: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/.test(p);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!/^[0-9]{10}$/.test(phoneNumber)) { setError('Please provide a valid 10-digit phone number'); return; }
    setError(''); setLoading(true);
    try {
      await authService.verifyPhone(email, phoneNumber);
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed. Check your email and phone number.');
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword(newPassword)) {
      setError('Password must be 8–16 chars with uppercase, lowercase, digit and special character');
      return;
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await authService.resetPassword(email, newPassword, confirmPassword);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f2ef', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48 }}>
      <Link to="/login"><div style={{ fontSize: 40, fontWeight: 800, color: '#0a66c2', marginBottom: 24 }}>in</div></Link>

      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '32px 40px' }}>
        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
          {['Verify identity', 'New password', 'Done'].map((label, i) => {
            const stepIndex = step === 'verify' ? 0 : step === 'reset' ? 1 : 2;
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                  background: stepIndex > i ? '#057642' : stepIndex === i ? '#0a66c2' : '#e0e0e0',
                  color: stepIndex >= i ? 'white' : '#999',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700
                }}>{stepIndex > i ? '✓' : i + 1}</div>
                <p style={{ fontSize: 11, color: stepIndex === i ? '#0a66c2' : '#999' }}>{label}</p>
              </div>
            );
          })}
        </div>

        {/* Step 1: Verify phone */}
        {step === 'verify' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Forgot password?</h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
              Enter your email and the phone number linked to your account to verify your identity.
            </p>
            {error && (
              <div style={{ background: '#fde8e4', border: '1px solid #f5c2bb', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: '#b24020', fontSize: 14 }}>
                ⚠ {error}
              </div>
            )}
            <form onSubmit={handleVerify} noValidate>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your registered email" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone number</label>
                <input className="form-input" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="10-digit mobile number" maxLength={10} />
                <span style={{ fontSize: 12, color: '#999' }}>The phone number linked to your account</span>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 13, borderRadius: 28, fontSize: 15 }} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify identity'}
              </button>
            </form>
          </>
        )}

        {/* Step 2: New password */}
        {step === 'reset' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Set new password</h1>
            <p style={{ fontSize: 14, color: '#057642', marginBottom: 20 }}>
              ✓ Identity verified! Create a new secure password for your account.
            </p>
            {error && (
              <div style={{ background: '#fde8e4', border: '1px solid #f5c2bb', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: '#b24020', fontSize: 14 }}>
                ⚠ {error}
              </div>
            )}
            <form onSubmit={handleReset} noValidate>
              <div className="form-group">
                <label className="form-label">New password <span style={{ fontSize: 11, color: '#999' }}>(8–16 chars)</span></label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPwd ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} placeholder="New password" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                {newPassword && (
                  <span style={{ fontSize: 12, color: validatePassword(newPassword) ? '#057642' : '#b24020' }}>
                    {validatePassword(newPassword) ? '✓ Strong password' : '✗ Must have uppercase, lowercase, digit, special char'}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm new password</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                    style={{ paddingRight: 44, borderColor: confirmPassword ? (newPassword === confirmPassword ? '#057642' : '#b24020') : undefined }} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                    {showConfirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <span className="form-error">⚠ Passwords do not match</span>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 13, borderRadius: 28, fontSize: 15 }} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Password reset!</h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', padding: 13, borderRadius: 28, fontSize: 15 }}
              onClick={() => navigate('/login')}>
              Sign in now
            </button>
          </div>
        )}

        {step !== 'done' && (
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
            <Link to="/login" style={{ color: '#0a66c2' }}>← Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
