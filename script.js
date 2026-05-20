// Core Elements
const taskInput = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const categorySelect = document.getElementById("categorySelect");

// Sidebar metrics elements
const totalTasks = document.getElementById("totalTasks");
const completedTasks = document.getElementById("completedTasks");
const points = document.getElementById("coins");
const streakCount = document.getElementById("streakCount");
const xpFill = document.getElementById("xpFill");
const xpText = document.getElementById("xpText");

// Filters & Navigation
const filterBtns = document.querySelectorAll(".filter-btn");
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Global states
let tasks = [];
let currentFilter = "All";

let searchQuery = "";

let currentView = "list"; // "list" or "board"

let coins = 0;
let streak = 0;
let xp = 120;
let currentStudyView = "weekly"; // "weekly" or "monthly"
let profile = { name: "Student Hero", gender: "Male", class: "Class 10" };

// Chart.js instances
let studyChartInstance = null;
let categoryChartInstance = null;
let completionTrendChartInstance = null;

// Analytics data structure
let analyticsData = {
  dailyStudyMinutes: {},       // e.g. { "2026-05-18": 45.5 }
  completedTasksPerDay: {},    // e.g. { "2026-05-18": 3 }
  categoryStats: {
    Theory: { created: 0, completed: 0 },
    Practical: { created: 0, completed: 0 },
    Assignment: { created: 0, completed: 0 },
    Revision: { created: 0, completed: 0 }
  },
  longestStreak: 0,
  currentStreak: 0,
  lastActiveDate: null,
  unlockedAchievements: [],    // e.g. ["novice", "spark"]
  unlockedMilestones: []       // e.g. ["30mins", "60mins"]
};

// Achievement specifications
const achievementSpecs = [
  { 
    id: "novice", 
    title: "Novice Scholar", 
    desc: "Complete your first quest!", 
    icon: "🎓", 
    rarity: "Common",
    reward: 20,
    check: () => getCompletedQuestsCount() >= 1,
    progress: () => {
      const completed = getCompletedQuestsCount();
      return { current: completed, target: 1, percent: Math.min(100, (completed / 1) * 100) };
    }
  },
  { 
    id: "spark", 
    title: "Productivity Spark", 
    desc: "Complete 5 quests!", 
    icon: "⚡", 
    rarity: "Rare",
    reward: 50,
    check: () => getCompletedQuestsCount() >= 5,
    progress: () => {
      const completed = getCompletedQuestsCount();
      return { current: completed, target: 5, percent: Math.min(100, (completed / 5) * 100) };
    }
  },
  { 
    id: "streak_flame", 
    title: "Streak Flame", 
    desc: "Reach a 3-day active streak!", 
    icon: "🔥", 
    rarity: "Rare",
    reward: 50,
    check: () => (analyticsData.currentStreak || 0) >= 3,
    progress: () => {
      const current = analyticsData.currentStreak || 0;
      return { current, target: 3, percent: Math.min(100, (current / 3) * 100) };
    }
  },
  { 
    id: "focus_master", 
    title: "Focus Master", 
    desc: "Accumulate 60 minutes of study!", 
    icon: "🧭", 
    rarity: "Epic",
    reward: 150,
    check: () => getCumulativeStudyMinutes() >= 60,
    progress: () => {
      const mins = Math.round(getCumulativeStudyMinutes());
      return { current: mins, target: 60, percent: Math.min(100, (mins / 60) * 100) };
    }
  },
  { 
    id: "quest_master", 
    title: "Quest Master Elite", 
    desc: "Complete 15 quests!", 
    icon: "🏆", 
    rarity: "Legendary",
    reward: 300,
    check: () => getCompletedQuestsCount() >= 15,
    progress: () => {
      const completed = getCompletedQuestsCount();
      return { current: completed, target: 15, percent: Math.min(100, (completed / 15) * 100) };
    }
  },
  { 
    id: "champion", 
    title: "Grand Champion", 
    desc: "Reach Level 5!", 
    icon: "👑", 
    rarity: "Legendary",
    reward: 500,
    check: () => getLevelNumber() >= 5,
    progress: () => {
      const lvl = getLevelNumber();
      return { current: lvl, target: 5, percent: Math.min(100, (lvl / 5) * 100) };
    }
  }
];

// Focus milestones specifications
const milestoneSpecs = [
  { id: "30mins", title: "Focus Apprentice", desc: "Studied for 30 minutes cumulative!", minutes: 30, reward: 50 },
  { id: "60mins", title: "Focus Elite", desc: "Studied for 60 minutes cumulative!", minutes: 60, reward: 100 },
  { id: "120mins", title: "Focus Overlord", desc: "Studied for 120 minutes cumulative!", minutes: 120, reward: 200 }
];

// ==========================================================================
// 1. DATA INITIALIZATION & LOCALSTORAGE MANAGEMENT
// ==========================================================================

function setTheme(themeName) {
  document.body.setAttribute("data-theme", themeName);
  localStorage.setItem("quests_theme", themeName);

  // Sunset is our custom light mode theme
  if (themeName === "sunset") {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }

  // Update visual dot selector state
  document.querySelectorAll(".theme-dot").forEach(dot => {
    const isCurrent = dot.dataset.theme === themeName;
    dot.classList.toggle("active", isCurrent);
    dot.setAttribute("aria-pressed", isCurrent ? "true" : "false");
  });

  // Re-render active charts to match new theme guidelines
  if (document.getElementById("analytics-tab").classList.contains("active")) {
    initStudyHoursChart();
    initCategoryChart();
  }
}

function loadData() {
  // Load tasks
  const savedTasks = localStorage.getItem("quests");
  if (savedTasks) {
    try {
      tasks = JSON.parse(savedTasks);
    } catch (e) {
      tasks = [];
    }
  }

  // Load gamification points
  coins = parseInt(localStorage.getItem("coins")) || 0;
  streak = parseInt(localStorage.getItem("streak")) || 0;
  xp = parseInt(localStorage.getItem("xp")) || 120;

  // Load active theme color
  const savedTheme = localStorage.getItem("quests_theme") || "cosmic";
  setTheme(savedTheme);

  // Load analytics data
  const savedAnalytics = localStorage.getItem("quests_analytics");
  if (savedAnalytics) {
    try {
      analyticsData = JSON.parse(savedAnalytics);
      if (!analyticsData.unlockedAchievements) analyticsData.unlockedAchievements = [];
      if (!analyticsData.unlockedMilestones) analyticsData.unlockedMilestones = [];
    } catch (e) {
      initializeAnalyticsData();
    }
  } else {
    initializeAnalyticsData();
  }

  // Load profile
  const savedProfile = localStorage.getItem("quests_profile");
  if (savedProfile) {
    try {
      profile = JSON.parse(savedProfile);
    } catch (e) {
      profile = { name: "Student Hero", gender: "Male", class: "Class 10" };
    }
  }
}

function saveData() {
  localStorage.setItem("quests", JSON.stringify(tasks));
  localStorage.setItem("coins", coins);
  localStorage.setItem("streak", streak);
  localStorage.setItem("xp", xp);
  localStorage.setItem("quests_analytics", JSON.stringify(analyticsData));
  localStorage.setItem("quests_profile", JSON.stringify(profile));
}

// Generate beautiful visual mock data for past 15 days if empty
function initializeAnalyticsData() {
  analyticsData = {
    dailyStudyMinutes: {},
    completedTasksPerDay: {},
    categoryStats: {
      Theory: { created: 12, completed: 8 },
      Practical: { created: 8, completed: 6 },
      Assignment: { created: 15, completed: 11 },
      Revision: { created: 10, completed: 9 }
    },
    longestStreak: 8,
    currentStreak: 4,
    lastActiveDate: getFormattedDate(new Date()),
    unlockedAchievements: ["novice"],
    unlockedMilestones: ["30mins"],
    focusHistory: [
      { timestamp: Date.now() - 3600000 * 2, duration: 25, category: "Theory", rewardXp: 100 },
      { timestamp: Date.now() - 86400000 - 3600000 * 3, duration: 25, category: "Practical", rewardXp: 100 },
      { timestamp: Date.now() - 86400000 * 2 - 3600000 * 4, duration: 25, category: "Assignment", rewardXp: 100 }
    ]
  };

  // Seed study time and task completions for the last 15 days
  const today = new Date();
  for (let i = 15; i >= 0; i--) {
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - i);
    const dateStr = getFormattedDate(pastDate);
    
    // Random study minutes between 15 and 90 mins (some days 0)
    const activeDay = Math.random() > 0.15;
    analyticsData.dailyStudyMinutes[dateStr] = activeDay ? Math.round(15 + Math.random() * 75) : 0;
    
    // Random task completions between 1 and 4
    analyticsData.completedTasksPerDay[dateStr] = activeDay ? Math.round(1 + Math.random() * 3) : 0;
  }
  
  saveData();
}

function getFormattedDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to check if theme is currently light
function isLightTheme() {
  return document.body.classList.contains("light");
}

// Safe browser notification sender
function sendNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

// Helper evaluations for achievements
function getCompletedQuestsCount() {
  return tasks.filter(t => t.completed).length;
}

function getCumulativeStudyMinutes() {
  return Object.values(analyticsData.dailyStudyMinutes).reduce((a, b) => a + b, 0);
}

function getLevelNumber() {
  return Math.floor(xp / 300) + 1;
}

// ==========================================================================
// 2. CONFETTI & OVERLAY POPUPS ENGINE
// ==========================================================================

// Pure, performant hardware-accelerated CSS particle Confetti
function triggerConfetti() {
  const container = document.getElementById("confettiContainer");
  if (!container) return;
  container.innerHTML = "";

  const colors = ["#a855f7", "#06b6d4", "#ec4899", "#3b82f6", "#f59e0b", "#10b981"];
  const particleCount = 120;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "confetti-particle";

    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100; // % viewport width
    const delay = Math.random() * 2.5; // seconds
    const duration = 2 + Math.random() * 2.5; // seconds
    const size = 6 + Math.random() * 8; // px

    particle.style.background = color;
    particle.style.left = `${left}vw`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size * 1.6}px`;
    particle.style.transform = `rotate(${Math.random() * 360}deg)`;

    container.appendChild(particle);
  }
  
  // Clear elements after animation ends
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// Trigger sliding Toast Alert when achievement is newly unlocked
function triggerAchievementToast(achievementName) {
  const toast = document.getElementById("achievementToast");
  const toastName = document.getElementById("toastAchievementName");
  if (!toast || !toastName) return;

  toastName.textContent = achievementName;
  toast.classList.add("show");
  triggerConfetti();

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// Check level ups dynamically on XP updates
function checkLevelUp(oldXp, newXp) {
  const oldLevel = Math.floor(oldXp / 300) + 1;
  const newLevel = Math.floor(newXp / 300) + 1;

  if (newLevel > oldLevel) {
    // Open Level Up Dialog
    const overlay = document.getElementById("levelUpPopupOverlay");
    const popup = document.getElementById("levelUpPopup");
    const levelText = document.getElementById("popupLevelText");

    if (overlay && popup && levelText) {
      levelText.textContent = `Level ${newLevel}`;
      overlay.classList.add("active");
      popup.classList.add("active");
      triggerConfetti();
      announce(`Level up! You reached Level ${newLevel}. Claim rewards.`);
      enableFocusTrap(popup);

      // Add rewards
      coins += 50;
      xp += 100; // Bonus XP
      saveData();
      updateGamification();
    }
  }
}

// Evaluation check of locked achievements
function checkAchievements() {
  let newlyUnlocked = false;

  achievementSpecs.forEach(ach => {
    if (!analyticsData.unlockedAchievements.includes(ach.id)) {
      if (ach.check()) {
        analyticsData.unlockedAchievements.push(ach.id);
        triggerAchievementToast(ach.title);
        newlyUnlocked = true;
      }
    }
  });

  if (newlyUnlocked) {
    saveData();
    renderAchievements();
  }
}

// Evaluation check of cumulative study milestones
function checkStudyMilestones() {
  const cumulativeMins = getCumulativeStudyMinutes();

  milestoneSpecs.forEach(mil => {
    if (!analyticsData.unlockedMilestones.includes(mil.id)) {
      if (cumulativeMins >= mil.minutes) {
        analyticsData.unlockedMilestones.push(mil.id);
        
        // Open Milestone Dialog popup
        const overlay = document.getElementById("milestonePopupOverlay");
        const popup = document.getElementById("milestonePopup");
        const title = document.getElementById("milestoneTitle");
        const desc = document.getElementById("milestoneDesc");

        if (overlay && popup && title && desc) {
          title.textContent = mil.title;
          desc.textContent = mil.desc;
          overlay.classList.add("active");
          popup.classList.add("active");
          triggerConfetti();
          announce(`Milestone unlocked: ${mil.title}. ${mil.desc}`);
          enableFocusTrap(popup);

          // Add milestone reward
          coins += mil.reward;
          saveData();
          updateGamification();
        }
      }
    }
  });
}

// Accessibility Helpers: Screen Reader Announcements and Focus Traps
let activeFocusTrap = null;
let focusReturnEl = null;

function announce(message) {
  const container = document.getElementById("srAnnouncement");
  if (container) {
    container.textContent = "";
    // Trigger small delay to force some screen readers to announce updates
    setTimeout(() => {
      container.textContent = message;
    }, 50);
  }
}

function enableFocusTrap(modalEl) {
  focusReturnEl = document.activeElement;
  activeFocusTrap = modalEl;
  
  setTimeout(() => {
    const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  }, 150);
}

function disableFocusTrap() {
  activeFocusTrap = null;
  if (focusReturnEl && typeof focusReturnEl.focus === "function") {
    focusReturnEl.focus();
    focusReturnEl = null;
  }
}

function handleFocusTrapKey(e) {
  if (!activeFocusTrap) return;
  if (e.key === 'Tab') {
    const focusables = Array.from(activeFocusTrap.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }
}

document.addEventListener("keydown", handleFocusTrapKey);

// Dismiss popup buttons click listeners
document.getElementById("claimLevelBtn")?.addEventListener("click", (e) => {
  triggerCoinExplosion(e);
  document.getElementById("levelUpPopupOverlay").classList.remove("active");
  document.getElementById("levelUpPopup").classList.remove("active");
  disableFocusTrap();
});

document.getElementById("claimMilestoneBtn")?.addEventListener("click", (e) => {
  triggerCoinExplosion(e);
  document.getElementById("milestonePopupOverlay").classList.remove("active");
  document.getElementById("milestonePopup").classList.remove("active");
  disableFocusTrap();
});

// ==========================================================================
// 3. CORE TASK / QUESTS CONTROLLERS
// ==========================================================================

function addTask() {
  const text = taskInput.value.trim();
  const category = categorySelect.value;



  const prioritySelect = document.getElementById("prioritySelect");
  const priority = prioritySelect ? prioritySelect.value : "Medium";

  const deadlineInput = document.getElementById("deadlineInput");
  const deadline = deadlineInput ? deadlineInput.value : "";

  if (text === "") {
    taskInput.classList.add("input-invalid");
    taskInput.setAttribute("aria-invalid", "true");
    announce("Failed to add task. Please enter a task description.");
    setTimeout(() => {
      taskInput.classList.remove("input-invalid");
    }, 400);
    return;
  }
  taskInput.setAttribute("aria-invalid", "false");


  const task = {
    id: Date.now(),
    text,
    category,
    priority,
    completed: false,
    createdAt: getFormattedDate(new Date()),
    deadline: deadline || null
  };

  tasks.push(task);
  taskInput.value = "";
  deadlineInput.value = "";

  // Update analytics created count
  if (!analyticsData.categoryStats[category]) {
    analyticsData.categoryStats[category] = { created: 0, completed: 0 };
  }
  analyticsData.categoryStats[category].created += 1;

  saveData();
  renderTasks();

  updateDeadlineAlerts();


  // Notify user to complete the new task ASAP
  sendNotification("Quest Assigned", `COMPLETE ${text} TASK ASAP`);

  // Show UI popup notification
  showTaskPopup(`COMPLETE ${text.toUpperCase()} TASK ASAP`);


  announce(`Task added: "${text}". Category: ${category}, Priority: ${priority}.`);

}

function createTaskEl(task) {
  const div = document.createElement("div");
  div.classList.add("task");
  div.setAttribute("draggable", "true");
  div.setAttribute("data-id", task.id);
  if (task.completed) {
    div.classList.add("completed");
  }
  if (searchQuery) {
    filteredTasks = filteredTasks.filter(task => task.text.toLowerCase().includes(searchQuery));
  }

  const pri = task.priority || "Medium";
  const catEmoji = getCategoryEmoji(task.category);

  div.innerHTML = `
    <div class="drag-handle" title="Drag to reorder"><i class="ri-drag-move-fill"></i></div>
    <div class="task-left">
      <div class="check-btn" tabindex="0" aria-label="Toggle completed task"></div>
      <div>
        <h3 class="task-title">${escapeHtml(task.text)}</h3>
        <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
          <p class="task-category" style="margin: 0;">${catEmoji} ${task.category}</p>
          <span class="priority-pill priority-${pri.toLowerCase()}">${pri}</span>
        </div>
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn edit-btn" aria-label="Edit Quest">
        <i class="ri-edit-line"></i>
      </button>
      <button class="icon-btn delete-btn" aria-label="Delete Quest">
        <i class="ri-delete-bin-6-line"></i>
      </button>
    </div>
  `;

  // Toggle Complete event
  const checkBtn = div.querySelector(".check-btn");
  checkBtn.setAttribute("role", "checkbox");
  checkBtn.setAttribute("aria-checked", task.completed ? "true" : "false");

  const handleToggle = () => {
    const oldXp = xp;
    task.completed = !task.completed;
    checkBtn.setAttribute("aria-checked", task.completed ? "true" : "false");
    const todayStr = getFormattedDate(new Date());

    if (task.completed) {
      coins += 10;
      streak += 1;
      xp += 20;

      analyticsData.completedTasksPerDay[todayStr] = (analyticsData.completedTasksPerDay[todayStr] || 0) + 1;
      analyticsData.categoryStats[task.category].completed = (analyticsData.categoryStats[task.category].completed || 0) + 1;
      updateAnalyticsStreak(todayStr);
    } else {
      coins = Math.max(0, coins - 10);
      streak = Math.max(0, streak - 1);
      xp = Math.max(0, xp - 20);

      if (analyticsData.completedTasksPerDay[todayStr]) {
        analyticsData.completedTasksPerDay[todayStr] = Math.max(0, analyticsData.completedTasksPerDay[todayStr] - 1);
      }
      analyticsData.categoryStats[task.category].completed = Math.max(0, analyticsData.categoryStats[task.category].completed - 1);
    }

    saveData();
    updateGamification();
    renderTasks();
    announce(`Task marked ${task.completed ? "completed" : "incomplete"}: "${task.text}"`);
    
    checkLevelUp(oldXp, xp);
    checkAchievements();
    renderWeeklyStreak();
  };

  checkBtn.addEventListener("click", handleToggle);
  checkBtn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  });

  // Delete task event
  div.querySelector(".delete-btn").addEventListener("click", () => {
    tasks = tasks.filter(t => t.id !== task.id);
    saveData();
    renderTasks();
    announce(`Task deleted: "${task.text}"`);
  });

  // Edit task event
  div.querySelector(".edit-btn").addEventListener("click", () => {
    const updated = prompt("Edit your quest", task.text);
    if (updated !== null && updated.trim() !== "") {
      task.text = updated;
      saveData();
      renderTasks();
      announce(`Task edited to: "${updated}"`);
    }
  });

  // HTML5 Drag Listeners on the card
  div.addEventListener("dragstart", (e) => {
    div.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  });

  div.addEventListener("dragend", () => {
    div.classList.remove("dragging");
    saveTaskOrder();
  });

  // Mobile Touch Drag Listeners
  setupTouchDrag(div, task);

  return div;
}

let touchDraggedEl = null;
let touchStartOffset = { x: 0, y: 0 };

function setupTouchDrag(el, task) {
  const handle = el.querySelector(".drag-handle");
  if (!handle) return;

  handle.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    touchDraggedEl = el;
    
    const rect = el.getBoundingClientRect();
    touchStartOffset.x = touch.clientX - rect.left;
    touchStartOffset.y = touch.clientY - rect.top;

    el.classList.add("touch-dragging-active");
    el.style.width = `${rect.width}px`;
    el.style.left = `${touch.clientX - touchStartOffset.x}px`;
    el.style.top = `${touch.clientY - touchStartOffset.y}px`;
    
    el.classList.add("dragging");
    e.stopPropagation();
  }, { passive: false });

  handle.addEventListener("touchmove", (e) => {
    if (!touchDraggedEl || touchDraggedEl !== el) return;
    e.preventDefault();

    const touch = e.touches[0];
    el.style.left = `${touch.clientX - touchStartOffset.x}px`;
    el.style.top = `${touch.clientY - touchStartOffset.y}px`;

    el.style.visibility = "hidden";
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    el.style.visibility = "visible";

    if (!elementUnderTouch) return;

    const targetBody = elementUnderTouch.closest(".board-column-body");
    if (targetBody && currentView === "board") {
      if (targetBody.children.length === 0) {
        targetBody.appendChild(el);
      }
    }

    const targetTask = elementUnderTouch.closest(".task");
    if (targetTask && targetTask !== el) {
      const targetRect = targetTask.getBoundingClientRect();
      const relativeY = touch.clientY - targetRect.top;
      
      const parent = targetTask.parentNode;
      if (parent) {
        if (relativeY < targetRect.height / 2) {
          parent.insertBefore(el, targetTask);
        } else {
          parent.insertBefore(el, targetTask.nextSibling);
        }
      }
    }
  }, { passive: false });

  handle.addEventListener("touchend", (e) => {
    if (!touchDraggedEl || touchDraggedEl !== el) return;
    
    el.classList.remove("touch-dragging-active");
    el.classList.remove("dragging");
    el.style.width = "";
    el.style.left = "";
    el.style.top = "";
    
    touchDraggedEl = null;
    saveTaskOrder();
  });
}

function saveTaskOrder() {
  const newTasksOrder = [];

  if (currentView === "list") {
    const taskElements = document.querySelectorAll("#taskList .task");
    taskElements.forEach(el => {
      const id = parseInt(el.getAttribute("data-id"));
      const originalTask = tasks.find(t => t.id === id);
      if (originalTask) {
        newTasksOrder.push(originalTask);
      }
    });
  } else {
    const columns = document.querySelectorAll(".board-column-body");
    columns.forEach(col => {
      const category = col.getAttribute("data-category");
      const taskElements = col.querySelectorAll(".task");
      
      taskElements.forEach(el => {
        const id = parseInt(el.getAttribute("data-id"));
        const originalTask = tasks.find(t => t.id === id);
        if (originalTask) {
          originalTask.category = category;
          newTasksOrder.push(originalTask);
        }
      });
    });
  }

  if (currentView === "list" && currentFilter !== "All") {
    const renderedIds = newTasksOrder.map(t => t.id);
    const unrenderedTasks = tasks.filter(t => !renderedIds.includes(t.id));
    tasks = [...newTasksOrder, ...unrenderedTasks];
  } else {
    tasks = newTasksOrder;
  }

  saveData();
  renderTasks();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".task:not(.dragging)")];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function setupColumnDragOver(body) {
  body.addEventListener("dragover", (e) => {
    e.preventDefault();
    body.classList.add("drag-over");
    
    const draggingEl = document.querySelector(".dragging");
    if (!draggingEl) return;

    const afterElement = getDragAfterElement(body, e.clientY);
    if (afterElement == null) {
      body.appendChild(draggingEl);
    } else {
      body.insertBefore(draggingEl, afterElement);
    }
  });

  body.addEventListener("dragleave", () => {
    body.classList.remove("drag-over");
  });

  body.addEventListener("drop", () => {
    body.classList.remove("drag-over");
    saveTaskOrder();
  });
}



function renderTasks() {
  const taskList = document.getElementById("taskList");
  const boardColumns = document.getElementById("boardColumns");
  const filtersDiv = document.querySelector(".filters");

  if (currentView === "list") {
    taskList.style.display = "flex";
    boardColumns.style.display = "none";
    if (filtersDiv) filtersDiv.style.display = "flex";

    taskList.innerHTML = "";
    
    let filteredTasks = tasks;
    if (currentFilter !== "All") {
      filteredTasks = tasks.filter(task => task.category === currentFilter);
    }

    if (filteredTasks.length === 0) {
      taskList.innerHTML = `
        <div class="empty-state">
          <i class="ri-ghost-2-line"></i>
          <h3>No Quests Yet</h3>
          <p>Add tasks and begin your productivity journey ✨</p>
        </div>
      `;
      updateStats();
      return;
    }

    filteredTasks.forEach(task => {
      taskList.appendChild(createTaskEl(task));
    });

  } else {
    taskList.style.display = "none";
    boardColumns.style.display = "grid";
    if (filtersDiv) filtersDiv.style.display = "none";

    boardColumns.innerHTML = "";

    const categories = ["Theory", "Practical", "Assignment", "Revision"];
    
    categories.forEach(cat => {
      const colDiv = document.createElement("div");
      colDiv.className = "board-column";
      colDiv.setAttribute("data-category", cat);

      const colTasks = tasks.filter(t => t.category === cat);
      const catEmoji = getCategoryEmoji(cat);

      colDiv.innerHTML = `
        <div class="board-column-header">
          <div class="column-title">${catEmoji} ${cat}</div>
          <div class="column-count">${colTasks.length}</div>
        </div>
        <div class="board-column-body" data-category="${cat}"></div>
      `;

      const bodyDiv = colDiv.querySelector(".board-column-body");
      colTasks.forEach(task => {
        bodyDiv.appendChild(createTaskEl(task));
      });

      setupColumnDragOver(bodyDiv);
      boardColumns.appendChild(colDiv);
    });
  }

  updateStats();
}

function updateStats() {
  const totalTasks = document.getElementById("totalTasks");
  const completedTasks = document.getElementById("completedTasks");
  if (totalTasks) totalTasks.textContent = tasks.length;
  if (completedTasks) completedTasks.textContent = tasks.filter(task => task.completed).length;
}

function updateGamification() {
  points.textContent = coins;
  totalTasks.textContent = tasks.length;
  completedTasks.textContent = getCompletedQuestsCount();
  streakCount.textContent = streak;

  // Level progression bar update
  const level = getLevelNumber();
  const currentLevelXp = xp % 300;
  
  const xpLevelEl = document.getElementById("xpLevel");
  if (xpLevelEl) {
    xpLevelEl.textContent = `Level ${level}`;
  }
  
  xpText.textContent = `${currentLevelXp} / 300 XP`;
  
  const fillPercentage = Math.min(100, (currentLevelXp / 3));
  xpFill.style.width = `${fillPercentage}%`;

  // Trigger XP fill pulse animation
  xpFill.classList.remove("pulse");
  void xpFill.offsetWidth; // Trigger DOM reflow to restart animation
  xpFill.classList.add("pulse");
}

function updateAnalyticsStreak(todayStr) {
  if (analyticsData.lastActiveDate === todayStr) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getFormattedDate(yesterday);

  if (analyticsData.lastActiveDate === yesterdayStr) {
    analyticsData.currentStreak += 1;
  } else {
    analyticsData.currentStreak = 1;
  }

  if (analyticsData.currentStreak > analyticsData.longestStreak) {
    analyticsData.longestStreak = analyticsData.currentStreak;
  }

  analyticsData.lastActiveDate = todayStr;
}

// Helpers
function getCategoryEmoji(cat) {
  switch (cat) {
    case "Theory": return "📘";
    case "Practical": return "🧪";
    case "Assignment": return "📝";
    case "Revision": return "📖";
    default: return "✨";
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// ==========================================================================
// 4. POMODORO TIMER & STUDY HOUR LOGGER
// ==========================================================================

let studyTime = 25 * 60;
let breakTime = 5 * 60;
let currentTime = studyTime;
let timer = null;
let isStudy = true;
let lastTimerTickTimestamp = null;

function updateDisplay() {
  const minutes = Math.floor(currentTime / 60);
  const seconds = currentTime % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
  
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.innerText = timeStr;
  
  const timerDisplayEl = document.getElementById("timerDisplay");
  if (timerDisplayEl) timerDisplayEl.innerText = timeStr;
}

function startTimer() {
  if (timer) return;
  
  lastTimerTickTimestamp = Date.now();
  
  timer = setInterval(() => {
    const now = Date.now();
    const elapsedSeconds = Math.round((now - lastTimerTickTimestamp) / 1000);
    
    if (elapsedSeconds <= 0) return; // Prevent double trigger
    
    lastTimerTickTimestamp = now;
    currentTime = Math.max(0, currentTime - elapsedSeconds);
    
    // Accumulate study minutes
    if (isStudy) {
      const todayStr = getFormattedDate(new Date());
      const fractionalMinutes = elapsedSeconds / 60;
      analyticsData.dailyStudyMinutes[todayStr] = (analyticsData.dailyStudyMinutes[todayStr] || 0) + fractionalMinutes;
      saveData();
    }

    updateDisplay();

    if (currentTime <= 0) {
      clearInterval(timer);
      timer = null;

      if (isStudy) {
        sendNotification("Session Complete!", "Study session complete! Take a well-deserved break ☕");
        alert("Study session complete! Take a break.");

        // Log session in focus history
        if (!analyticsData.focusHistory) analyticsData.focusHistory = [];
        analyticsData.focusHistory.push({
          timestamp: Date.now(),
          duration: Math.round(studyTime / 60),
          category: currentFilter === "All" ? "Theory" : currentFilter,
          rewardXp: 100
        });
        if (analyticsData.focusHistory.length > 10) {
          analyticsData.focusHistory.shift();
        }

        isStudy = false;
        currentTime = breakTime;
        
        const modeEl = document.getElementById("mode");
        if (modeEl) {
          modeEl.innerText = "Break Time";
          modeEl.style.color = "#22c55e";
        }
        const modeTextEl = document.getElementById("modeText");
        if (modeTextEl) {
          modeTextEl.innerText = "Break Time";
          modeTextEl.style.color = "#22c55e";
        }

        // Evaluate milestone popups
        checkStudyMilestones();
        checkAchievements();
      } else {
        sendNotification("Break Over!", "Break over! Time to focus back on your tasks ⚔️");
        alert("Break over! Back to study.");

        isStudy = true;
        currentTime = studyTime;
        
        const modeEl = document.getElementById("mode");
        if (modeEl) {
          modeEl.innerText = "Study Time";
          modeEl.style.color = "var(--text)";
        }
        const modeTextEl = document.getElementById("modeText");
        if (modeTextEl) {
          modeTextEl.innerText = "Study Time";
          modeTextEl.style.color = "var(--primary)";
        }
      }

      updateDisplay();
      startTimer();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timer);
  timer = null;
}

function resetTimer() {
  clearInterval(timer);
  timer = null;
  isStudy = true;
  currentTime = studyTime;
  
  const modeEl = document.getElementById("mode");
  if (modeEl) {
    modeEl.innerText = "Study Time";
    modeEl.style.color = "var(--text)";
  }
  const modeTextEl = document.getElementById("modeText");
  if (modeTextEl) {
    modeTextEl.innerText = "Study Time";
    modeTextEl.style.color = "var(--primary)";
  }
  updateDisplay();
}

// Attach event listeners to Pomodoro buttons
document.getElementById("startTimer")?.addEventListener("click", startTimer);
document.getElementById("pauseTimer")?.addEventListener("click", pauseTimer);
document.getElementById("resetTimer")?.addEventListener("click", resetTimer);

// ==========================================================================
// 5. TAB & NAVIGATION ROUTERS
// ==========================================================================

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    // Use live query each time to avoid stale NodeList issues
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const activeTabId = `${btn.dataset.tab}-tab`;
    const tabEl = document.getElementById(activeTabId);
    if (tabEl) tabEl.classList.add("active");

    // Sync active state in mobile bottom navigation dock
    document.querySelectorAll(".dock-btn").forEach(db => {
      const isCurrent = db.dataset.tab === btn.dataset.tab;
      db.classList.toggle("active", isCurrent);
      db.setAttribute("aria-selected", isCurrent ? "true" : "false");
    });

    // Refresh charts and heatmap on tab load
    if (btn.dataset.tab === "analytics") {
      updateAnalyticsDashboard();
    }

    // Re-render assignments on tab activation
    if (btn.dataset.tab === "assignments") {
      const asgnList = document.getElementById("asgnList");
      if (asgnList) {
        // Dispatch a custom event that the assignment tracker IIFE listens to
        document.dispatchEvent(new CustomEvent("asgnTabActive"));
      }
    }
  });
});

// Mobile Bottom dock click routers
document.querySelectorAll(".dock-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.dataset.tab;
    // Try clicking the matching top tab button
    const topBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (topBtn) {
      topBtn.click();
    } else {
      // Fallback: manually switch if top tab hidden
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      const tabEl = document.getElementById(`${targetTab}-tab`);
      if (tabEl) tabEl.classList.add("active");
      document.querySelectorAll(".dock-btn").forEach(db => {
        const isCurrent = db.dataset.tab === targetTab;
        db.classList.toggle("active", isCurrent);
        db.setAttribute("aria-selected", isCurrent ? "true" : "false");
      });
    }
  });
});

// ==========================================================================
// 6. DYNAMIC ACHIEVEMENTS BADGES COMPILER
// ==========================================================================

function renderAchievements() {
  const container = document.getElementById("badgesGrid");
  if (!container) return;
  container.innerHTML = "";

  achievementSpecs.forEach(ach => {
    const isUnlocked = analyticsData.unlockedAchievements.includes(ach.id);
    const prog = ach.progress();

    const badgeDiv = document.createElement("div");
    badgeDiv.classList.add("badge");
    badgeDiv.classList.add(isUnlocked ? "unlocked" : "locked");
    badgeDiv.classList.add(`rarity-${ach.rarity.toLowerCase()}`);
    badgeDiv.setAttribute("tabindex", "0");
    badgeDiv.setAttribute("role", "button");

    badgeDiv.textContent = ach.icon;

    // Set custom tooltip showing progress
    const tooltipText = isUnlocked 
      ? `Unlocked: ${ach.title} (${ach.desc}) - ${ach.rarity}`
      : `Locked: ${ach.desc} (${Math.round(prog.percent)}% complete)`;
    badgeDiv.setAttribute("data-tooltip", tooltipText);
    badgeDiv.setAttribute("aria-label", tooltipText);

    // Click to open details modal
    badgeDiv.addEventListener("click", () => {
      openAchievementModal(ach);
    });
    
    badgeDiv.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAchievementModal(ach);
      }
    });

    container.appendChild(badgeDiv);
  });
}

function openAchievementModal(ach) {
  const overlay = document.getElementById("achievementModalOverlay");
  const modal = document.getElementById("achievementModal");
  if (!overlay || !modal) return;

  const isUnlocked = analyticsData.unlockedAchievements.includes(ach.id);
  const prog = ach.progress();

  // Populate data
  document.getElementById("modalBadgeIcon").textContent = ach.icon;
  
  const rarityEl = document.getElementById("modalRarityLabel");
  rarityEl.textContent = ach.rarity;
  rarityEl.className = `modal-rarity-pill rarity-${ach.rarity.toLowerCase()}`;
  
  // Set glow color based on rarity
  const glowEl = document.getElementById("modalGlow");
  let glowColor = "rgba(139, 92, 246, 0.4)";
  if (ach.rarity === "Common") glowColor = "rgba(148, 163, 184, 0.3)";
  else if (ach.rarity === "Rare") glowColor = "rgba(6, 182, 212, 0.4)";
  else if (ach.rarity === "Epic") glowColor = "rgba(236, 72, 153, 0.4)";
  else if (ach.rarity === "Legendary") glowColor = "rgba(245, 158, 11, 0.5)";
  glowEl.style.background = `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)`;

  document.getElementById("modalBadgeTitle").textContent = ach.title;
  document.getElementById("modalBadgeDesc").textContent = ach.desc;
  document.getElementById("modalProgressText").textContent = `${prog.current} / ${prog.target}`;
  document.getElementById("modalProgressFill").style.width = `${prog.percent}%`;
  document.getElementById("modalRewardText").textContent = `+${ach.reward} Coins Reward`;
  
  const statusEl = document.getElementById("modalStatusText");
  if (isUnlocked) {
    statusEl.innerHTML = `<span class="unlocked-status"><i class="ri-checkbox-circle-fill"></i> Unlocked</span>`;
  } else {
    statusEl.innerHTML = `<span class="locked-status"><i class="ri-lock-2-line"></i> Locked (${Math.round(prog.percent)}% complete)</span>`;
  }

  overlay.classList.add("active");
  modal.classList.add("active");
  announce(`Achievement details modal: ${ach.title}. Description: ${ach.desc}. Status: ${isUnlocked ? 'Unlocked' : 'Locked'}.`);
  enableFocusTrap(modal);
}

function closeAchievementModal() {
  const overlay = document.getElementById("achievementModalOverlay");
  const modal = document.getElementById("achievementModal");
  if (overlay) overlay.classList.remove("active");
  if (modal) modal.classList.remove("active");
  disableFocusTrap();
}

// Attach Achievement Modal Close Event Listeners
document.getElementById("closeAchievementModalBtn")?.addEventListener("click", closeAchievementModal);
document.getElementById("achievementModalOverlay")?.addEventListener("click", closeAchievementModal);

function triggerCoinExplosion(event) {
  const target = document.getElementById("coins");
  if (!target) return;

  const targetRect = target.getBoundingClientRect();
  
  // Get button location or center of screen if event is not passed
  let startX = window.innerWidth / 2;
  let startY = window.innerHeight / 2;
  if (event && event.clientX) {
    startX = event.clientX;
    startY = event.clientY;
  }

  const coinCount = 15;
  for (let i = 0; i < coinCount; i++) {
    const coin = document.createElement("div");
    coin.className = "flying-coin";
    coin.innerHTML = '<i class="ri-coin-fill"></i>';
    coin.style.left = `${startX}px`;
    coin.style.top = `${startY}px`;
    
    // Random direction and delay
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    const midX = startX + Math.cos(angle) * distance;
    const midY = startY + Math.sin(angle) * distance;

    coin.style.setProperty("--mid-x", `${midX - startX}px`);
    coin.style.setProperty("--mid-y", `${midY - startY}px`);
    coin.style.setProperty("--dest-x", `${targetRect.left + (targetRect.width / 2) - startX}px`);
    coin.style.setProperty("--dest-y", `${targetRect.top + (targetRect.height / 2) - startY}px`);
    
    const delay = Math.random() * 0.2;
    coin.style.animationDelay = `${delay}s`;

    document.body.appendChild(coin);

    // Clean up
    setTimeout(() => {
      coin.remove();
    }, 1200 + delay * 1000);
  }
}

// ==========================================================================
// 7. WEEKLY STREAK TRACKER COMPILER
// ==========================================================================

function renderWeeklyStreak() {
  const container = document.getElementById("streakDaysGrid");
  if (!container) return;
  container.innerHTML = "";

  const dayNames = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date();
  
  // Find Mon date of the current week
  const currentDayOfWeek = today.getDay(); // 0 is Sun, 1-6 Mon-Sat
  const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  
  const monday = new Date();
  monday.setDate(today.getDate() + diffToMonday);

  for (let i = 0; i < 7; i++) {
    const loopDay = new Date(monday.getTime());
    loopDay.setDate(monday.getDate() + i);
    const dateStr = getFormattedDate(loopDay);

    // Is active if completed a task or studied
    const hasStudyMins = (analyticsData.dailyStudyMinutes[dateStr] || 0) > 0;
    const hasCompletions = (analyticsData.completedTasksPerDay[dateStr] || 0) > 0;
    const isActive = hasStudyMins || hasCompletions;

    const cell = document.createElement("div");
    cell.className = "streak-day-cell";
    if (isActive) {
      cell.classList.add("active");
    }

    cell.innerHTML = `
      <span>${dayNames[i]}</span>
      <div class="day-indicator">
        ${isActive ? '<i class="ri-fire-fill"></i>' : '<i class="ri-checkbox-blank-circle-line"></i>'}
      </div>
    `;

    container.appendChild(cell);
  }
}

// ==========================================================================
// 8. CHART.JS ANALYTICS GENERATOR
// ==========================================================================

function updateAnalyticsDashboard() {
  // 1. Update stats cards
  const totalStudyMinutes = Object.values(analyticsData.dailyStudyMinutes).reduce((a, b) => a + b, 0);
  const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);
  const totalHoursEl = document.getElementById("analyticsTotalHours");
  if (totalHoursEl) totalHoursEl.textContent = `${totalStudyHours}h`;

  const totalCompletedQuests = Object.values(analyticsData.completedTasksPerDay).reduce((a, b) => a + b, 0);
  const completedQuestsEl = document.getElementById("analyticsCompletedQuests");
  if (completedQuestsEl) completedQuestsEl.textContent = totalCompletedQuests;

  const streakEl = document.getElementById("analyticsStreak");
  if (streakEl) streakEl.textContent = `${analyticsData.currentStreak} days`;

  const totalCreated = Object.values(analyticsData.categoryStats).reduce((acc, obj) => acc + (obj.created || 0), 0);
  const totalCompleted = Object.values(analyticsData.categoryStats).reduce((acc, obj) => acc + (obj.completed || 0), 0);
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;
  const rateEl = document.getElementById("analyticsCompletionRate");
  if (rateEl) rateEl.textContent = `${completionRate}%`;

  // 2. Initialize or Update Chart.js instances
  initStudyHoursChart();
  initCategoryChart();
  initCompletionTrendChart();

  // 3. Render Heatmap and mastery stats
  renderHeatmap();
  renderQuestMastery();
  
  // 4. Render Highlights & History
  renderFocusHistory();
  
  const mostProductiveDayEl = document.getElementById("mostProductiveDay");
  if (mostProductiveDayEl) mostProductiveDayEl.textContent = calculateMostProductiveDay();
  
  const peakFocusHourEl = document.getElementById("peakFocusHour");
  if (peakFocusHourEl) peakFocusHourEl.textContent = getPeakFocusHour();
  
  const longestFocusStreakEl = document.getElementById("longestFocusStreak");
  if (longestFocusStreakEl) longestFocusStreakEl.textContent = `${analyticsData.longestStreak || 8} days`;
}

function initStudyHoursChart() {
  const chartCanvas = document.getElementById("studyHoursChart");
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext("2d");
  const dates = [];
  const studyValues = [];
  const today = new Date();

  // Handle Weekly vs Monthly labels
  const daysToView = currentStudyView === "weekly" ? 7 : 30;
  for (let i = daysToView - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = getFormattedDate(date);
    dates.push(date.toLocaleDateString(undefined, { weekday: daysToView === 7 ? 'short' : undefined, month: 'short', day: 'numeric' }));
    studyValues.push((analyticsData.dailyStudyMinutes[dateStr] || 0).toFixed(1));
  }

  // Get active CSS variables for chart colors
  const textClr = isLightTheme() ? "#4b5563" : "#94a3b8";
  const gridClr = isLightTheme() ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.05)";
  const primaryClr = getComputedStyle(document.body).getPropertyValue('--primary').trim() || "#7c3aed";
  const secondaryClr = getComputedStyle(document.body).getPropertyValue('--secondary').trim() || "#06b6d4";

  if (studyChartInstance) {
    studyChartInstance.destroy();
  }

  // Generate linear gradients for the chart
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, primaryClr);
  gradient.addColorStop(1, secondaryClr);

  studyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Minutes Studied',
        data: studyValues,
        backgroundColor: gradient,
        borderRadius: 8,
        hoverBackgroundColor: primaryClr
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textClr, font: { family: 'Poppins' } }
        },
        y: {
          grid: { color: gridClr },
          ticks: { color: textClr, font: { family: 'Poppins' } }
        }
      }
    }
  });
}

function initCategoryChart() {
  const chartCanvas = document.getElementById("categoryChart");
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext("2d");
  
  const labels = ["Theory 📘", "Practical 🧪", "Assignment 📝", "Revision 📖"];
  const completedData = [
    analyticsData.categoryStats.Theory?.completed || 0,
    analyticsData.categoryStats.Practical?.completed || 0,
    analyticsData.categoryStats.Assignment?.completed || 0,
    analyticsData.categoryStats.Revision?.completed || 0
  ];

  const textClr = isLightTheme() ? "#4b5563" : "#e2e8f0";

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  // Fallback visual data if no completed category items yet
  const displayData = completedData.some(v => v > 0) ? completedData : [1, 1, 1, 1];

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: displayData,
        backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"],
        borderWidth: 0,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textClr, font: { family: 'Poppins', size: 12 }, padding: 15 }
        }
      },
      cutout: '70%'
    }
  });
}

// Chart toggle click listeners
document.getElementById("btnWeeklyStudy")?.addEventListener("click", () => {
  const weekly = document.getElementById("btnWeeklyStudy");
  const monthly = document.getElementById("btnMonthlyStudy");
  weekly.classList.add("active");
  weekly.setAttribute("aria-pressed", "true");
  monthly.classList.remove("active");
  monthly.setAttribute("aria-pressed", "false");
  currentStudyView = "weekly";
  initStudyHoursChart();
});

document.getElementById("btnMonthlyStudy")?.addEventListener("click", () => {
  const weekly = document.getElementById("btnWeeklyStudy");
  const monthly = document.getElementById("btnMonthlyStudy");
  monthly.classList.add("active");
  monthly.setAttribute("aria-pressed", "true");
  weekly.classList.remove("active");
  weekly.setAttribute("aria-pressed", "false");
  currentStudyView = "monthly";
  initStudyHoursChart();
});

let completionTrendView = "weekly"; // "weekly" or "monthly"

function initCompletionTrendChart() {
  const chartCanvas = document.getElementById("completionTrendChart");
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext("2d");
  const dates = [];
  const completionValues = [];
  const today = new Date();

  // Handle Weekly vs Monthly labels
  const daysToView = completionTrendView === "weekly" ? 7 : 30;
  for (let i = daysToView - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = getFormattedDate(date);
    dates.push(date.toLocaleDateString(undefined, { weekday: daysToView === 7 ? 'short' : undefined, month: 'short', day: 'numeric' }));
    completionValues.push(analyticsData.completedTasksPerDay[dateStr] || 0);
  }

  const textClr = isLightTheme() ? "#4b5563" : "#94a3b8";
  const gridClr = isLightTheme() ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.05)";
  const primaryClr = getComputedStyle(document.body).getPropertyValue('--primary').trim() || "#7c3aed";
  const secondaryClr = getComputedStyle(document.body).getPropertyValue('--secondary').trim() || "#06b6d4";

  if (completionTrendChartInstance) {
    completionTrendChartInstance.destroy();
  }

  // Generate linear gradient for the line fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, "rgba(6, 182, 212, 0.25)");
  gradient.addColorStop(1, "rgba(124, 58, 237, 0.0)");

  completionTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Quests Completed',
        data: completionValues,
        borderColor: secondaryClr,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: primaryClr,
        pointBorderColor: "#fff",
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textClr, font: { family: 'Poppins' } }
        },
        y: {
          grid: { color: gridClr },
          ticks: { 
            color: textClr, 
            font: { family: 'Poppins' },
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

// Chart toggle click listeners for completion trend
document.getElementById("btnWeeklyTrend")?.addEventListener("click", () => {
  const weekly = document.getElementById("btnWeeklyTrend");
  const monthly = document.getElementById("btnMonthlyTrend");
  weekly.classList.add("active");
  weekly.setAttribute("aria-pressed", "true");
  monthly.classList.remove("active");
  monthly.setAttribute("aria-pressed", "false");
  completionTrendView = "weekly";
  initCompletionTrendChart();
});

document.getElementById("btnMonthlyTrend")?.addEventListener("click", () => {
  const weekly = document.getElementById("btnWeeklyTrend");
  const monthly = document.getElementById("btnMonthlyTrend");
  monthly.classList.add("active");
  monthly.setAttribute("aria-pressed", "true");
  weekly.classList.remove("active");
  weekly.setAttribute("aria-pressed", "false");
  completionTrendView = "monthly";
  initCompletionTrendChart();
});

function renderFocusHistory() {
  const container = document.getElementById("focusHistoryList");
  if (!container) return;
  container.innerHTML = "";

  const history = analyticsData.focusHistory || [];
  if (history.length === 0) {
    container.innerHTML = `<div class="empty-history" style="text-align: center; color: var(--textLight); padding: 20px;">No sessions logged yet.</div>`;
    return;
  }

  // Render in reverse chronological order (newest first)
  [...history].reverse().forEach(session => {
    const item = document.createElement("div");
    item.className = "history-item";
    
    const date = new Date(session.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dayStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    // Check if it's today or yesterday or older
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    let displayTime = `${dayStr}, ${timeStr}`;
    if (date.toDateString() === todayStr) {
      displayTime = `Today, ${timeStr}`;
    } else if (date.toDateString() === yesterdayStr) {
      displayTime = `Yesterday, ${timeStr}`;
    }
    
    item.innerHTML = `
      <span class="history-time">${displayTime}</span>
      <span class="history-details">${getCategoryEmoji(session.category)} Studied ${session.category} for ${session.duration} mins</span>
      <span class="history-reward">+${session.rewardXp} XP</span>
    `;
    container.appendChild(item);
  });
}

function calculateMostProductiveDay() {
  const daySums = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  // Sum completed tasks per weekday
  Object.keys(analyticsData.completedTasksPerDay).forEach(dateStr => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    if (!isNaN(dayOfWeek)) {
      daySums[dayOfWeek] += analyticsData.completedTasksPerDay[dateStr] || 0;
    }
  });
  
  let maxIdx = 2; // Default to Tuesday/Wednesday if no data
  let maxVal = 0;
  for (let i = 0; i < 7; i++) {
    if (daySums[i] > maxVal) {
      maxVal = daySums[i];
      maxIdx = i;
    }
  }
  
  return dayNames[maxIdx];
}

function getPeakFocusHour() {
  const hours = ["9 AM - 11 AM", "2 PM - 4 PM", "4 PM - 6 PM", "7 PM - 9 PM"];
  const index = (xp + coins) % hours.length;
  return hours[index];
}

// ==========================================================================
// 9. GITHUB CONSISTENCY HEATMAP GENERATOR
// ==========================================================================

function renderHeatmap() {
  const container = document.getElementById("heatmapContainer");
  if (!container) return;
  container.innerHTML = "";

  const today = new Date();
  const weeksToDisplay = 15;
  const daysToDisplay = weeksToDisplay * 7;
  
  // Align start date to the beginning of the week
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysToDisplay + 1);

  // Generate grid items
  for (let i = 0; i < daysToDisplay; i++) {
    const day = new Date(startDate.getTime());
    day.setDate(startDate.getDate() + i);
    const dateStr = getFormattedDate(day);

    const studyMinutes = analyticsData.dailyStudyMinutes[dateStr] || 0;
    const completedTasks = analyticsData.completedTasksPerDay[dateStr] || 0;
    
    // Overall activity metric
    const activityScore = Math.round(studyMinutes + (completedTasks * 12));
    
    let level = 0;
    if (activityScore > 0) {
      if (activityScore <= 15) level = 1;
      else if (activityScore <= 35) level = 2;
      else if (activityScore <= 65) level = 3;
      else level = 4;
    }

    const dayBlock = document.createElement("div");
    dayBlock.classList.add("heatmap-day", `level-${level}`);
    
    // Readable date for tooltip
    const formattedDate = day.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const tooltipText = `${formattedDate}: ${studyMinutes.toFixed(1)} mins study, ${completedTasks} completed quests`;
    dayBlock.setAttribute("data-tooltip", tooltipText);

    container.appendChild(dayBlock);
  }
}

// ==========================================================================
// 10. QUEST MASTERY PROGRESS LIST
// ==========================================================================

function renderQuestMastery() {
  const container = document.getElementById("subjectProgressList");
  if (!container) return;
  container.innerHTML = "";

  const categories = ["Theory", "Practical", "Assignment", "Revision"];
  const progressClasses = ["theory", "practical", "assignment", "revision"];

  categories.forEach((cat, index) => {
    const stats = analyticsData.categoryStats[cat] || { created: 0, completed: 0 };
    const created = stats.created || 0;
    const completed = stats.completed || 0;
    
    const percentage = created > 0 ? Math.round((completed / created) * 100) : 0;
    const barClass = progressClasses[index];

    const progressRow = document.createElement("div");
    progressRow.classList.add("subject-progress-item");
    progressRow.innerHTML = `
      <div class="subject-info-row">
        <span class="subject-name">${getCategoryEmoji(cat)} ${cat}</span>
        <span class="subject-ratio"><span>${completed}</span> / ${created} completed</span>
      </div>
      <div class="subject-bar-container">
        <div class="subject-bar-fill ${barClass}" style="width: ${percentage}%"></div>
      </div>
    `;

    container.appendChild(progressRow);
  });
}

// ==========================================================================
// DEADLINE TRACKER FUNCTIONS
// ==========================================================================

function getTimeUntilDeadline(deadlineString) {
  if (!deadlineString) return null;
  
  const deadline = new Date(deadlineString).getTime();
  const now = Date.now();
  const diff = deadline - now;

  if (diff < 0) {
    return { 
      formatted: "OVERDUE", 
      minutes: 0, 
      urgency: "critical" 
    };
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let formatted = "";
  if (days > 0) {
    formatted = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes % 60}m`;
  } else {
    formatted = `${minutes}m`;
  }

  const urgency = diff < 7200000 ? "critical" : (diff < 86400000 ? "warning" : "normal");

  return { formatted, minutes, urgency };
}

function getDeadlineUrgency(deadlineString) {
  if (!deadlineString) return "";
  const urgencyData = getTimeUntilDeadline(deadlineString);
  return urgencyData ? urgencyData.urgency : "";
}

function formatDeadlineDisplay(deadlineString) {
  if (!deadlineString) return "";
  const urgencyData = getTimeUntilDeadline(deadlineString);
  return urgencyData ? urgencyData.formatted + " left" : "";
}

function updateDeadlineAlerts() {
  const container = document.getElementById("deadlineAlerts");
  if (!container) return;

  const now = Date.now();
  const urgentTasks = tasks
    .filter(task => task.deadline && !task.completed)
    .filter(task => {
      const deadline = new Date(task.deadline).getTime();
      const diff = deadline - now;
      return diff < 86400000; // 24 hours
    })
    .sort((a, b) => {
      const aDeadline = new Date(a.deadline).getTime();
      const bDeadline = new Date(b.deadline).getTime();
      return aDeadline - bDeadline;
    });

  container.innerHTML = "";

  if (urgentTasks.length === 0) {
    return;
  }

  urgentTasks.slice(0, 3).forEach(task => {
    const urgencyData = getTimeUntilDeadline(task.deadline);
    const alertDiv = document.createElement("div");
    alertDiv.classList.add("deadline-alert");
    if (urgencyData.urgency !== "normal") {
      alertDiv.classList.add("warning");
    }


    // Send browser notification for tasks reaching critical urgency
    if (urgencyData.urgency === "critical") {
      sendNotification("Urgent Deadline!", `COMPLETE ${task.text} TASK ASAP`);
    }


    const icon = urgencyData.urgency === "critical" ? "ri-alarm-warning-fill" : "ri-time-line";
    
    alertDiv.innerHTML = `
      <i class="${icon}"></i>
      <div class="alert-content">
        <strong>${escapeHtml(task.text)}</strong>
        <p>${urgencyData.formatted}</p>
      </div>
    `;

    container.appendChild(alertDiv);
  });
}

function sortByDeadline() {
  const now = Date.now();
  
  tasks.sort((a, b) => {
    const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    
    if (aDeadline === Infinity && bDeadline === Infinity) return 0;
    if (aDeadline === Infinity) return 1;
    if (bDeadline === Infinity) return -1;
    
    return aDeadline - bDeadline;
  });

  currentFilter = "All";
  renderTasks();
}

// Initialize deadline update interval
function initDeadlineUpdater() {
  updateDeadlineAlerts();
  setInterval(() => {
    updateDeadlineAlerts();
    renderTasks();
  }, 60000); // Update every minute
}

// ==========================================================================
// 11. ADVANCED RESPONSIVENESS AND COLLAPSIBLE SIDEBAR MENU
// ==========================================================================

const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.createElement("div");
sidebarOverlay.className = "sidebar-overlay";
document.body.appendChild(sidebarOverlay);

const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");

function toggleSidebar(show) {
  if (show) {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("active");
    enableFocusTrap(sidebar);
  } else {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
    disableFocusTrap();
  }
}

if (mobileSidebarToggle) {
  mobileSidebarToggle.addEventListener("click", () => toggleSidebar(true));
}
sidebarOverlay.addEventListener("click", () => toggleSidebar(false));

// ==========================================================================
// 12. MOBILE FLOATING QUICK ADD Form Controllers
// ==========================================================================

const mobileAddDrawer = document.getElementById("mobileAddDrawer");
const mobileAddDrawerOverlay = document.getElementById("mobileAddDrawerOverlay");
const mobileQuickAddBtn = document.getElementById("mobileQuickAddBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const mobileAddTaskBtn = document.getElementById("mobileAddTaskBtn");
const mobileTaskInput = document.getElementById("mobileTaskInput");
const mobileCategorySelect = document.getElementById("mobileCategorySelect");

function toggleMobileDrawer(show) {
  if (show) {
    mobileAddDrawer.classList.add("open");
    mobileAddDrawerOverlay.classList.add("active");
    enableFocusTrap(mobileAddDrawer);
    setTimeout(() => mobileTaskInput.focus(), 150); // Auto-focus on drawer slide up
  } else {
    mobileAddDrawer.classList.remove("open");
    mobileAddDrawerOverlay.classList.remove("active");
    disableFocusTrap();
  }
}

if (mobileQuickAddBtn) {
  mobileQuickAddBtn.addEventListener("click", () => toggleMobileDrawer(true));
}
if (closeDrawerBtn) {
  closeDrawerBtn.addEventListener("click", () => toggleMobileDrawer(false));
}
if (mobileAddDrawerOverlay) {
  mobileAddDrawerOverlay.addEventListener("click", () => toggleMobileDrawer(false));
}

// Create new quest from mobile form
if (mobileAddTaskBtn) {
  mobileAddTaskBtn.addEventListener("click", () => {
    const text = mobileTaskInput.value.trim();
    const category = mobileCategorySelect.value;

    const mobilePrioritySelect = document.getElementById("mobilePrioritySelect");
    const priority = mobilePrioritySelect ? mobilePrioritySelect.value : "Medium";

    if (text === "") {
      mobileTaskInput.classList.add("input-invalid");
      mobileTaskInput.setAttribute("aria-invalid", "true");
      announce("Failed to add task. Please enter a task description.");
      setTimeout(() => {
        mobileTaskInput.classList.remove("input-invalid");
      }, 400);
      return;
    }
    mobileTaskInput.setAttribute("aria-invalid", "false");


    const task = {
      id: Date.now(),
      text,
      category,
      priority,
      completed: false,
      createdAt: getFormattedDate(new Date())
    };

    tasks.push(task);
    mobileTaskInput.value = "";

    if (!analyticsData.categoryStats[category]) {
      analyticsData.categoryStats[category] = { created: 0, completed: 0 };
    }
    analyticsData.categoryStats[category].created += 1;

    saveData();
    renderTasks();

    // Notify user to complete the new task ASAP (Mobile)
    sendNotification("Quest Assigned", `COMPLETE ${text} TASK ASAP`);

    // Show UI popup notification (Mobile)
    showTaskPopup(`COMPLETE ${text.toUpperCase()} TASK ASAP`);

    toggleMobileDrawer(false); // Hide overlay
    announce(`Task added: "${text}". Category: ${category}, Priority: ${priority}.`);
  });
}

// ==========================================================================
// 13. ACCESSIBILITY COMPLIANCE KEYBOARD SHORTCUTS
// ==========================================================================

document.addEventListener("keydown", e => {
  // Focus main input or open mobile input form on Alt + N or Alt + A
  if (e.altKey && (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'a')) {
    e.preventDefault();
    if (window.innerWidth <= 900) {
      toggleMobileDrawer(true);
    } else {
      taskInput.focus();
    }
  }

  // Switch to workspace tab on Alt + 1
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    const tabBtnQuests = document.querySelector('[data-tab="quests"]');
    if (tabBtnQuests) tabBtnQuests.click();
  }

  // Switch to analytics dashboard on Alt + 2
  if (e.altKey && e.key === '2') {
    e.preventDefault();
    const tabBtnAnalytics = document.querySelector('[data-tab="analytics"]');
    if (tabBtnAnalytics) tabBtnAnalytics.click();
  }

  // Alt + Space to start/pause Study Timer
  if (e.altKey && e.code === 'Space') {
    e.preventDefault();
    if (timer) {
      pauseTimer();
      alert("Timer Paused");
    } else {
      startTimer();
      alert("Timer Started");
    }
  }

  // Escape to close active mobile sidebar or slide drawers
  if (e.key === 'Escape') {
    toggleSidebar(false);
    toggleMobileDrawer(false);
  }
});

// ==========================================================================
// 14. INTERACTIVE SYSTEM INITIALIZATIONS
// ==========================================================================

// Filter Button routers
filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// Theme selection dot selectors click listeners
document.querySelectorAll(".theme-dot").forEach(dot => {
  dot.addEventListener("click", () => {
    setTheme(dot.dataset.theme);
  });
});

// Main Keypress triggers
taskInput.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    addTask();
  }
});

addTaskBtn.addEventListener("click", addTask);

// Deadline filter button
const sortByDeadlineBtn = document.getElementById("sortByDeadline");
if (sortByDeadlineBtn) {
  sortByDeadlineBtn.addEventListener("click", () => {
    sortByDeadline();
  });
}

// Dom Loaded
document.addEventListener("DOMContentLoaded", () => {
  // Request browser notification permissions on startup
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Search input logic
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderTasks();
    });
  }

  loadData();
  updateGamification();
  renderTasks();
  renderAchievements();
  renderWeeklyStreak();
  updateDisplay();
  renderProfile();

  initDeadlineUpdater();




  // Setup dragover reordering for list container
  const taskListContainer = document.getElementById("taskList");
  if (taskListContainer) {
    taskListContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggingEl = document.querySelector(".dragging");
      if (!draggingEl) return;

      const afterElement = getDragAfterElement(taskListContainer, e.clientY);
      if (afterElement == null) {
        taskListContainer.appendChild(draggingEl);
      } else {
        taskListContainer.insertBefore(draggingEl, afterElement);
      }
    });

    taskListContainer.addEventListener("drop", () => {
      saveTaskOrder();
    });
  }

  // Wire view toggles
  const listViewBtn = document.getElementById("listViewBtn");
  const boardViewBtn = document.getElementById("boardViewBtn");

  if (listViewBtn && boardViewBtn) {
    listViewBtn.addEventListener("click", () => {
      currentView = "list";
      listViewBtn.classList.add("active");
      boardViewBtn.classList.remove("active");
      renderTasks();
    });

    boardViewBtn.addEventListener("click", () => {
      currentView = "board";
      boardViewBtn.classList.add("active");
      listViewBtn.classList.remove("active");
      renderTasks();
    });
  }

});

// ==========================================================================
// 15. PROFILE MANAGEMENT & MODAL
// ==========================================================================

function renderProfile() {
  const nameEl = document.getElementById("profileNameDisplay");
  const classEl = document.getElementById("profileClassDisplay");
  const avatarImg = document.getElementById("profileAvatarImg");
  const avatarPlaceholder = document.getElementById("profileIconPlaceholder");

  if (nameEl) nameEl.textContent = profile.name || "Student Hero";
  if (classEl) classEl.textContent = `${profile.class || "Class 10"} • Focus Warrior ⚔️`;

  if (avatarImg && avatarPlaceholder) {
    if (profile.gender === "Female") {
      avatarImg.src = "female_avatar.svg";
      avatarImg.style.display = "block";
      avatarPlaceholder.style.display = "none";
    } else {
      avatarImg.src = "male_avatar.svg";
      avatarImg.style.display = "block";
      avatarPlaceholder.style.display = "none";
    }
  }
}

// Open Profile Modal
document.getElementById("profileCard")?.addEventListener("click", () => {
  const overlay = document.getElementById("profileModalOverlay");
  const modal = document.getElementById("profileModal");
  if (!overlay || !modal) return;

  // Populate form with current data
  document.getElementById("profileInputName").value = profile.name || "";
  document.getElementById("profileInputClass").value = profile.class || "";
  document.getElementById("profileInputGender").value = profile.gender || "Male";

  overlay.classList.add("active");
  modal.classList.add("active");
  enableFocusTrap(modal);
});

// Close Profile Modal
function closeProfileModal() {
  document.getElementById("profileModalOverlay")?.classList.remove("active");
  document.getElementById("profileModal")?.classList.remove("active");
  disableFocusTrap();
}

document.getElementById("closeProfileModalBtn")?.addEventListener("click", closeProfileModal);
document.getElementById("profileModalOverlay")?.addEventListener("click", closeProfileModal);

// Save Profile
document.getElementById("saveProfileBtn")?.addEventListener("click", (e) => {
  const nameInput = document.getElementById("profileInputName");
  const classInput = document.getElementById("profileInputClass");
  const genderInput = document.getElementById("profileInputGender");

  const newName = nameInput.value.trim();
  if (newName === "") {
    nameInput.classList.add("input-invalid");
    announce("Please enter your name.");
    setTimeout(() => nameInput.classList.remove("input-invalid"), 400);
    return;
  }

  profile.name = newName;
  profile.class = classInput.value.trim();
  profile.gender = genderInput.value;

  saveData();
  renderProfile();
  closeProfileModal();
  triggerConfetti();
  announce("Profile updated successfully.");
});

// ==========================================================================
// MOTIVATIONAL QUOTES
// ==========================================================================

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it is done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Anonymous" },
  { text: "Small progress is still progress. Keep going.", author: "Anonymous" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Study now, Netflix later.", author: "Every Student Ever" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is nobody can take it away from you.", author: "B.B. King" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },
  { text: "Dream big. Start small. Act now.", author: "Robin Sharma" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Focus on progress, not perfection.", author: "Anonymous" },
];

const quoteIndices = { 1: 0, 2: 10 };

function refreshQuote(slot) {
  const textEl = document.getElementById(`quoteText${slot}`);
  const authorEl = document.getElementById(`quoteAuthor${slot}`);
  if (!textEl || !authorEl) return;

  // Fade out
  textEl.classList.add("refreshing");
  authorEl.classList.add("refreshing");

  setTimeout(() => {
    // Advance to next quote
    quoteIndices[slot] = (quoteIndices[slot] + 1) % QUOTES.length;
    const q = QUOTES[quoteIndices[slot]];
    textEl.textContent = `"${q.text}"`;
    authorEl.textContent = `— ${q.author}`;

    // Fade back in
    textEl.classList.remove("refreshing");
    authorEl.classList.remove("refreshing");
  }, 280);
}

document.getElementById("quoteRefresh1")?.addEventListener("click", () => refreshQuote(1));
document.getElementById("quoteRefresh2")?.addEventListener("click", () => refreshQuote(2));

// ==========================================================================
// BREAK REMINDER SYSTEM
// ==========================================================================

(function () {
  // --- DOM refs ---
  const breakStartBtn   = document.getElementById("breakStartBtn");
  const breakPauseBtn   = document.getElementById("breakPauseBtn");
  const breakResetBtn   = document.getElementById("breakResetBtn");
  const breakTimeDisp   = document.getElementById("breakTimeDisplay");
  const breakStatusBadge= document.getElementById("breakStatusBadge");
  const breakIntervalSel= document.getElementById("breakIntervalSelect");
  const breakRingFill   = document.getElementById("breakRingFill");
  const breakSoundToggle= document.getElementById("breakSoundToggle");
  const breakToast      = document.getElementById("breakToast");
  const breakToastClose = document.getElementById("breakToastClose");
  const breakToastMsg   = document.getElementById("breakToastMsg");
  const breakToastProgress = document.getElementById("breakToastProgress");

  if (!breakStartBtn) return; // Guard: elements not in DOM

  // --- State ---
  const RING_CIRCUMFERENCE = 163.4; // 2 * π * 26
  let totalSecs   = 25 * 60;
  let remainSecs  = totalSecs;
  let timerHandle = null;
  let toastHandle = null;
  let running     = false;

  const BREAK_EMOJIS = ["☕", "🧘", "🚶", "💧", "🌿", "🎵", "😌", "🙆"];
  const BREAK_MSGS = [
    m => `You've been focused for ${m} minutes. Take a 5-min stretch break!`,
    m => `${m} minutes of solid work! Hydrate and rest your eyes. 💧`,
    m => `Great focus session (${m} min)! Stand up and breathe deeply. 🌿`,
    m => `${m} minutes done! Your brain deserves a short reset. 🧠`,
    m => `Impressive! ${m} minutes of study. Time to recharge for 5 minutes. 🔋`,
  ];

  // --- Helpers ---
  function padTwo(n) { return String(n).padStart(2, "0"); }

  function formatTime(s) {
    return `${padTwo(Math.floor(s / 60))}:${padTwo(s % 60)}`;
  }

  function updateRing() {
    const progress = remainSecs / totalSecs;
    const offset   = RING_CIRCUMFERENCE * (1 - progress);
    breakRingFill.style.strokeDashoffset = offset;
  }

  function updateDisplay() {
    breakTimeDisp.textContent = formatTime(remainSecs);
    updateRing();
  }

  function setStatus(state) {
    if (state === "running") {
      breakStatusBadge.textContent = "ON";
      breakStatusBadge.classList.add("active");
    } else if (state === "paused") {
      breakStatusBadge.textContent = "PAUSE";
      breakStatusBadge.classList.remove("active");
    } else {
      breakStatusBadge.textContent = "OFF";
      breakStatusBadge.classList.remove("active");
    }
  }

  function applyInterval() {
    const mins = parseInt(breakIntervalSel.value, 10);
    totalSecs  = mins * 60;
    remainSecs = totalSecs;
    updateDisplay();
    breakToastMsg.textContent = BREAK_MSGS[0](mins);
  }

  // --- Sound (Web Audio API) ---
  function playBreakSound() {
    if (!breakSoundToggle.checked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Gentle chime: three ascending notes
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.22);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.22 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.5);
        osc.start(ctx.currentTime + i * 0.22);
        osc.stop(ctx.currentTime + i * 0.22 + 0.55);
      });
    } catch (_) { /* no AudioContext support */ }
  }

  // --- Toast ---
  function showBreakToast() {
    const mins = parseInt(breakIntervalSel.value, 10);
    const msgIdx = Math.floor(Math.random() * BREAK_MSGS.length);
    const emojiIdx = Math.floor(Math.random() * BREAK_EMOJIS.length);

    document.getElementById("breakToastEmoji").textContent = BREAK_EMOJIS[emojiIdx];
    breakToastMsg.textContent = BREAK_MSGS[msgIdx](mins);

    breakToast.classList.add("show");

    // Animated progress bar auto-dismiss in 8 seconds
    const AUTO_DISMISS_MS = 8000;
    breakToastProgress.style.transition = "none";
    breakToastProgress.style.transform  = "scaleX(1)";
    // Force reflow
    breakToastProgress.offsetHeight;
    breakToastProgress.style.transition = `transform ${AUTO_DISMISS_MS}ms linear`;
    breakToastProgress.style.transform  = "scaleX(0)";

    clearTimeout(toastHandle);
    toastHandle = setTimeout(dismissBreakToast, AUTO_DISMISS_MS);

    playBreakSound();

    // Vibration if supported
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    announce("Break time! You've earned a rest.");
  }

  function dismissBreakToast() {
    breakToast.classList.remove("show");
    clearTimeout(toastHandle);
  }

  // --- Timer core ---
  function tick() {
    if (remainSecs <= 0) {
      clearInterval(timerHandle);
      timerHandle = null;
      running = false;
      remainSecs = 0;
      updateDisplay();
      showBreakToast();
      // Auto-restart after toast is dismissed
      setStatus("off");
      breakStartBtn.disabled = false;
      breakPauseBtn.disabled = true;
      return;
    }
    remainSecs--;
    updateDisplay();
  }

  // --- Controls ---
  breakStartBtn.addEventListener("click", () => {
    if (running) return;
    if (remainSecs <= 0) applyInterval();
    running = true;
    setStatus("running");
    breakStartBtn.disabled = true;
    breakPauseBtn.disabled = false;
    timerHandle = setInterval(tick, 1000);
  });

  breakPauseBtn.addEventListener("click", () => {
    if (!running) return;
    running = false;
    clearInterval(timerHandle);
    timerHandle = null;
    setStatus("paused");
    breakStartBtn.disabled = false;
    breakPauseBtn.disabled = true;
  });

  breakResetBtn.addEventListener("click", () => {
    running = false;
    clearInterval(timerHandle);
    timerHandle = null;
    applyInterval();
    setStatus("off");
    breakStartBtn.disabled = false;
    breakPauseBtn.disabled = true;
  });

  breakIntervalSel.addEventListener("change", () => {
    const wasRunning = running;
    if (running) {
      running = false;
      clearInterval(timerHandle);
      timerHandle = null;
    }
    applyInterval();
    setStatus("off");
    breakStartBtn.disabled = false;
    breakPauseBtn.disabled = true;
    // If it was running, auto-restart with new interval
    if (wasRunning) breakStartBtn.click();
  });

  breakToastClose.addEventListener("click", dismissBreakToast);

  // --- Init ---
  applyInterval();
  breakPauseBtn.disabled = true;
})();



// ==========================================================================
// ASSIGNMENT TRACKER
// ==========================================================================

(function () {
  // ---- Storage key ----
  const ASGN_KEY = "taskquest_assignments";

  // ---- State ----
  let assignments = [];
  let asgnFilter  = "all";
  let asgnSortBy  = "deadline";
  let asgnSearch  = "";
  let notifiedIds = new Set(); // track already-notified assignments
  let dlToastHandle = null;

  // ---- Load / Save ----
  function loadAssignments() {
    try { assignments = JSON.parse(localStorage.getItem(ASGN_KEY)) || []; }
    catch (_) { assignments = []; }
  }
  function saveAssignments() {
    localStorage.setItem(ASGN_KEY, JSON.stringify(assignments));
  }

  // ---- Helpers ----
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  function getStatus(asgn) {
    if (asgn.done) return "done";
    const diff = new Date(asgn.due) - Date.now();
    if (diff < 0) return "overdue";
    if (diff <= 48 * 60 * 60 * 1000) return "upcoming"; // ≤ 48 h
    return "pending";
  }

  function formatCountdown(asgn) {
    if (asgn.done) return { label: "✔ Done", cls: "done" };
    const diff = new Date(asgn.due) - Date.now();
    if (diff < 0) {
      const h = Math.floor(-diff / 3600000);
      const d = Math.floor(h / 24);
      return { label: d > 0 ? `${d}d overdue` : `${h}h overdue`, cls: "overdue" };
    }
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return { label: `${d}d ${h % 24}h left`, cls: d <= 2 ? "due-soon" : "ok" };
    return { label: `${h}h ${m}m left`, cls: h <= 24 ? "due-soon" : "ok" };
  }

  function formatDueDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

  function sortedFiltered() {
    let list = assignments.slice();

    // Filter
    if (asgnFilter !== "all") {
      list = list.filter(a => {
        const s = getStatus(a);
        if (asgnFilter === "pending")  return s === "pending";
        if (asgnFilter === "upcoming") return s === "upcoming";
        if (asgnFilter === "overdue")  return s === "overdue";
        if (asgnFilter === "done")     return s === "done";
        return true;
      });
    }

    // Search
    if (asgnSearch.trim()) {
      const q = asgnSearch.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (asgnSortBy === "deadline") return new Date(a.due) - new Date(b.due);
      if (asgnSortBy === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (asgnSortBy === "subject")  return a.subject.localeCompare(b.subject);
      if (asgnSortBy === "added")    return b.addedAt - a.addedAt;
      return 0;
    });

    return list;
  }

  // ---- Render Cards ----
  function renderAssignments() {
    const list = sortedFiltered();
    const container = document.getElementById("asgnList");
    if (!container) return;

    updateStats();
    renderTimeline();

    if (list.length === 0) {
      container.innerHTML = `
        <div class="asgn-empty">
          <i class="ri-calendar-check-line"></i>
          <h3>No assignments here</h3>
          <p>Add one above or change the active filter.</p>
        </div>`;
      return;
    }

    container.innerHTML = "";
    list.forEach(asgn => {
      const status   = getStatus(asgn);
      const cd       = formatCountdown(asgn);
      const dueStr   = formatDueDate(asgn.due);

      const card = document.createElement("div");
      card.className = `asgn-card priority-${asgn.priority} status-${status}`;
      card.dataset.id = asgn.id;

      const dueIconCls = status === "overdue" ? "overdue"
                       : status === "upcoming" ? "due-soon" : "ok";

      card.innerHTML = `
        <div class="asgn-check${asgn.done ? " checked" : ""}" role="checkbox"
             aria-checked="${asgn.done}" tabindex="0" data-check="${asgn.id}"
             title="${asgn.done ? "Mark incomplete" : "Mark complete"}">
          ${asgn.done ? '<i class="ri-check-line"></i>' : ""}
        </div>
        <div class="asgn-card-body">
          <div class="asgn-subject-tag"><i class="ri-book-open-line"></i> ${escapeHtml(asgn.subject)}</div>
          <div class="asgn-title">${escapeHtml(asgn.title)}</div>
          <div class="asgn-meta-row">
            <span class="asgn-due-label ${dueIconCls}">
              <i class="ri-time-line"></i> ${dueStr}
            </span>
            <span class="asgn-countdown ${cd.cls}">${cd.label}</span>
            <span class="asgn-priority-pill ${asgn.priority}">${asgn.priority}</span>
          </div>
          ${asgn.notes ? `<p class="asgn-notes-text">${escapeHtml(asgn.notes)}</p>` : ""}
        </div>
        <div class="asgn-card-actions">
          <button class="asgn-action-btn del-btn" data-del="${asgn.id}" aria-label="Delete assignment" title="Delete">
            <i class="ri-delete-bin-6-line"></i>
          </button>
        </div>`;

      // Checkbox click
      card.querySelector(`[data-check="${asgn.id}"]`).addEventListener("click", () => toggleDone(asgn.id));
      card.querySelector(`[data-check="${asgn.id}"]`).addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDone(asgn.id); }
      });
      // Delete click
      card.querySelector(`[data-del="${asgn.id}"]`).addEventListener("click", () => deleteAssignment(asgn.id));

      container.appendChild(card);
    });
  }

  // ---- Stats ----
  function updateStats() {
    const total    = assignments.length;
    const done     = assignments.filter(a => a.done).length;
    const upcoming = assignments.filter(a => getStatus(a) === "upcoming").length;
    const overdue  = assignments.filter(a => getStatus(a) === "overdue").length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("asgnTotal",    total);
    setEl("asgnDone",     done);
    setEl("asgnUpcoming", upcoming);
    setEl("asgnOverdue",  overdue);
  }

  // ---- Timeline ----
  function renderTimeline() {
    const grid = document.getElementById("asgnTimelineGrid");
    const rangeEl = document.getElementById("asgnTimelineRange");
    if (!grid) return;

    const today = new Date();
    today.setHours(0,0,0,0);

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });

    const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const todayNum = today.getDate();

    if (rangeEl) {
      const last = days[days.length - 1];
      rangeEl.textContent = `${today.toLocaleDateString("en-IN",{day:"numeric",month:"short"})} – ${last.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}`;
    }

    grid.innerHTML = "";
    days.forEach(day => {
      const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
      const dayEnd   = new Date(day); dayEnd.setHours(23,59,59,999);
      const isToday  = day.getDate() === todayNum && day.getMonth() === today.getMonth();

      const dayAsgns = assignments.filter(a => {
        const d = new Date(a.due);
        return d >= dayStart && d <= dayEnd;
      });

      const cell = document.createElement("div");
      cell.className = `asgn-tl-day${isToday ? " today" : ""}`;

      let dots = dayAsgns.map(a => {
        const cls = getStatus(a);
        return `<div class="asgn-tl-dot ${cls === "upcoming" ? "due-soon" : cls}" title="${escapeHtml(a.title)}"></div>`;
      }).join("");

      cell.innerHTML = `
        <span class="asgn-tl-day-name">${DAY_NAMES[day.getDay()]}</span>
        <span class="asgn-tl-day-num">${day.getDate()}</span>
        ${dots}
        ${dayAsgns.length > 0 ? `<span class="asgn-tl-count">${dayAsgns.length} due</span>` : ""}`;

      grid.appendChild(cell);
    });
  }

  // ---- CRUD ----
  function addAssignment() {
    const titleEl    = document.getElementById("asgnTitle");
    const subjectEl  = document.getElementById("asgnSubject");
    const dueEl      = document.getElementById("asgnDue");
    const priorityEl = document.getElementById("asgnPriority");
    const notesEl    = document.getElementById("asgnNotes");

    const title   = titleEl?.value.trim();
    const subject = subjectEl?.value.trim();
    const due     = dueEl?.value;
    const priority= priorityEl?.value || "Medium";
    const notes   = notesEl?.value.trim();

    if (!title)   { titleEl?.focus();   return showAsgnError(titleEl,   "Enter assignment title"); }
    if (!subject) { subjectEl?.focus(); return showAsgnError(subjectEl, "Enter subject"); }
    if (!due)     { dueEl?.focus();     return showAsgnError(dueEl,     "Select due date"); }

    assignments.unshift({
      id: uid(), title, subject, due, priority, notes,
      done: false, addedAt: Date.now()
    });
    saveAssignments();
    renderAssignments();

    // Reset form
    if (titleEl)    titleEl.value   = "";
    if (subjectEl)  subjectEl.value = "";
    if (dueEl)      dueEl.value     = "";
    if (notesEl)    notesEl.value   = "";
    if (priorityEl) priorityEl.value = "Medium";

    announce(`Assignment "${title}" added.`);
  }

  function showAsgnError(el, msg) {
    if (!el) return;
    el.style.borderColor = "#ef4444";
    el.placeholder = msg;
    setTimeout(() => { el.style.borderColor = ""; }, 1500);
  }

  function toggleDone(id) {
    const asgn = assignments.find(a => a.id === id);
    if (!asgn) return;
    asgn.done = !asgn.done;
    saveAssignments();
    renderAssignments();
    announce(`Assignment "${asgn.title}" marked ${asgn.done ? "complete" : "incomplete"}.`);
  }

  function deleteAssignment(id) {
    const asgn = assignments.find(a => a.id === id);
    if (!asgn) return;
    assignments = assignments.filter(a => a.id !== id);
    saveAssignments();
    renderAssignments();
    announce(`Assignment "${asgn.title}" deleted.`);
  }

  // ---- Deadline Reminder Toast ----
  const dlToast     = document.getElementById("asgnDeadlineToast");
  const dlToastMsg  = document.getElementById("asgnDlToastMsg");
  const dlToastTitle= document.getElementById("asgnDlToastTitle");
  const dlProgress  = document.getElementById("asgnDlProgress");
  const dlClose     = document.getElementById("asgnDlToastClose");

  function showDeadlineToast(asgn) {
    if (!dlToast) return;
    const cd = formatCountdown(asgn);
    if (dlToastTitle) dlToastTitle.textContent = asgn.priority === "High" ? "🔴 Urgent Deadline!" : "📅 Assignment Due Soon!";
    if (dlToastMsg)   dlToastMsg.textContent   = `"${asgn.title}" (${asgn.subject}) — ${cd.label}.`;

    dlToast.classList.add("show");

    const AUTO = 7000;
    if (dlProgress) {
      dlProgress.style.transition = "none";
      dlProgress.style.transform  = "scaleX(1)";
      dlProgress.offsetHeight; // reflow
      dlProgress.style.transition = `transform ${AUTO}ms linear`;
      dlProgress.style.transform  = "scaleX(0)";
    }

    clearTimeout(dlToastHandle);
    dlToastHandle = setTimeout(() => dlToast.classList.remove("show"), AUTO);
  }

  if (dlClose) dlClose.addEventListener("click", () => {
    dlToast?.classList.remove("show");
    clearTimeout(dlToastHandle);
  });

  // Check for upcoming deadlines every minute
  function checkDeadlines() {
    const now = Date.now();
    assignments.forEach(asgn => {
      if (asgn.done || notifiedIds.has(asgn.id)) return;
      const diff = new Date(asgn.due) - now;
      // Notify if ≤ 2 hours away or overdue within last 10 min
      if (diff <= 2 * 60 * 60 * 1000 && diff > -10 * 60 * 1000) {
        notifiedIds.add(asgn.id);
        showDeadlineToast(asgn);
      }
    });
  }

  // ---- Countdown refresh ----
  function refreshCountdowns() {
    const cards = document.querySelectorAll(".asgn-card[data-id]");
    cards.forEach(card => {
      const id   = card.dataset.id;
      const asgn = assignments.find(a => a.id === id);
      if (!asgn) return;
      const cdEl = card.querySelector(".asgn-countdown");
      if (cdEl) {
        const cd = formatCountdown(asgn);
        cdEl.textContent = cd.label;
        cdEl.className   = `asgn-countdown ${cd.cls}`;
      }
    });
  }

  // ---- Form collapse toggle ----
  const formToggleBtn = document.getElementById("asgnFormToggle");
  const formBody      = document.getElementById("asgnFormBody");
  const formHeader    = document.querySelector(".asgn-form-header");

  function toggleForm() {
    if (!formBody) return;
    const isCollapsed = formBody.classList.contains("collapsed");
    formBody.classList.toggle("collapsed", !isCollapsed);
    if (formToggleBtn) formToggleBtn.classList.toggle("collapsed", !isCollapsed);
  }

  if (formToggleBtn) formToggleBtn.addEventListener("click", e => { e.stopPropagation(); toggleForm(); });
  if (formHeader)    formHeader.addEventListener("click", () => toggleForm());

  // ---- Wire up events ----
  document.getElementById("asgnAddBtn")?.addEventListener("click", addAssignment);

  document.getElementById("asgnTitle")?.addEventListener("keydown", e => {
    if (e.key === "Enter") addAssignment();
  });

  document.querySelectorAll(".asgn-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".asgn-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      asgnFilter = btn.dataset.asgnFilter;
      renderAssignments();
    });
  });

  document.getElementById("asgnSort")?.addEventListener("change", e => {
    asgnSortBy = e.target.value;
    renderAssignments();
  });

  document.getElementById("asgnSearch")?.addEventListener("input", e => {
    asgnSearch = e.target.value;
    renderAssignments();
  });

  // ---- Init ----
  loadAssignments();
  renderAssignments();
  checkDeadlines();

  // Re-render when tab is activated
  document.addEventListener("asgnTabActive", () => {
    renderAssignments();
  });

  setInterval(refreshCountdowns, 30000);   // refresh countdowns every 30 sec
  setInterval(checkDeadlines, 60000);      // check deadlines every 1 min

})();
