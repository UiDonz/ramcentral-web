import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  getClub,
  listenToMembers,
  getMembership,
  joinClub,
  leaveClub,
  approveMembership,
  changeMemberRole,
  certifyOfficer,
  revokeCertification,
  updateClub,
  archiveClub,
  unarchiveClub,
  approveClubApplication,
  denyClubApplication,
  listenToAnnouncements,
  postAnnouncement
} from '../services/clubs';
import { listenToClubEvents, createEvent, updateEvent, rsvpToEvent, cancelEvent } from '../services/events';
import DateTimePicker from '../components/DateTimePicker';
import {
  isClubOfficerRole,
  canManageRoles,
  canAssignRole,
  canViewClubFinances,
  canManageClubFinances,
  canManageLogistics,
  isStaff,
  CLUB_ROLES,
  CLUB_ROLE_LABELS
} from '../services/rbac';
import {
  requestBudget,
  listenToClubBudgetRequests,
  logClubExpense,
  listenToClubExpenses,
  requestRoomBooking,
  listenToClubRoomBookings
} from '../services/admin';
import ClubChat from '../components/ClubChat';

// Turns a saved event time into the 'YYYY-MM-DDTHH:mm' text the date picker uses.
function toDateTimeValue(ts) {
  const d = new Date(ts && ts.seconds ? ts.seconds * 1000 : ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ClubDetail() {
  const { clubId } = useParams();
  const { currentUser, profile } = useAuth();
  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '' });
  const [eventForm, setEventForm] = useState({ title: '', description: '', location: '', dateTime: '' });
  const [editingEvent, setEditingEvent] = useState(null); // { id, title, description, location, dateTime }
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState(null);
  const [memberNames, setMemberNames] = useState({});
  const [rbacError, setRbacError] = useState(null);
  const [eventsLoadError, setEventsLoadError] = useState(null);
  const [eventMessage, setEventMessage] = useState(null); // { type: 'error' | 'ok', text }
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budgetForm, setBudgetForm] = useState({ amount: '', reason: '' });
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '' });
  const [roomBookings, setRoomBookings] = useState([]);
  const [roomForm, setRoomForm] = useState({ room: '', dateTime: '', purpose: '' });

  useEffect(() => {
    getClub(clubId).then((c) => { setClub(c); setInfoForm(c); });
  }, [clubId]);

  useEffect(() => {
    const unsub = listenToMembers(clubId, setMembers);
    return unsub;
  }, [clubId]);

  useEffect(() => {
    const unsub = listenToAnnouncements(clubId, setAnnouncements);
    return unsub;
  }, [clubId]);

  useEffect(() => {
    const unsub = listenToClubEvents(clubId, setEvents, (err) =>
      setEventsLoadError(`${err.code || 'error'}: ${err.message}`)
    );
    return unsub;
  }, [clubId]);

  useEffect(() => {
    if (!currentUser) return;
    getMembership(clubId, currentUser.uid).then(setMyMembership);
  }, [clubId, currentUser, members]);

  // Resolves display names from the users collection (members only store uid + role); fine at club scale.
  useEffect(() => {
    const missing = members.filter((m) => !(m.uid in memberNames));
    if (missing.length === 0) return;
    missing.forEach(async (m) => {
      const snap = await getDoc(doc(db, 'users', m.uid));
      setMemberNames((prev) => ({ ...prev, [m.uid]: snap.exists() ? snap.data().name : m.uid }));
    });
  }, [members]);

  // isClubOfficerRole is true for every non-member role, including the legacy generic 'officer'.
  const isOfficer = isClubOfficerRole(myMembership?.role);
  const isApprovedMember = myMembership?.status === 'approved';
  const isStaffUser = isStaff(profile);
  const pendingMembers = members.filter((m) => m.status === 'pending');

  // Club Finances panel: Treasurer, President and Co-President can view it (canViewClubFinances);
  // only the Treasurer can file requests or log expenses (canManageClubFinances).
  const canFinance = canViewClubFinances(myMembership?.role);
  const canFinanceManage = canManageClubFinances(myMembership?.role);

  // Room & Logistics panel: President, Co-President and Vice President only.
  const canLogistics = canManageLogistics(myMembership?.role);

  // Only subscribe when the user has access; firestore.rules would reject the read anyway.
  useEffect(() => {
    if (!canFinance) {
      setBudgetRequests([]);
      setExpenses([]);
      return;
    }
    const unsubRequests = listenToClubBudgetRequests(clubId, setBudgetRequests);
    const unsubExpenses = listenToClubExpenses(clubId, setExpenses);
    return () => {
      unsubRequests();
      unsubExpenses();
    };
  }, [clubId, canFinance]);

  useEffect(() => {
    if (!canLogistics) {
      setRoomBookings([]);
      return;
    }
    const unsub = listenToClubRoomBookings(clubId, setRoomBookings);
    return unsub;
  }, [clubId, canLogistics]);

  async function runGuarded(fn, ...args) {
    setRbacError(null);
    try {
      await fn(...args);
    } catch (err) {
      setRbacError(err.message);
    }
  }

  async function handleJoinLeave() {
    if (myMembership) {
      await leaveClub(clubId, currentUser.uid, myMembership.status === 'approved');
      setMyMembership(null);
    } else {
      await joinClub(clubId, currentUser.uid, club.requiresApproval);
      setMyMembership(await getMembership(clubId, currentUser.uid));
    }
  }

  async function handlePostAnnouncement(e) {
    e.preventDefault();
    if (!announcementForm.title || !announcementForm.body) return;
    await postAnnouncement(clubId, currentUser.uid, announcementForm.title, announcementForm.body);
    setAnnouncementForm({ title: '', body: '' });
  }

  // Only the President, Co-President and Vice President can cancel an event.
  const canCancelEvents =
    myMembership?.status === 'approved' &&
    ['president', 'co_president', 'vice_president'].includes(myMembership?.role);

  async function handleCancelEvent(ev) {
    if (!window.confirm(`Cancel "${ev.title}"? This removes it for everyone.`)) return;
    try {
      await cancelEvent(ev.id);
      setEventMessage({ type: 'ok', text: 'Event cancelled.' });
    } catch (err) {
      setEventMessage({ type: 'error', text: `Couldn't cancel the event: ${err.message}` });
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    if (!eventForm.title || !eventForm.dateTime) {
      setEventMessage({ type: 'error', text: 'Please enter an event title and a date and time.' });
      return;
    }
    try {
      await createEvent({ clubId, createdBy: currentUser.uid, ...eventForm });
      setEventForm({ title: '', description: '', location: '', dateTime: '' });
      setEventMessage({ type: 'ok', text: 'Event created.' });
    } catch (err) {
      setEventMessage({ type: 'error', text: `Couldn't create the event: ${err.message}` });
    }
  }

  function startEditEvent(ev) {
    setEventMessage(null);
    setEditingEvent({
      id: ev.id,
      title: ev.title || '',
      description: ev.description || '',
      location: ev.location || '',
      dateTime: toDateTimeValue(ev.dateTime)
    });
  }

  async function handleSaveEvent(e) {
    e.preventDefault();
    if (!editingEvent.title || !editingEvent.dateTime) {
      setEventMessage({ type: 'error', text: 'Please enter an event title and a date and time.' });
      return;
    }
    try {
      const { id, ...fields } = editingEvent;
      await updateEvent(id, fields);
      setEditingEvent(null);
      setEventMessage({ type: 'ok', text: 'Event updated.' });
    } catch (err) {
      setEventMessage({ type: 'error', text: `Couldn't update the event: ${err.message}` });
    }
  }

  async function handleSaveInfo(e) {
    e.preventDefault();
    await updateClub(clubId, {
      description: infoForm.description,
      meetingTimes: infoForm.meetingTimes,
      contactInfo: infoForm.contactInfo,
      requiresApproval: infoForm.requiresApproval
    });
    setClub((c) => ({ ...c, ...infoForm }));
    setEditingInfo(false);
  }

  function handleRoleChange(targetUid, newRole) {
    runGuarded(changeMemberRole, clubId, targetUid, newRole, myMembership);
  }

  async function handleRequestBudget(e) {
    e.preventDefault();
    if (!budgetForm.amount) return;
    await runGuarded(requestBudget, {
      clubId,
      clubName: club.name,
      amount: budgetForm.amount,
      reason: budgetForm.reason,
      requestedBy: currentUser.uid,
      actingMembership: myMembership
    });
    setBudgetForm({ amount: '', reason: '' });
  }

  async function handleLogExpense(e) {
    e.preventDefault();
    if (!expenseForm.amount) return;
    const actor = { uid: currentUser.uid, name: profile?.name, role: profile?.role };
    await runGuarded(logClubExpense, clubId, expenseForm, myMembership, actor);
    setExpenseForm({ amount: '', description: '' });
  }

  async function handleRequestRoom(e) {
    e.preventDefault();
    if (!roomForm.room) return;
    await runGuarded(requestRoomBooking, {
      clubId,
      clubName: club.name,
      room: roomForm.room,
      dateTime: roomForm.dateTime,
      purpose: roomForm.purpose,
      requestedBy: currentUser.uid,
      actingMembership: myMembership
    });
    setRoomForm({ room: '', dateTime: '', purpose: '' });
  }

  function handleCertifyToggle(member) {
    // The actor must include role: isStaff() checks actor.role === 'faculty'.
    const actor = { uid: currentUser.uid, name: profile?.name, role: profile?.role };
    runGuarded(member.certified ? revokeCertification : certifyOfficer, clubId, member.uid, actor);
  }

  if (!club) return <div className="page">Loading club...</div>;
  const staffActor = { uid: currentUser?.uid, name: profile?.name, role: profile?.role };

  return (
    <div className="page">

      {/* Shown to everyone so officers know why the club isn't public yet; the action buttons are Staff-only. */}
      {club.status !== 'active' && (
        <div
          className="day-panel-empty"
          style={{ border: '1px solid #c99a3c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}
        >
          {club.status === 'pending' && 'This club is awaiting Staff approval and is not yet visible in the public directory.'}
          {club.status === 'archived' && 'This club has been archived and is hidden from the public directory.'}
          {isStaffUser && club.status === 'pending' && (
            <div className="form-actions" style={{ marginTop: '0.5em' }}>
              <button onClick={() => runGuarded(approveClubApplication, clubId, staffActor)}>Approve</button>
              <button className="secondary" onClick={() => runGuarded(denyClubApplication, clubId, staffActor)}>Deny</button>
            </div>
          )}
          {isStaffUser && club.status === 'archived' && (
            <div className="form-actions" style={{ marginTop: '0.5em' }}>
              <button onClick={() => runGuarded(unarchiveClub, clubId, staffActor)}>Restore</button>
            </div>
          )}
        </div>
      )}
      {rbacError && <p className="form-error">{rbacError}</p>}
      <div className="page-header">
        <div>
          <h1>{club.name}</h1>
          <p className="club-card-category">{club.category} &middot; {club.memberCount} members</p>
        </div>
        {isApprovedMember || myMembership?.status === 'pending' ? (
          <button className="secondary" onClick={handleJoinLeave}>
            {myMembership.status === 'pending' ? 'Cancel request' : 'Leave club'}
          </button>
        ) : (
          <button onClick={handleJoinLeave}>{club.requiresApproval ? 'Request to join' : 'Join club'}</button>
        )}
      </div>

      <section className="detail-section">
        <h2>About</h2>
        {!editingInfo ? (
          <>
            <p>{club.description}</p>
            {club.meetingTimes && <p><strong>Meets:</strong> {club.meetingTimes}</p>}
            {club.contactInfo && <p><strong>Contact:</strong> {club.contactInfo}</p>}
            <div className="form-actions">
              {isOfficer && <button className="link-button" onClick={() => setEditingInfo(true)}>Edit club info</button>}
              {isStaffUser && club.status === 'active' && (
                <button className="link-button" onClick={() => runGuarded(archiveClub, clubId, staffActor)}>
                  Archive this club
                </button>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveInfo} className="inline-form">
            <label>Description
              <textarea value={infoForm.description} onChange={(e) => setInfoForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label>Meeting times
              <input value={infoForm.meetingTimes} onChange={(e) => setInfoForm((f) => ({ ...f, meetingTimes: e.target.value }))} />
            </label>
            <label>Contact info
              <input value={infoForm.contactInfo} onChange={(e) => setInfoForm((f) => ({ ...f, contactInfo: e.target.value }))} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={infoForm.requiresApproval} onChange={(e) => setInfoForm((f) => ({ ...f, requiresApproval: e.target.checked }))} />
              Require officer approval to join
            </label>
            <div className="form-actions">
              <button type="submit">Save</button>
              <button type="button" className="secondary" onClick={() => setEditingInfo(false)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <section className="detail-section">
        <h2>Announcements</h2>
        {isOfficer && (
          <form onSubmit={handlePostAnnouncement} className="inline-form">
            <input
              placeholder="Announcement title"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              placeholder="What's happening with the club?"
              value={announcementForm.body}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
            />
            <button type="submit">Post announcement</button>
          </form>
        )}
        {announcements.length === 0 && <p className="empty-state">No announcements yet.</p>}
        {announcements.map((a) => (
          <div key={a.id} className="announcement">
            <h3>{a.title}</h3>
            <p>{a.body}</p>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h2>Events</h2>
        {isOfficer && (
          <form onSubmit={handleCreateEvent} className="inline-form">
            <input
              placeholder="Event title"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
            />
            <DateTimePicker
              value={eventForm.dateTime}
              onChange={(value) => setEventForm((f) => ({ ...f, dateTime: value }))}
            />
            <input
              placeholder="Location"
              value={eventForm.location}
              onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
            />
            <textarea
              placeholder="Description"
              value={eventForm.description}
              onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
            />
            <button type="submit">Create event</button>
            {eventMessage && (
              <p className={eventMessage.type === 'error' ? 'form-error' : 'form-success'}>
                {eventMessage.text}
              </p>
            )}
          </form>
        )}
        {eventsLoadError && (
          <p className="form-error">Couldn't load this club's events ({eventsLoadError})</p>
        )}
        {!eventsLoadError && events.length === 0 && <p className="empty-state">No upcoming events.</p>}
        {events.map((ev) =>
          editingEvent && editingEvent.id === ev.id ? (
            <form key={ev.id} onSubmit={handleSaveEvent} className="inline-form">
              <input
                placeholder="Event title"
                value={editingEvent.title}
                onChange={(e) => setEditingEvent((f) => ({ ...f, title: e.target.value }))}
              />
              <DateTimePicker
                value={editingEvent.dateTime}
                onChange={(value) => setEditingEvent((f) => ({ ...f, dateTime: value }))}
              />
              <input
                placeholder="Location"
                value={editingEvent.location}
                onChange={(e) => setEditingEvent((f) => ({ ...f, location: e.target.value }))}
              />
              <textarea
                placeholder="Description"
                value={editingEvent.description}
                onChange={(e) => setEditingEvent((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="form-actions">
                <button type="submit">Save changes</button>
                <button type="button" className="secondary" onClick={() => setEditingEvent(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
          <div key={ev.id} className="event-card">
            <h3>{ev.title}</h3>
            <p>{new Date(ev.dateTime.seconds ? ev.dateTime.seconds * 1000 : ev.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
            {ev.location && <p>{ev.location}</p>}
            {isApprovedMember && (
              <button className="secondary" onClick={() => rsvpToEvent(ev.id, currentUser.uid)}>RSVP</button>
            )}
            {isOfficer && (
              <button className="secondary" style={{ marginLeft: '0.6em' }} onClick={() => startEditEvent(ev)}>
                Edit
              </button>
            )}
            {canCancelEvents && (
              <button className="secondary" style={{ marginLeft: '0.6em' }} onClick={() => handleCancelEvent(ev)}>
                Cancel event
              </button>
            )}
          </div>
          )
        )}
      </section>

      <section className="detail-section">
        <h2>Members ({members.filter((m) => m.status === 'approved').length})</h2>
        {isOfficer && pendingMembers.length > 0 && (
          <div>
            <h3>Pending requests</h3>
            {pendingMembers.map((m) => (
              <div key={m.uid} className="member-row">
                <span>{memberNames[m.uid] || m.uid}</span>
                <button onClick={() => approveMembership(clubId, m.uid)}>Approve</button>
              </div>
            ))}
          </div>
        )}
        {members.filter((m) => m.status === 'approved').map((m) => (
          <div key={m.uid} className="member-row">
            <span>{m.uid === currentUser.uid ? `${profile?.name} (you)` : (memberNames[m.uid] || m.uid)}</span>
            <span className="badge">{CLUB_ROLE_LABELS[m.role] || m.role}</span>
            {m.certified && (
              <span className="certified-badge" title="Certified student leader">&#10003; Certified</span>
            )}
            {/* Only a President/Co-President gets the role dropdown, never on their own row. */}
            {canManageRoles(myMembership) && m.uid !== currentUser.uid && (
              <select
                className="role-select"
                value={m.role}
                aria-label={`Change ${memberNames[m.uid] || 'member'}'s role`}
                onChange={(e) => handleRoleChange(m.uid, e.target.value)}
              >
                {CLUB_ROLES.filter((r) => r === m.role || canAssignRole(myMembership, r)).map((r) => (
                  <option key={r} value={r}>{CLUB_ROLE_LABELS[r]}</option>
                ))}
              </select>
            )}
            {isStaffUser && isClubOfficerRole(m.role) && (
              <button className="link-button" onClick={() => handleCertifyToggle(m)}>
                {m.certified ? 'Revoke certification' : 'Certify'}
              </button>
            )}
          </div>
        ))}
      </section>

      {/* Club Finances: only the Treasurer, President and Co-President see it; other roles' reads are also rejected in firestore.rules. */}

      {canFinance && (
        <section className="detail-section">
          <h2>Club Finances</h2>
          <div className="stat-tile-row">
            <div className="stat-tile">
              <div className="stat-tile-value">${(club.budgetReceived || 0).toLocaleString()}</div>
              <div className="stat-tile-label">Received</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-value">${(club.budgetSpent || 0).toLocaleString()}</div>
              <div className="stat-tile-label">Spent</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-value">
                ${((club.budgetReceived || 0) - (club.budgetSpent || 0)).toLocaleString()}
              </div>
              <div className="stat-tile-label">Remaining</div>
            </div>
          </div>
          <h3>Request funds from Staff</h3>
          {/* Only the Treasurer sees the request form; the President/Co-President get the panel for oversight. */}
          {canFinanceManage ? (
            <form onSubmit={handleRequestBudget} className="inline-form">
              <label>Amount ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </label>
              <label>Reason
                <input
                  placeholder="e.g. Spring showcase supplies"
                  value={budgetForm.reason}
                  onChange={(e) => setBudgetForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </label>
              <button type="submit">Submit request</button>
            </form>
          ) : (
            <p className="empty-state">Only this club's Treasurer can file a new request.</p>
          )}
          {budgetRequests.length === 0 && <p className="empty-state">No budget requests filed yet.</p>}
          {budgetRequests.map((r) => (
            <div key={r.id} className="member-row">
              <span>${r.amount}{r.reason ? ` – ${r.reason}` : ''}</span>
              <span className={`status-pill status-${r.status === 'pending' ? 'pending' : r.status === 'approved' ? 'active' : 'archived'}`}>
                {r.status}
              </span>
            </div>
          ))}
          <h3>Log an expense</h3>
          {canFinanceManage ? (
            <form onSubmit={handleLogExpense} className="inline-form">
              <label>Amount ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </label>
              <label>Description
                <input
                  placeholder="e.g. Poster printing"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <button type="submit">Log expense</button>
            </form>
          ) : (
            <p className="empty-state">Only this club's Treasurer can log an expense.</p>
          )}
          {expenses.length === 0 && <p className="empty-state">No expenses logged yet.</p>}
          {expenses.map((ex) => (
            <div key={ex.id} className="member-row">
              <span>${ex.amount}{ex.description ? ` – ${ex.description}` : ''}</span>
              <span className="badge">{ex.loggedByName}</span>
            </div>
          ))}
        </section>
      )}

      {/* Room & Logistics: President, Co-President and Vice President only. */}

      {canLogistics && (
        <section className="detail-section">
          <h2>Room &amp; Logistics</h2>
          <form onSubmit={handleRequestRoom} className="inline-form">
            <label>Room
              <input
                placeholder="e.g. Student Center 204"
                value={roomForm.room}
                onChange={(e) => setRoomForm((f) => ({ ...f, room: e.target.value }))}
                required
              />
            </label>
            <div className="dtp-field-group">
              <span>Date &amp; time</span>
              <DateTimePicker
                value={roomForm.dateTime}
                onChange={(value) => setRoomForm((f) => ({ ...f, dateTime: value }))}
              />
            </div>
            <label>Purpose
              <input
                placeholder="e.g. General meeting"
                value={roomForm.purpose}
                onChange={(e) => setRoomForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </label>
            <button type="submit">Request room</button>
          </form>
          {roomBookings.length === 0 && <p className="empty-state">No room requests filed yet.</p>}
          {roomBookings.map((r) => (
            <div key={r.id} className="member-row">
              <span>{r.room}{r.purpose ? ` – ${r.purpose}` : ''}</span>
              <span className={`status-pill status-${r.status === 'pending' ? 'pending' : r.status === 'approved' ? 'active' : 'archived'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </section>
      )}

      {isApprovedMember && (
        <section className="detail-section">
          <h2>Club Chat</h2>
          <ClubChat clubId={clubId} uid={currentUser.uid} name={profile?.name} />
        </section>
      )}
    </div>
  );
}