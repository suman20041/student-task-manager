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