import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services';
import { resolveFileUrl } from '../../services/api';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bug fix 4: fetch unread count on route change AND poll every 15s
  const fetchUnreadCount = useCallback(() => {
    notificationService.getUnreadCount()
      .then(res => setUnreadCount(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Poll every 15 seconds so bell updates without page refresh
    pollRef.current = setInterval(fetchUnreadCount, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchUnreadCount]);

  // Also refresh immediately on every route change
  useEffect(() => {
    fetchUnreadCount();
  }, [location.pathname, fetchUnreadCount]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // US08: Secure logout
  const handleLogout = () => {
    setShowLogoutConfirm(true);
    setShowProfileMenu(false);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    if (pollRef.current) clearInterval(pollRef.current);
    navigate('/login', { replace: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to connections page with search pre-filled
      navigate(`/connections?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';
  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItem = (path: string, icon: string, label: string) => (
    <Link to={path} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 12px', height: 52, gap: 2,
      borderBottom: isActive(path) ? '2px solid #191919' : '2px solid transparent',
      color: isActive(path) ? '#191919' : '#666',
      fontSize: 11, fontWeight: isActive(path) ? 600 : 400,
      textDecoration: 'none', transition: 'color 0.15s', flexShrink: 0
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      <nav style={{
        background: 'white', borderBottom: '1px solid #e0e0e0', position: 'sticky',
        top: 0, zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 52, gap: 8 }}>
          {/* Logo */}
          <Link to="/feed" style={{ color: '#0a66c2', fontSize: 30, fontWeight: 800, marginRight: 4, flexShrink: 0, textDecoration: 'none' }}>
            in
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 260 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Search"
              style={{
                width: '100%', padding: '7px 12px', borderRadius: 4,
                border: '1px solid transparent', background: '#f3f2ef',
                fontSize: 14, outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={e => (e.target.style.borderColor = '#0a66c2')}
              onBlur={e => (e.target.style.borderColor = 'transparent')}
            />
          </form>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: 'auto' }}>
            {navItem('/feed', '🏠', 'Home')}
            {navItem('/connections', '👥', 'Network')}
            {navItem('/jobs', '💼', 'Jobs')}

            {/* Notifications bell with live badge */}
            <Link to="/notifications"
              onClick={() => setTimeout(fetchUnreadCount, 500)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '0 12px', height: 52, gap: 2,
                borderBottom: isActive('/notifications') ? '2px solid #191919' : '2px solid transparent',
                color: isActive('/notifications') ? '#191919' : '#666',
                fontSize: 11, fontWeight: isActive('/notifications') ? 600 : 400,
                textDecoration: 'none', position: 'relative', flexShrink: 0
              }}>
              <span style={{ position: 'relative', fontSize: 20 }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6, background: '#e34234',
                    color: 'white', borderRadius: '50%', width: 17, height: 17,
                    fontSize: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, lineHeight: 1
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span>Alerts</span>
            </Link>

            {/* Profile dropdown */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '0 12px', height: 52, gap: 2, background: 'none', border: 'none',
                  cursor: 'pointer', color: '#666', fontSize: 11
                }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: '#0a66c2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 11, fontWeight: 700, overflow: 'hidden'
                }}>
                  {user?.profilePhotoUrl
                    ? <img src={resolveFileUrl(user.profilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials
                  }
                </div>
                <span>Me ▾</span>
              </button>

              {showProfileMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, background: 'white',
                  border: '1px solid #e0e0e0', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 200, overflow: 'hidden'
                }}>
                  {/* User info header */}
                  <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', background: '#0a66c2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, overflow: 'hidden'
                      }}>
                        {user?.profilePhotoUrl
                          ? <img src={resolveFileUrl(user.profilePhotoUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials
                        }
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{user?.firstName} {user?.lastName}</p>
                        {user?.headline && (
                          <p style={{ fontSize: 12, color: '#666', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.headline}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link to="/profile/me" onClick={() => setShowProfileMenu(false)}
                      style={{
                        display: 'block', textAlign: 'center', marginTop: 10, padding: 6,
                        border: '1px solid #0a66c2', borderRadius: 16,
                        color: '#0a66c2', fontSize: 13, fontWeight: 600, textDecoration: 'none'
                      }}>
                      View Profile
                    </Link>
                  </div>

                  <div style={{ padding: '8px 0' }}>
                    {[
                      { to: '/profile/setup', icon: '⚙️', label: 'Settings & Profile Setup' },
                      { to: '/jobs', icon: '💼', label: 'My Applications' },
                    ].map(({ to, icon, label }) => (
                      <Link key={to} to={to} onClick={() => setShowProfileMenu(false)}
                        style={{ display: 'block', padding: '10px 20px', fontSize: 14, color: '#444', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f3f2ef')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {icon} {label}
                      </Link>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
                    <button onClick={handleLogout}
                      style={{
                        width: '100%', padding: '10px 20px', fontSize: 14, color: '#b24020',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 500
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fde8e4')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      🚪 Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className="card" style={{ padding: 28, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sign out of LinkedIn?</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
              Your session will be terminated and you'll be redirected to the login page.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmLogout} style={{ flex: 1 }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
