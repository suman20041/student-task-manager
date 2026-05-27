/**
 * Collaborative Study Module
 * Uses BroadcastChannel to simulate real-time interaction across browser tabs
 */

const studyChannel = new BroadcastChannel('taskquest_study_room');
const myTabId = Math.random().toString(36).substr(2, 9);
const messagesContainer = document.getElementById('messagesContainer');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const onlineList = document.getElementById('onlineList');
const statusSelect = document.getElementById('statusSelect');
const teamMemberList = document.getElementById('teamMemberList');
const memberSearchInput = document.getElementById('memberSearchInput');
const addMemberBtn = document.getElementById('addMemberBtn');

// Local User State
let myProfile = JSON.parse(localStorage.getItem('quests_profile') || '{"name": "Anonymous Scholar"}');
let chatHistory = JSON.parse(localStorage.getItem('quests_chat_history') || '[]');
let teamMembers = JSON.parse(localStorage.getItem('quests_team_members') || '[]');
let activePeers = {}; 

function getMyStats() {
    const xp = parseInt(localStorage.getItem('xp') || '0');
    const streak = parseInt(localStorage.getItem('streak') || '0');
    return {
        xp: xp,
        streak: streak,
        level: Math.floor(xp / 300) + 1
    };
}


// Helper to fetch simulated "Global" stats for a specific user name
function getGlobalStatsFor(name) {
    const globalLeaderboard = JSON.parse(localStorage.getItem('taskquest_leaderboard_v1') || '[]');
    // Sort by score to calculate rank
    const sorted = globalLeaderboard.sort((a, b) => b.score - a.score);
    const index = sorted.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (index !== -1) {
        const p = sorted[index];
        return { ...p, rank: index + 1, level: Math.floor(p.score / 300) + 1 };
    }
    return null;
}

// ==========================================================================
// COLLABORATIVE STATE & SESSION SECURITY CONSTANTS
// ==========================================================================

// Maximum allowed session duration: 12 hours (720 minutes).
// Any session exceeding this is capped to prevent inflated productivity scores.
const MAX_SESSION_DURATION_MINUTES = 720;
const MAX_SESSION_DURATION_MS = MAX_SESSION_DURATION_MINUTES * 60 * 1000;

// Heartbeat interval: verify active participation every 60 seconds
const SESSION_HEARTBEAT_INTERVAL_MS = 60 * 1000;

let collaborativeState = {
  friends: [],
  challenges: [],
  joinedChallenges: [],
  currentSession: null,
  sessionHistory: []
};

// Load collaborative data on init
function loadCollaborativeData() {
  try {
    const saved = window.TaskQuestStorage
      ? window.TaskQuestStorage.getCollab()
      : JSON.parse(localStorage.getItem('taskquest_v1.collab'));
    if (saved) {
      collaborativeState = { ...collaborativeState, ...saved };
      // Auto-expire any stale session that exceeded max duration on page load
      if (collaborativeState.currentSession) {
        const elapsed = Date.now() - collaborativeState.currentSession.startTime;
        if (elapsed > MAX_SESSION_DURATION_MS) {
          console.warn('Stale session detected on load — auto-expiring.');
          collaborativeState.currentSession = null;
          saveCollaborativeData();
        }
      }
    }
  } catch (e) {
    console.error('Failed to load collaborative data:', e);
  }
}


// 1. Initialization
document.addEventListener('DOMContentLoaded', () => {
    renderChatHistory();
    renderTeamMembers();
    announcePresence('joined');
    
    // Pulse updates every 5 seconds to keep stats fresh
    setInterval(() => announcePresence('pulse'), 5000);

    // Load current task from main storage if available
    const tasks = JSON.parse(localStorage.getItem('quests') || '[]');
    const activeTask = tasks.find(t => !t.completed);
    if (activeTask) {
        document.getElementById('myActiveTask').textContent = activeTask.text;
    }
});
// Save collaborative data
function saveCollaborativeData() {
  try {
    if (window.TaskQuestStorage) {
      window.TaskQuestStorage.setCollab(collaborativeState);
    } else {
      localStorage.setItem('taskquest_v1.collab', JSON.stringify(collaborativeState));
    }
  } catch (e) {
    console.error('Failed to save collaborative data:', e);
  }
}


// 2. Messaging Logic
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg) sendMessage(msg);
});

// Quick action pills
document.querySelectorAll('.action-pill').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.msg));
});


function sendMessage(text) {
    const messageObj = {
        id: Date.now(),
        sender: myProfile.name,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'chat'
    };

    // Send to other tabs
    studyChannel.postMessage(messageObj);
    
    // Add to local UI
    appendMessage(messageObj, true);
    
    // Save to history
    chatHistory.push(messageObj);
    localStorage.setItem('quests_chat_history', JSON.stringify(chatHistory.slice(-50)));
    
    chatInput.value = '';
    chatInput.focus();
}

// 3. Listen for Incoming Updates
studyChannel.onmessage = (event) => {
    const data = event.data;

function renderFriendsList() {
  const grid = document.getElementById('friendsListGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (collaborativeState.friends.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <i class="ri-user-add-line" style="font-size: 2.5rem; opacity: 0.3;"></i>
        <h3>No study friends yet</h3>
        <p>Add friends to study together and compete in challenges!</p>
      </div>
    `;
    return;
  }

  collaborativeState.friends.forEach(friend => {
    const card = document.createElement('div');
    card.className = 'friend-card glass';
    const statusColor = friend.status === 'online' ? '#10b981' : '#9ca3af';
    const initial = escapeHtml(friend.name.charAt(0).toUpperCase());
    card.innerHTML = `
      <div class="friend-card-header">
        <div class="friend-info">
          <div class="friend-avatar">${initial}</div>
          <div>
            <h4>${escapeHtml(friend.name)}</h4>
            <p class="friend-status"><span class="status-dot" style="background: ${statusColor};"></span> ${escapeHtml(friend.status)}</p>
          </div>
        </div>
        <button type="button" class="icon-btn delete-btn" data-action="remove-friend" data-friend-id="${friend.id}" aria-label="Remove friend"><i class="ri-close-line"></i></button>
      </div>
      <div class="friend-stats">
        <div class="stat">
          <i class="ri-trophy-line"></i>
          <span>${friend.score} pts</span>
        </div>
        <div class="stat">
          <i class="ri-checkbox-circle-fill"></i>
          <span>${friend.tasksCompleted} tasks</span>
        </div>
        <div class="stat">
          <i class="ri-timer-line"></i>
          <span>${friend.studyMinutes}m</span>
        </div>
      </div>
      <button type="button" class="view-btn primary" style="width: 100%; margin-top: 10px;" data-action="study-friend" data-friend-id="${friend.id}">
        <i class="ri-send-plane-line"></i> Study Together
      </button>
    `;
    grid.appendChild(card);
  });
}

// ==========================================================================
// COLLABORATIVE STUDY SESSION FUNCTIONS
// ==========================================================================

function startCollabSession() {
  if (collaborativeState.friends.length === 0) {
    announce('Add at least one friend first.');
    showTaskPopup('Add a friend to study together!');
    return;
  }

  const sessionModal = document.createElement('div');
  sessionModal.className = 'modal-overlay';
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.maxWidth = '400px';

  const title = document.createElement('h3');
  title.textContent = 'Start Collaborative Study Session';
  content.appendChild(title);

  const hint = document.createElement('p');
  hint.style.margin = '15px 0';
  hint.style.color = 'var(--text-light)';
  hint.textContent = 'Choose a study friend to partner with';
  content.appendChild(hint);

  const list = document.createElement('div');
  list.style.cssText = 'display: grid; gap: 10px; max-height: 300px; overflow-y: auto;';

  collaborativeState.friends.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'view-btn';
    btn.style.cssText = 'text-align: left; padding: 12px;';
    btn.innerHTML = `<i class="ri-user-fill"></i> ${escapeHtml(f.name)} <span style="float: right; font-size: 12px; opacity: 0.7;">${f.score} pts</span>`;
    btn.addEventListener('click', () => selectSessionPartner(f.id, f.name));
    list.appendChild(btn);
  });
  content.appendChild(list);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'view-btn';
  cancelBtn.style.cssText = 'width: 100%; margin-top: 15px;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => sessionModal.remove());
  content.appendChild(cancelBtn);

  sessionModal.appendChild(content);
  document.body.appendChild(sessionModal);
  sessionModal.addEventListener('click', (e) => {
    if (e.target === sessionModal) sessionModal.remove();
  });
}
    if (data.type === 'chat') {
        appendMessage(data, false);
        playNotifySound();
    } else if (data.type === 'presence' && data.tabId !== myTabId) {
        updatePeerPresence(data);
    }
};


    if (data.type === 'chat') {
        appendMessage(data, false);
        playNotifySound();
    } else if (data.type === 'presence' && data.tabId !== myTabId) {
        updatePeerPresence(data);
    }
};

function appendMessage(msg, isMe) {
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'msg-sent' : 'msg-received'}`;
    
    div.innerHTML = `
        <span class="msg-meta">${isMe ? 'You' : msg.sender} • ${msg.time}</span>
        <div class="msg-content">${escapeChatHtml(msg.text)}</div>
    `;

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderChatHistory() {
    chatHistory.forEach(msg => {
        // We don't know for sure if it was "me" in history unless we check sender name
        const isMe = msg.sender === myProfile.name;
        appendMessage(msg, isMe);
    });
}

// 4. Presence & Status System
function announcePresence(action) {
    const stats = getMyStats();
    studyChannel.postMessage({
        type: 'presence',
        tabId: myTabId,
        user: myProfile.name,
        status: statusSelect.value,
        xp: stats.xp,
        level: stats.level,
        streak: stats.streak,
        action: action,
        timestamp: Date.now()
    });
    updateLeaderboard(); 
}

statusSelect.addEventListener('change', () => {
    document.getElementById('currentUserStatus').textContent = statusSelect.options[statusSelect.selectedIndex].text;
    announcePresence('status_change');
});

function updatePeerPresence(data) {
    if (data.action === 'left') {
        delete activePeers[data.tabId];
    } else {
        activePeers[data.tabId] = data;
    }
    renderOnlineScholars();
    updateLeaderboard();
}


function renderOnlineScholars() {
    onlineList.innerHTML = '';
    const peerIds = Object.keys(activePeers);
    
    if (peerIds.length === 0) {
        onlineList.innerHTML = '<div class="empty-state-mini">No other sessions active</div>';
        return;
    }

function renderChallenges() {
  const grid = document.getElementById('challengesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (collaborativeState.challenges.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <i class="ri-trophy-line" style="font-size: 2.5rem; opacity: 0.3;"></i>
        <h3>No challenges yet</h3>
        <p>Create one to compete with your study friends!</p>
      </div>
    `;
    return;
  }

  collaborativeState.challenges.forEach(challenge => {
    const isJoined = collaborativeState.joinedChallenges.includes(challenge.id);
    const daysLeft = Math.ceil((challenge.endDate - Date.now()) / 86400000);
    const myParticipant = challenge.participants.find(p => p.id === 'me');

    const card = document.createElement('div');
    card.className = 'challenge-card glass';
    card.innerHTML = `
      <div class="challenge-header">
        <div>
          <h4>${escapeHtml(challenge.title)}</h4>
          <p class="muted">Type: <strong>${challenge.type === 'tasks' ? 'Most Tasks' : challenge.type === 'study' ? 'Most Study Time' : challenge.type === 'score' ? 'Highest Score' : 'Longest Streak'}</strong> • ${daysLeft} days left</p>
        </div>
        ${isJoined ? `<button type="button" class="view-btn danger" data-action="leave-challenge" data-challenge-id="${challenge.id}">Leave</button>` : `<button type="button" class="view-btn primary" data-action="join-challenge" data-challenge-id="${challenge.id}">Join</button>`}
      </div>
      <div class="challenge-participants">
        <h5>Leaderboard (${challenge.participants.length} participant${challenge.participants.length !== 1 ? 's' : ''})</h5>
        <div class="participants-list">
          ${challenge.participants.sort((a, b) => b.score - a.score).slice(0, 3).map((p, idx) => `
            <div class="participant-item" ${p.id === 'me' ? 'style="background: rgba(168, 85, 247, 0.1); border-left: 3px solid var(--primary);"' : ''}>
              <span class="rank">#${idx + 1}</span>
              <span class="name">${escapeHtml(p.name)}</span>
              <span class="score">${p.score}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}


    peerIds.forEach(id => {
        const peer = activePeers[id];
        if (Date.now() - peer.timestamp > 15000) { delete activePeers[id]; return; }

        const div = document.createElement('div');
        div.className = 'online-user glass';
        div.innerHTML = `
            <div class="peer-info">
                <div class="peer-main">
                    <strong>${escapeChatHtml(peer.user)}</strong>
                    <span class="peer-status-dot"></span>
                </div>
                <div class="peer-meta">Lvl ${peer.level} • ${peer.status}</div>
            </div>
            <div class="peer-streak"><i class="ri-fire-fill"></i> ${peer.streak}</div>
        `;
        onlineList.appendChild(div);
    });
}

function updateLeaderboard() {
    const board = document.getElementById('collabLeaderboard');
    if (!board) return;


    const myStats = getMyStats();
    
    // Build base list with "You" and active peers
    let contestants = [
        { name: myProfile.name + " (You)", xp: myStats.xp, level: myStats.level, streak: myStats.streak, isMe: true }
    ];

function setupCollabDelegation() {
  const friendsGrid = document.getElementById('friendsListGrid');
  if (friendsGrid && !friendsGrid.dataset.delegationBound) {
    friendsGrid.dataset.delegationBound = '1';
    friendsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !friendsGrid.contains(btn)) return;
      const friendId = Number(btn.dataset.friendId);
      const friend = collaborativeState.friends.find(f => f.id === friendId);
      if (!friend) return;
      if (btn.dataset.action === 'remove-friend') removeFriend(friendId);
      else if (btn.dataset.action === 'study-friend') inviteFriendToSession(friend.id, friend.name);
    });
  }

  const challengesGrid = document.getElementById('challengesGrid');
  if (challengesGrid && !challengesGrid.dataset.delegationBound) {
    challengesGrid.dataset.delegationBound = '1';
    challengesGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !challengesGrid.contains(btn)) return;
      const challengeId = Number(btn.dataset.challengeId);
      if (btn.dataset.action === 'join-challenge') joinChallenge(challengeId);
      else if (btn.dataset.action === 'leave-challenge') leaveChallenge(challengeId);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCollaborativeData();
  setupCollabDelegation();

  // Friend buttons
  const addFriendBtn = document.getElementById('addFriendBtn');
  const confirmAddFriendBtn = document.getElementById('confirmAddFriendBtn');
  const cancelAddFriendBtn = document.getElementById('cancelAddFriendBtn');
  const friendNameInput = document.getElementById('friendNameInput');
  const addFriendForm = document.getElementById('addFriendForm');

  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', () => {
      addFriendForm.style.display = addFriendForm.style.display === 'block' ? 'none' : 'block';
      if (addFriendForm.style.display === 'block') {
        friendNameInput.focus();
      }
    });
  }


    // Add Active Scholars (currently online tabs)
    Object.values(activePeers).forEach(p => {
        contestants.push({ name: p.user, xp: p.xp, level: p.level, streak: p.streak, isMe: false });
    });

    // Add Team Members stats even if offline (to see their progress)
    teamMembers.forEach(member => {
        const stats = getGlobalStatsFor(member.name);
        // Avoid duplicating if they are already in the "Active" list
        if (stats && !contestants.some(c => c.name.toLowerCase() === member.name.toLowerCase())) {
            contestants.push({ name: member.name, xp: stats.score, level: stats.level, streak: stats.streak, isMe: false, offline: true });
        }
    });

    // Rank by XP descending
    contestants.sort((a, b) => b.xp - a.xp);

    board.innerHTML = '';
    contestants.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = `leaderboard-item ${player.isMe ? 'highlight' : ''}`;
        const rankIcon = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `#${index + 1}`));
        
        row.innerHTML = `
            <div class="rank">${rankIcon}</div>
            <div class="player-info">
                <span class="name">${escapeChatHtml(player.name)}</span>
                <div class="stats-mini">
                    <span class="lvl">Lvl ${player.level}</span>
                    <span class="streak"><i class="ri-fire-fill"></i> ${player.streak}</span>
                </div>
            </div>
            <div class="score">${player.xp} XP</div>
        `;
        board.appendChild(row);
    });

    // Team Energy bar: collective power of everyone's streaks
    const totalEnergy = Math.min(100, contestants.reduce((acc, p) => acc + p.streak, 0) * 5);
    document.getElementById('teamEnergy').style.width = totalEnergy + '%';
}

document.getElementById('clearChat').addEventListener('click', () => {
    if (confirm('Clear chat history?')) {
        localStorage.removeItem('quests_chat_history');
        messagesContainer.innerHTML = '';
        chatHistory = [];
    }
});

function escapeChatHtml(text) {
    const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, f => m[f]);
}

function playNotifySound() { try { const a = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); a.volume = 0.2; a.play(); } catch(e){} }

// 5. Team Management Logic
addMemberBtn.addEventListener('click', () => {
    const name = memberSearchInput.value.trim();
    if (!name) return;

    // Check if already exists
    if (teamMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        alert("Member is already in your team.");
        return;
    }

    teamMembers.push({ id: Date.now(), name: name });
    saveTeamMembers();
    renderTeamMembers();
    memberSearchInput.value = '';
});

memberSearchInput.addEventListener('input', () => {
    renderTeamMembers(memberSearchInput.value.trim());
});

function saveTeamMembers() {
    localStorage.setItem('quests_team_members', JSON.stringify(teamMembers));
}

function renderTeamMembers(filter = "") {
    teamMemberList.innerHTML = '';
    const filtered = teamMembers.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()));

    document.getElementById('noMembersMsg').style.display = filtered.length ? 'none' : 'block';

    filtered.forEach(member => {
        const stats = getGlobalStatsFor(member.name);
        const div = document.createElement('div');
        div.className = 'member-item';
        
        let statsHtml = `<div class="member-no-stats">Searching records...</div>`;
        if (stats) {
            statsHtml = `
                <div class="member-stats-mini">
                    <span title="Level">Lvl ${stats.level}</span>
                    <span title="Streak"><i class="ri-fire-fill"></i> ${stats.streak}</span>
                    <span title="Global Rank">Rank #${stats.rank}</span>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="member-identity">
                <span class="member-name">${escapeChatHtml(member.name)}</span>
                ${statsHtml}
            </div>
            <i class="ri-delete-bin-line delete-member-btn" onclick="removeMember(${member.id})"></i>
        `;
        teamMemberList.appendChild(div);
    });
}

window.removeMember = (id) => {
    teamMembers = teamMembers.filter(m => m.id !== id);
    saveTeamMembers();
    renderTeamMembers(memberSearchInput.value.trim());
};

// ==========================================================================
// COLLABORATIVE STUDY SESSION MANAGEMENT (with duration cap & heartbeat)
// ==========================================================================

let _sessionHeartbeatTimer = null;
let _sessionDurationTimer = null;

/**
 * Start a collaborative study session with a chosen partner.
 * Records the start time and begins the heartbeat monitor.
 */
function selectSessionPartner(friendId, friendName) {
  // Close any open modal
  const modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();

  collaborativeState.currentSession = {
    partnerId: friendId,
    partnerName: friendName,
    startTime: Date.now(),
    lastHeartbeat: Date.now()
  };
  saveCollaborativeData();

  // Update UI
  updateCollabSessionUI();
  startSessionHeartbeat();

  showTaskPopup(`Study session started with ${escapeHtml(friendName)}!`);
}

/**
 * Alias: invite a friend to study (starts session with them).
 */
function inviteFriendToSession(friendId, friendName) {
  selectSessionPartner(friendId, friendName);
}

/**
 * End the current collaborative study session.
 * SECURITY: Caps the reported duration at MAX_SESSION_DURATION_MINUTES
 * to prevent inflated scores from stale or manipulated sessions.
 */
function endCollabSession() {
  if (!collaborativeState.currentSession) {
    showTaskPopup('No active session to end.');
    return;
  }

  const session = collaborativeState.currentSession;
  const rawDurationMs = Date.now() - session.startTime;
  const rawMinutes = Math.round(rawDurationMs / 60000);

  // ── DURATION CAP: enforce maximum logical session duration ──
  const cappedMinutes = Math.min(rawMinutes, MAX_SESSION_DURATION_MINUTES);
  const wasCapped = rawMinutes > MAX_SESSION_DURATION_MINUTES;

  if (wasCapped) {
    console.warn(
      `Session duration ${rawMinutes}m exceeded cap. ` +
      `Clamped to ${MAX_SESSION_DURATION_MINUTES}m.`
    );
  }

  // Record to session history
  const record = {
    id: Date.now(),
    partnerName: session.partnerName,
    partnerId: session.partnerId,
    startTime: session.startTime,
    endTime: Date.now(),
    durationMinutes: cappedMinutes,
    wasCapped: wasCapped
  };
  if (!collaborativeState.sessionHistory) {
    collaborativeState.sessionHistory = [];
  }
  collaborativeState.sessionHistory.push(record);

  // Update the partner's study minutes on the friends list
  const friend = collaborativeState.friends.find(f => f.id === session.partnerId);
  if (friend) {
    friend.studyMinutes = (friend.studyMinutes || 0) + cappedMinutes;
  }

  // Clear the active session
  collaborativeState.currentSession = null;
  saveCollaborativeData();

  // Stop heartbeat
  stopSessionHeartbeat();

  // Update UI
  updateCollabSessionUI();
  renderFriendsList();

  const capNotice = wasCapped
    ? ` (capped from ${rawMinutes}m)`
    : '';
  showTaskPopup(
    `Session ended! ${cappedMinutes} minutes logged${capNotice}.`
  );
}

/**
 * Update the "Study Together Now" UI panel to reflect session state.
 */
function updateCollabSessionUI() {
  const userEl = document.getElementById('collabSessionUser');
  const partnerEl = document.getElementById('collabSessionPartner');
  const durationEl = document.getElementById('collabSessionDuration');
  const startBtn = document.getElementById('startCollabSessionBtn');
  const stopBtn = document.getElementById('stopCollabSessionBtn');

  if (!collaborativeState.currentSession) {
    if (userEl) userEl.textContent = 'Not in session';
    if (partnerEl) partnerEl.textContent = '—';
    if (durationEl) durationEl.textContent = '0 min';
    if (startBtn) startBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
    return;
  }

  const session = collaborativeState.currentSession;
  const elapsed = Math.round((Date.now() - session.startTime) / 60000);
  const displayMin = Math.min(elapsed, MAX_SESSION_DURATION_MINUTES);

  if (userEl) userEl.textContent = myProfile.name || 'You';
  if (partnerEl) partnerEl.textContent = session.partnerName || '—';
  if (durationEl) durationEl.textContent = `${displayMin} min`;
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = '';
}

/**
 * Heartbeat: periodically verify the session is still valid.
 * Auto-ends sessions that exceed MAX_SESSION_DURATION_MS.
 * Also keeps lastHeartbeat fresh to prove active participation.
 */
function startSessionHeartbeat() {
  stopSessionHeartbeat(); // clear any existing timer

  _sessionHeartbeatTimer = setInterval(() => {
    if (!collaborativeState.currentSession) {
      stopSessionHeartbeat();
      return;
    }

    // Record heartbeat timestamp
    collaborativeState.currentSession.lastHeartbeat = Date.now();
    saveCollaborativeData();

    // Check if session exceeded max duration
    const elapsed = Date.now() - collaborativeState.currentSession.startTime;
    if (elapsed > MAX_SESSION_DURATION_MS) {
      console.warn('Session exceeded maximum duration — auto-ending.');
      endCollabSession();
      return;
    }

    // Refresh the duration display
    updateCollabSessionUI();
  }, SESSION_HEARTBEAT_INTERVAL_MS);

  // Also update the UI every second for a live counter
  _sessionDurationTimer = setInterval(() => {
    if (!collaborativeState.currentSession) {
      clearInterval(_sessionDurationTimer);
      _sessionDurationTimer = null;
      return;
    }
    const durationEl = document.getElementById('collabSessionDuration');
    if (durationEl) {
      const elapsed = Math.round(
        (Date.now() - collaborativeState.currentSession.startTime) / 60000
      );
      const displayMin = Math.min(elapsed, MAX_SESSION_DURATION_MINUTES);
      durationEl.textContent = `${displayMin} min`;
    }
  }, 1000);
}

function stopSessionHeartbeat() {
  if (_sessionHeartbeatTimer) {
    clearInterval(_sessionHeartbeatTimer);
    _sessionHeartbeatTimer = null;
  }
  if (_sessionDurationTimer) {
    clearInterval(_sessionDurationTimer);
    _sessionDurationTimer = null;
  }
}

// ==========================================================================
// FRIEND & CHALLENGE MANAGEMENT
// ==========================================================================

function addFriend(name) {
  if (!name || !name.trim()) return;
  name = name.trim();
  if (collaborativeState.friends.some(
    f => f.name.toLowerCase() === name.toLowerCase()
  )) {
    showTaskPopup('Friend already added!');
    return;
  }
  collaborativeState.friends.push({
    id: Date.now(),
    name: name,
    status: 'offline',
    score: 0,
    tasksCompleted: 0,
    studyMinutes: 0
  });
  saveCollaborativeData();
  renderFriendsList();
  showTaskPopup(`${escapeHtml(name)} added as a study friend!`);
}

function removeFriend(friendId) {
  collaborativeState.friends = collaborativeState.friends.filter(
    f => f.id !== friendId
  );
  saveCollaborativeData();
  renderFriendsList();
}

function createChallenge(title, type, days) {
  const challenge = {
    id: Date.now(),
    title: title,
    type: type,
    endDate: Date.now() + (days * 86400000),
    participants: [{ id: 'me', name: myProfile.name || 'You', score: 0 }]
  };
  collaborativeState.challenges.push(challenge);
  collaborativeState.joinedChallenges.push(challenge.id);
  saveCollaborativeData();
  renderChallenges();
  showTaskPopup(`Challenge "${escapeHtml(title)}" created!`);
}

function joinChallenge(challengeId) {
  const challenge = collaborativeState.challenges.find(
    c => c.id === challengeId
  );
  if (!challenge) return;
  if (!challenge.participants.find(p => p.id === 'me')) {
    challenge.participants.push({
      id: 'me', name: myProfile.name || 'You', score: 0
    });
  }
  if (!collaborativeState.joinedChallenges.includes(challengeId)) {
    collaborativeState.joinedChallenges.push(challengeId);
  }
  saveCollaborativeData();
  renderChallenges();
}

function leaveChallenge(challengeId) {
  const challenge = collaborativeState.challenges.find(
    c => c.id === challengeId
  );
  if (challenge) {
    challenge.participants = challenge.participants.filter(
      p => p.id !== 'me'
    );
  }
  collaborativeState.joinedChallenges =
    collaborativeState.joinedChallenges.filter(id => id !== challengeId);
  saveCollaborativeData();
  renderChallenges();
}

// ==========================================================================
// WIRE UP STUDY SESSION & COLLAB UI BUTTONS (index.html tab)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // -- Session buttons --
  const startBtn = document.getElementById('startCollabSessionBtn');
  const stopBtn = document.getElementById('stopCollabSessionBtn');
  const inviteBtn = document.getElementById('inviteFriendBtn');

  if (startBtn) {
    startBtn.addEventListener('click', () => startCollabSession());
  }
  if (stopBtn) {
    stopBtn.addEventListener('click', () => endCollabSession());
  }
  if (inviteBtn) {
    inviteBtn.addEventListener('click', () => startCollabSession());
  }

  // -- Friend management buttons --
  const confirmAddFriendBtn = document.getElementById('confirmAddFriendBtn');
  const cancelAddFriendBtn = document.getElementById('cancelAddFriendBtn');
  const friendNameInput = document.getElementById('friendNameInput');
  const addFriendForm = document.getElementById('addFriendForm');

  if (confirmAddFriendBtn) {
    confirmAddFriendBtn.addEventListener('click', () => {
      const name = friendNameInput ? friendNameInput.value : '';
      addFriend(name);
      if (friendNameInput) friendNameInput.value = '';
      if (addFriendForm) addFriendForm.style.display = 'none';
    });
  }
  if (cancelAddFriendBtn) {
    cancelAddFriendBtn.addEventListener('click', () => {
      if (addFriendForm) addFriendForm.style.display = 'none';
    });
  }

  // -- Challenge creation --
  const createChallengeBtn = document.getElementById('createChallengeBtn');
  const confirmCreateChallengeBtn = document.getElementById('confirmCreateChallengeBtn');
  const cancelChallengeBtn = document.getElementById('cancelChallengeBtn');
  const createChallengeForm = document.getElementById('createChallengeForm');

  if (createChallengeBtn) {
    createChallengeBtn.addEventListener('click', () => {
      if (createChallengeForm) {
        createChallengeForm.style.display =
          createChallengeForm.style.display === 'grid' ? 'none' : 'grid';
      }
    });
  }
  if (confirmCreateChallengeBtn) {
    confirmCreateChallengeBtn.addEventListener('click', () => {
      const title = (document.getElementById('challengeTitleInput') || {}).value || '';
      const type = (document.getElementById('challengeTypeSelect') || {}).value || 'tasks';
      const days = parseInt((document.getElementById('challengeDaysInput') || {}).value) || 7;
      if (!title.trim()) {
        showTaskPopup('Please enter a challenge name.');
        return;
      }
      createChallenge(title.trim(), type, days);
      if (createChallengeForm) createChallengeForm.style.display = 'none';
    });
  }
  if (cancelChallengeBtn) {
    cancelChallengeBtn.addEventListener('click', () => {
      if (createChallengeForm) createChallengeForm.style.display = 'none';
    });
  }

  // -- Leaderboard refresh --
  const refreshBtn = document.getElementById('refreshLeaderboardBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => updateLeaderboard());
  }

  // -- Render initial UI --
  renderFriendsList();
  renderChallenges();
  updateCollabSessionUI();

  // Resume heartbeat if a session was active across page reload
  if (collaborativeState.currentSession) {
    startSessionHeartbeat();
  }
});
const syncStatus = {
  isConnected: false,
  lastSyncTimestamp: Date.now(),
  updateStatus(status) {
    this.isConnected = status;
    this.lastSyncTimestamp = Date.now();
  }
};
