import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';

const notificationIcon: Record<string, string> = {
  CONNECTION_REQUEST: '👥',
  CONNECTION_ACCEPTED: '🤝',
  POST_LIKE: '👍',
  POST_COMMENT: '💬',
  JOB_APPLICATION_UPDATE: '💼',
};

// Map each notification type to a route
// referenceId = the related entity's ID (post ID, user ID, job ID etc.)
const getNotificationUrl = (notif: Notification): string | null => {
  const id = notif.referenceId;
  switch (notif.type) {
    case 'CONNECTION_REQUEST':
    case 'CONNECTION_ACCEPTED':
      // referenceId = the other user's ID
      return id ? `/profile/${id}` : '/connections';
    case 'POST_LIKE':
    case 'POST_COMMENT':
      // referenceId = the post's ID — go to feed for now (no standalone post page)
      return '/feed';
    case 'JOB_APPLICATION_UPDATE':
      // referenceId = the job ID — go to applied tab
      return '/jobs';
    default:
      return null;
  }
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadNotifications = async (pageNum = 0) => {
    try {
      const res = await notificationService.getNotifications(pageNum, 20);
      const { content, last } = res.data.data;
      setNotifications(prev => pageNum === 0 ? content : [...prev, ...content]);
      setHasMore(!last);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNotifications(0); }, []);

  const handleClick = async (notif: Notification) => {
    // Mark as read first if unread
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch (err) { console.error(err); }
    }
    // Navigate to the relevant page
    const url = getNotificationUrl(notif);
    if (url) navigate(url);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) { console.error(err); }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          Notifications {unreadCount > 0 && (
            <span style={{ fontSize: 14, background: '#e34234', color: 'white', borderRadius: 12, padding: '2px 8px', marginLeft: 8 }}>
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button className="btn btn-ghost" onClick={handleMarkAllRead} style={{ fontSize: 13, color: '#0a66c2' }}>
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: '#666' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No notifications yet</p>
          <p style={{ fontSize: 14 }}>We'll let you know when something important happens.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notifications.map(notif => {
            const url = getNotificationUrl(notif);
            return (
              <div key={notif.id} className="card"
                onClick={() => handleClick(notif)}
                style={{
                  padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
                  background: notif.isRead ? 'white' : '#f0f7ff',
                  cursor: url ? 'pointer' : 'default',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { if (url) (e.currentTarget as HTMLDivElement).style.background = notif.isRead ? '#f9f9f9' : '#e4f0fc'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = notif.isRead ? 'white' : '#f0f7ff'; }}
              >
                <div style={{ fontSize: 28, flexShrink: 0 }}>
                  {notificationIcon[notif.type] || '🔔'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, color: '#191919', lineHeight: 1.5 }}>{notif.message}</p>
                  <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                  {url && (
                    <p style={{ fontSize: 12, color: '#0a66c2', marginTop: 4 }}>
                      {notif.type === 'CONNECTION_REQUEST' && 'View profile →'}
                      {notif.type === 'CONNECTION_ACCEPTED' && 'View profile →'}
                      {notif.type === 'POST_LIKE' && 'Go to feed →'}
                      {notif.type === 'POST_COMMENT' && 'Go to feed →'}
                      {notif.type === 'JOB_APPLICATION_UPDATE' && 'View applications →'}
                    </p>
                  )}
                </div>
                {!notif.isRead && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0a66c2', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button className="btn btn-outline" style={{ width: '100%', marginTop: 12 }}
          onClick={() => { const next = page + 1; setPage(next); loadNotifications(next); }}>
          Load more
        </button>
      )}
    </div>
  );
};

export default NotificationsPage;
