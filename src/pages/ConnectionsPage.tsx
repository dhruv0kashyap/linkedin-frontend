import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { connectionService, userService } from '../services';
import { Connection, User } from '../types';
import { useAuth } from '../context/AuthContext';

type Tab = 'connections' | 'pending' | 'suggestions' | 'lists';

interface ConnectionList {
  id: string;
  name: string;
  memberIds: number[];
}

const ConnectionsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const location = useLocation();

  // Core state
  const [connections, setConnections] = useState<User[]>([]);
  const [connectionIdMap, setConnectionIdMap] = useState<Record<number, number>>({});
  const [pendingList, setPendingList] = useState<Connection[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('connections');

  // Connections filter/search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('recent');
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Suggestions search
  const [suggestSearch, setSuggestSearch] = useState('');
  const [searching, setSearching] = useState(false);

  // ── US05: Connection lists/categories (stored in localStorage) ─────────────
  const LISTS_KEY = `connection_lists_${currentUser?.id}`;
  const loadLists = (): ConnectionList[] => {
    try { return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]'); }
    catch { return []; }
  };
  const saveLists = (lists: ConnectionList[]) =>
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));

  const [lists, setLists] = useState<ConnectionList[]>(loadLists);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [addToListUserId, setAddToListUserId] = useState<number | null>(null);

  // ── Read ?search= param from URL on mount ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q) {
      setSuggestSearch(q);
      setActiveTab('suggestions');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, pendRes] = await Promise.all([
        connectionService.getConnections(),
        connectionService.getPendingRequests(),
      ]);
      setConnections(connRes.data.data);
      setPendingList(pendRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const loadSuggestions = useCallback(async (keyword = '') => {
    setSearching(true);
    try {
      const connectedIds = new Set(connections.map(u => u.id));
      connectedIds.add(currentUser?.id ?? 0);
      const res = await userService.searchUsers(keyword);
      setSuggestions(res.data.data.filter((u: User) => !connectedIds.has(u.id)));
    } catch { console.error('Search failed'); }
    finally { setSearching(false); }
  }, [connections, currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab === 'suggestions') loadSuggestions(suggestSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, suggestSearch]);

  // ── Accept ────────────────────────────────────────────────────────────────
  const handleAccept = async (conn: Connection) => {
    try {
      await connectionService.acceptConnection(conn.id);
      setPendingList(prev => prev.filter(p => p.id !== conn.id));
      const newUser: User = {
        id: conn.senderId, firstName: conn.senderFirstName,
        lastName: conn.senderLastName, profilePhotoUrl: conn.senderProfilePhotoUrl,
        headline: conn.senderHeadline, email: '', isActive: true, createdAt: conn.createdAt,
      };
      setConnections(prev => [...prev, newUser]);
      setConnectionIdMap(prev => ({ ...prev, [conn.senderId]: conn.id }));
      showToast('Connection accepted! 🤝');
    } catch (err) { console.error(err); }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = async (connId: number) => {
    try {
      await connectionService.rejectConnection(connId);
      setPendingList(prev => prev.filter(p => p.id !== connId));
    } catch (err) { console.error(err); }
  };

  // ── Remove connection ─────────────────────────────────────────────────────
  const handleRemove = async (userId: number) => {
    if (!window.confirm('Remove this connection?')) return;
    setRemovingId(userId);
    try {
      let connId = connectionIdMap[userId];
      if (!connId) {
        const res = await connectionService.getConnectionStatus(userId);
        connId = res.data.data.connectionId!;
      }
      if (connId) {
        await connectionService.removeConnection(connId);
        setConnections(prev => prev.filter(c => c.id !== userId));
        setConnectionIdMap(prev => { const n = { ...prev }; delete n[userId]; return n; });
        // Also remove from any lists
        const updated = lists.map(l => ({ ...l, memberIds: l.memberIds.filter(id => id !== userId) }));
        setLists(updated);
        saveLists(updated);
        showToast('Connection removed');
      }
    } catch (err) { console.error(err); }
    finally { setRemovingId(null); }
  };

  // ── Connect ───────────────────────────────────────────────────────────────
  const handleConnect = async (userId: number) => {
    try {
      await connectionService.sendRequest(userId);
      setSentRequests(prev => new Set([...prev, userId]));
      showToast('Connection request sent!');
    } catch (err: any) { alert(err.response?.data?.message || 'Failed to send request'); }
  };

  // ── US05: List management ─────────────────────────────────────────────────
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const newList: ConnectionList = {
      id: Date.now().toString(),
      name: newListName.trim(),
      memberIds: [],
    };
    const updated = [...lists, newList];
    setLists(updated);
    saveLists(updated);
    setNewListName('');
    setCreatingList(false);
    showToast(`List "${newList.name}" created!`);
  };

  const handleDeleteList = (listId: string) => {
    if (!window.confirm('Delete this list?')) return;
    const updated = lists.filter(l => l.id !== listId);
    setLists(updated);
    saveLists(updated);
    if (selectedListId === listId) setSelectedListId(null);
  };

  const handleAddToList = (listId: string, userId: number) => {
    const updated = lists.map(l =>
      l.id === listId && !l.memberIds.includes(userId)
        ? { ...l, memberIds: [...l.memberIds, userId] }
        : l
    );
    setLists(updated);
    saveLists(updated);
    setAddToListUserId(null);
    showToast('Added to list!');
  };

  const handleRemoveFromList = (listId: string, userId: number) => {
    const updated = lists.map(l =>
      l.id === listId
        ? { ...l, memberIds: l.memberIds.filter(id => id !== userId) }
        : l
    );
    setLists(updated);
    saveLists(updated);
  };

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:28px;right:28px;background:#191919;color:white;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  // ── Filter/sort connections ────────────────────────────────────────────────
  const filteredConnections = connections.filter(c => {
    const q = searchQuery.toLowerCase();
    const loc = filterLocation.toLowerCase();
    const nameMatch = !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
      || (c.headline || '').toLowerCase().includes(q);
    const locMatch = !loc || (c.location || '').toLowerCase().includes(loc);
    return nameMatch && locMatch;
  });

  const sortedConnections = [...filteredConnections].sort((a, b) =>
    sortBy === 'name' ? `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) : 0
  );

  // Connections in the selected list
  const listMembers = selectedListId
    ? connections.filter(c => lists.find(l => l.id === selectedListId)?.memberIds.includes(c.id))
    : [];

  // ── User card ─────────────────────────────────────────────────────────────
  const UserCard: React.FC<{
    user: User;
    badge?: string;
    badgeColor?: string;
    actions: React.ReactNode;
    extra?: React.ReactNode;
  }> = ({ user, badge, badgeColor = '#057642', actions, extra }) => (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <Link to={`/profile/${user.id}`} style={{ flexShrink: 0 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: '#0a66c2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 18, overflow: 'hidden'
        }}>
          {user.profilePhotoUrl
            ? <img src={user.profilePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`
          }
        </div>
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/profile/${user.id}`} style={{ fontWeight: 600, fontSize: 14, color: '#191919' }}>
            {user.firstName} {user.lastName}
          </Link>
          {badge && (
            <span style={{ fontSize: 11, background: `${badgeColor}18`, color: badgeColor, borderRadius: 10, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>
              {badge}
            </span>
          )}
        </div>
        {user.headline && (
          <p style={{ fontSize: 12, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.headline}
          </p>
        )}
        {user.location && <p style={{ fontSize: 12, color: '#999', marginTop: 1 }}>📍 {user.location}</p>}
        {extra}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
        {actions}
      </div>
    </div>
  );

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ maxWidth: 900, paddingTop: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>My Network</h1>

      {/* ── Stats / tab bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'connections' as Tab, label: 'Connections', count: connections.length },
          { key: 'pending' as Tab, label: 'Pending', count: pendingList.length },
          { key: 'suggestions' as Tab, label: 'People You May Know', count: null },
          { key: 'lists' as Tab, label: 'My Lists', count: lists.length },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${activeTab === key ? '#0a66c2' : '#e0e0e0'}`,
              background: activeTab === key ? '#e8f0fe' : 'white',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
            }}>
            {count !== null && (
              <p style={{ fontSize: 20, fontWeight: 700, color: activeTab === key ? '#0a66c2' : '#191919', lineHeight: 1 }}>
                {count}
                {key === 'pending' && count > 0 && (
                  <span style={{ marginLeft: 4, background: '#e34234', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                    {count}
                  </span>
                )}
              </p>
            )}
            <p style={{ fontSize: 12, color: activeTab === key ? '#0a66c2' : '#666' }}>{label}</p>
          </button>
        ))}
      </div>

      {/* ── CONNECTIONS TAB ── */}
      {activeTab === 'connections' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input className="form-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Search by name or headline…" style={{ flex: 2, minWidth: 180 }} />
            <input className="form-input" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
              placeholder="📍 Filter by location" style={{ flex: 1, minWidth: 130 }} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'recent')}
              style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: 'white', cursor: 'pointer' }}>
              <option value="recent">Recently added</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            {sortedConnections.length} of {connections.length} connection{connections.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>

          {sortedConnections.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              {connections.length === 0
                ? <><p style={{ fontSize: 17, marginBottom: 8 }}>No connections yet</p>
                    <button onClick={() => setActiveTab('suggestions')} className="btn btn-primary">Find people to connect</button>
                  </>
                : <p>No connections match your search.</p>
              }
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedConnections.map(conn => (
                <UserCard key={conn.id} user={conn} badge="✓ Connected" badgeColor="#057642"
                  actions={
                    <>
                      <div style={{ position: 'relative' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap', padding: '6px 10px' }}
                          onClick={() => setAddToListUserId(addToListUserId === conn.id ? null : conn.id)}
                          title="Add to list">
                          📋
                        </button>
                        {addToListUserId === conn.id && (
                          <div style={{
                            position: 'absolute', top: '100%', right: 0, background: 'white',
                            border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 50, minWidth: 180, padding: 8
                          }}>
                            <p style={{ fontSize: 12, color: '#666', padding: '4px 8px', fontWeight: 600 }}>Add to list:</p>
                            {lists.length === 0 ? (
                              <p style={{ fontSize: 12, color: '#999', padding: '4px 8px' }}>No lists yet. Create one in "My Lists" tab.</p>
                            ) : lists.map(list => {
                              const alreadyIn = list.memberIds.includes(conn.id);
                              return (
                                <button key={list.id} onClick={() => alreadyIn ? handleRemoveFromList(list.id, conn.id) : handleAddToList(list.id, conn.id)}
                                  style={{
                                    width: '100%', padding: '6px 8px', background: alreadyIn ? '#e8f0fe' : 'none',
                                    border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                                    color: alreadyIn ? '#0a66c2' : '#191919', borderRadius: 4
                                  }}>
                                  {alreadyIn ? '✓ ' : ''}{list.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <Link to={`/profile/${conn.id}`} className="btn btn-outline" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>View</Link>
                      <button className="btn btn-ghost" onClick={() => handleRemove(conn.id)}
                        disabled={removingId === conn.id}
                        style={{ fontSize: 12, color: '#b24020', border: '1px solid #f5c2bb', whiteSpace: 'nowrap' }}>
                        {removingId === conn.id ? '…' : 'Remove'}
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── PENDING TAB ── */}
      {activeTab === 'pending' && (
        <div>
          {pendingList.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              <p style={{ fontSize: 17, marginBottom: 8 }}>No pending requests</p>
              <p style={{ fontSize: 14 }}>Invitations you receive will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                {pendingList.length} invitation{pendingList.length !== 1 ? 's' : ''} waiting
              </p>
              {pendingList.map(conn => {
                const sender: User = {
                  id: conn.senderId, firstName: conn.senderFirstName, lastName: conn.senderLastName,
                  profilePhotoUrl: conn.senderProfilePhotoUrl, headline: conn.senderHeadline,
                  email: '', isActive: true, createdAt: conn.createdAt,
                };
                return (
                  <UserCard key={conn.id} user={sender}
                    actions={
                      <>
                        <button className="btn btn-outline" onClick={() => handleReject(conn.id)} style={{ whiteSpace: 'nowrap' }}>Ignore</button>
                        <button className="btn btn-primary" onClick={() => handleAccept(conn)} style={{ whiteSpace: 'nowrap' }}>Accept</button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUGGESTIONS TAB ── */}
      {activeTab === 'suggestions' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <input className="form-input" value={suggestSearch} onChange={e => setSuggestSearch(e.target.value)}
              placeholder="🔍 Search people by name, headline…" style={{ flex: 1 }} />
            {suggestSearch && (
              <button className="btn btn-ghost" onClick={() => setSuggestSearch('')} style={{ fontSize: 13 }}>Clear</button>
            )}
          </div>

          {searching ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : suggestions.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              <p>{suggestSearch ? `No results for "${suggestSearch}"` : 'No suggestions available'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                {suggestions.length} result{suggestions.length !== 1 ? 's' : ''}
              </p>
              {suggestions.map(u => {
                const isConnected = connections.some(c => c.id === u.id);
                const hasSent = sentRequests.has(u.id);
                return (
                  <UserCard key={u.id} user={u} badge={isConnected ? '✓ Connected' : undefined}
                    actions={
                      isConnected ? (
                        <Link to={`/profile/${u.id}`} className="btn btn-outline" style={{ fontSize: 12 }}>View</Link>
                      ) : hasSent ? (
                        <button className="btn" style={{ fontSize: 12, background: '#f3f2ef', color: '#666', cursor: 'default' }} disabled>Pending…</button>
                      ) : (
                        <button className="btn btn-outline" onClick={() => handleConnect(u.id)} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>+ Connect</button>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── US05: MY LISTS TAB ── */}
      {activeTab === 'lists' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            {creatingList ? (
              <>
                <input className="form-input" value={newListName} onChange={e => setNewListName(e.target.value)}
                  placeholder="List name (e.g. Colleagues, Alumni, Mentors…)"
                  style={{ flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && handleCreateList()}
                  autoFocus />
                <button className="btn btn-ghost" onClick={() => { setCreatingList(false); setNewListName(''); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateList} disabled={!newListName.trim()}>Create</button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => setCreatingList(true)} style={{ fontSize: 14 }}>
                + Create new list
              </button>
            )}
          </div>

          {lists.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              <p style={{ fontSize: 17, marginBottom: 8 }}>No lists yet</p>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                Organize your connections into custom lists for easier management and targeted communication.
              </p>
              <p style={{ fontSize: 13, color: '#999' }}>
                Examples: <em>Colleagues, Alumni, Mentors, Clients, Friends</em>
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lists.map(list => (
                  <div key={list.id}
                    onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                    style={{
                      padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                      background: selectedListId === list.id ? '#e8f0fe' : 'white',
                      border: `1px solid ${selectedListId === list.id ? '#0a66c2' : '#e0e0e0'}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: selectedListId === list.id ? '#0a66c2' : '#191919' }}>
                        {list.name}
                      </p>
                      <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {list.memberIds.length} member{list.memberIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteList(list.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b24020', fontSize: 16, padding: '2px 4px' }}
                      title="Delete list">
                      🗑
                    </button>
                  </div>
                ))}
              </div>

              {selectedListId ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                      {lists.find(l => l.id === selectedListId)?.name}
                    </h2>
                    <p style={{ fontSize: 13, color: '#666' }}>{listMembers.length} member{listMembers.length !== 1 ? 's' : ''}</p>
                  </div>

                  {listMembers.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center', color: '#666' }}>
                      <p style={{ fontSize: 15, marginBottom: 8 }}>This list is empty</p>
                      <p style={{ fontSize: 13 }}>
                        Go to your <button onClick={() => setActiveTab('connections')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0a66c2', fontWeight: 600, padding: 0, fontSize: 13 }}>Connections</button> tab and use the 📋 icon to add people to this list.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {listMembers.map(member => (
                        <UserCard key={member.id} user={member}
                          actions={
                            <>
                              <Link to={`/profile/${member.id}`} className="btn btn-outline" style={{ fontSize: 12 }}>View</Link>
                              <button className="btn btn-ghost"
                                onClick={() => handleRemoveFromList(selectedListId, member.id)}
                                style={{ fontSize: 12, color: '#b24020', border: '1px solid #f5c2bb' }}>
                                Remove
                              </button>
                            </>
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                  <p>Select a list to view its members</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Close dropdown on outside click */}
      {addToListUserId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setAddToListUserId(null)} />
      )}
    </div>
  );
};

export default ConnectionsPage;
