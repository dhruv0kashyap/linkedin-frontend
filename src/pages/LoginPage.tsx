import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // US02 Circuit Breaker: 3 failed attempts in 30s → open for 60s
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [firstFailTime, setFirstFailTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for stored lockout on mount
  useEffect(() => {
    const storedLockout = localStorage.getItem('login_lockout_until');
    const storedAttempts = localStorage.getItem('login_attempts');
    if (storedLockout) {
      const until = parseInt(storedLockout);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) {
        setCircuitOpen(true);
        setLockoutSeconds(remaining);
        startLockoutTimer(remaining);
      } else {
        localStorage.removeItem('login_lockout_until');
        localStorage.removeItem('login_attempts');
      }
    }
    if (storedAttempts) setFailedAttempts(parseInt(storedAttempts));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startLockoutTimer = (seconds: number) => {
    let remaining = seconds;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      remaining--;
      setLockoutSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setCircuitOpen(false);
        setFailedAttempts(0);
        setFirstFailTime(null);
        localStorage.removeItem('login_lockout_until');
        localStorage.removeItem('login_attempts');
      }
    }, 1000);
  };

  const handleFailedAttempt = () => {
    const now = Date.now();
    const newAttempts = failedAttempts + 1;

    // Reset window if first fail was > 30s ago
    if (firstFailTime && (now - firstFailTime) > 30000) {
      setFailedAttempts(1);
      setFirstFailTime(now);
      localStorage.setItem('login_attempts', '1');
      return;
    }

    if (!firstFailTime) setFirstFailTime(now);
    setFailedAttempts(newAttempts);
    localStorage.setItem('login_attempts', String(newAttempts));

    // US02: 3 consecutive failures → open circuit for 60s
    if (newAttempts >= 3) {
      const lockoutUntil = Date.now() + 60000;
      localStorage.setItem('login_lockout_until', String(lockoutUntil));
      setCircuitOpen(true);
      setLockoutSeconds(60);
      startLockoutTimer(60);
    }
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.email.trim()) errs.email = 'Please provide a valid email';
    else if (!/^[\w._%+-]+@[\w.-]+\.(com|org|in)$/.test(form.email)) errs.email = 'Please provide a valid email';
    if (!form.password) errs.password = 'Please provide a valid password';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // US02: block if circuit is open (either frontend or backend)
    if (circuitOpen) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      await login(form.email, form.password);
      // Reset on success
      setFailedAttempts(0);
      localStorage.removeItem('login_attempts');
      localStorage.removeItem('login_lockout_until');
      navigate('/feed');
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Invalid email or password';

      // US02: Backend circuit breaker opened (HTTP 423 Locked)
      if (status === 423) {
        const lockoutUntil = Date.now() + 60000;
        localStorage.setItem('login_lockout_until', String(lockoutUntil));
        setCircuitOpen(true);
        setLockoutSeconds(60);
        startLockoutTimer(60);
        setFailedAttempts(3);
        localStorage.setItem('login_attempts', '3');
      } else {
        handleFailedAttempt();
        setErrors({ general: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ minHeight: '100vh', background: '#f3f2ef', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48 }}>
      <Link to="/"><div style={{ fontSize: 48, fontWeight: 800, color: '#0a66c2', marginBottom: 24 }}>in</div></Link>

      <p style={{ fontSize: 22, color: '#191919', marginBottom: 24, fontWeight: 400 }}>
        Welcome to your professional community
      </p>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 40px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 20 }}>Sign in</h1>

        {/* US02: Circuit breaker open — show timer and block access */}
        {circuitOpen && (
          <div style={{
            background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8,
            padding: 16, marginBottom: 20, textAlign: 'center'
          }}>
            <p style={{ fontWeight: 600, color: '#856404', fontSize: 15, marginBottom: 8 }}>
              🔒 Account temporarily locked
            </p>
            <p style={{ color: '#856404', fontSize: 13, marginBottom: 12 }}>
              Too many failed login attempts. Please wait before trying again.
            </p>
            {/* Running timer display */}
            <div style={{
              fontSize: 36, fontWeight: 700, color: '#b24020',
              fontFamily: 'monospace', letterSpacing: 2
            }}>
              {formatTime(lockoutSeconds)}
            </div>
            <p style={{ color: '#856404', fontSize: 12, marginTop: 8 }}>
              Time remaining before you can try again
            </p>
          </div>
        )}

        {/* Attempts warning (not yet locked) */}
        {!circuitOpen && failedAttempts > 0 && failedAttempts < 3 && (
          <div style={{
            background: '#fde8e4', border: '1px solid #f5c2bb', borderRadius: 6,
            padding: '10px 14px', marginBottom: 16, color: '#b24020', fontSize: 13
          }}>
            ⚠ {3 - failedAttempts} attempt{3 - failedAttempts !== 1 ? 's' : ''} remaining before account is temporarily locked
          </div>
        )}

        {errors.general && !circuitOpen && (
          <div style={{
            background: '#fde8e4', border: '1px solid #f5c2bb', borderRadius: 6,
            padding: '10px 14px', marginBottom: 16, color: '#b24020', fontSize: 14
          }}>
            ⚠ {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={e => { setForm(prev => ({ ...prev, email: e.target.value })); setErrors(prev => ({ ...prev, email: undefined })); }}
              placeholder="Email address"
              disabled={circuitOpen}
              style={errors.email ? { borderColor: '#b24020' } : {}}
            />
            {errors.email && <span className="form-error">⚠ {errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => { setForm(prev => ({ ...prev, password: e.target.value })); setErrors(prev => ({ ...prev, password: undefined })); }}
                placeholder="Password"
                disabled={circuitOpen}
                style={{ paddingRight: 44, ...(errors.password ? { borderColor: '#b24020' } : {}) }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#666' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && <span className="form-error">⚠ {errors.password}</span>}
          </div>

          {/* US02: Forgot password */}
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: '#0a66c2', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 28, opacity: circuitOpen ? 0.5 : 1 }}
            disabled={loading || circuitOpen}
          >
            {loading ? 'Signing in...' : circuitOpen ? `Locked (${formatTime(lockoutSeconds)})` : 'Sign in'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          <span style={{ fontSize: 13, color: '#999' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#666' }}>
          New to LinkedIn?{' '}
          <Link to="/register" style={{ color: '#0a66c2', fontWeight: 600 }}>Join now</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
