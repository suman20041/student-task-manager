// --- State Management ---
// Guard against corrupt or malformed JSON in storage. A bare JSON.parse at
// the top level throws a SyntaxError before any function is defined, leaving
// `tasks` undefined and making the entire app non-functional until the user
// manually clears localStorage. The try/catch recovers silently with an
// empty array so the app always boots into a usable state.
let tasks = [];
try {
  const _raw = window.TaskQuestStorage
    ? window.TaskQuestStorage.getTasks()
    : JSON.parse(localStorage.getItem("taskquest_v1.tasks") || localStorage.getItem("tasks"));
  if (Array.isArray(_raw)) tasks = _raw;
} catch (e) {
  console.warn("[TaskQuest] Corrupt task data in storage — resetting to empty list.", e);
}

// --- Selectors ---
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const taskStats = document.getElementById("taskStats");
const errorMsg = document.getElementById("errorMsg");
const celebration = document.getElementById("celebration");
const themeSwitcher = document.getElementById("themeSwitcher");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  renderTasks();
  initTheme();
});

// --- Core Functions ---

function addTask() {
  const text = taskInput.value.trim();
  
  if (text === "") {
    errorMsg.textContent = "Please enter a task.";
    return;
  }

  errorMsg.textContent = "";

  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = dayNames[now.getDay()];
  const date = `${now.getDate()} ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const newTask = {
    id: Date.now(),
    text: text,
    completed: false,
    timestamp: `(${day}, ${date} at ${time})`
  };

  tasks.push(newTask);
  saveAndRender();
  taskInput.value = "";
}

function removeTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveAndRender();
}

function toggleTask(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });
  saveAndRender();
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const newText = prompt("Edit task:", task.text);
  if (newText !== null && newText.trim() !== "") {
    task.text = newText.trim();
    saveAndRender();
  }
}

function saveAndRender() {
  try {
    if (window.TaskQuestStorage) {
      window.TaskQuestStorage.setTasks(tasks);
    } else {
      localStorage.setItem("taskquest_v1.tasks", JSON.stringify(tasks));
    }
  } catch (e) {
    console.warn("[TaskQuest] Failed to persist tasks.", e);
  }
  renderTasks();
}

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach(task => {
    const li = document.createElement("li");
    if (task.completed) li.classList.add("completed");

    li.innerHTML = `
      <input type="checkbox" ${task.completed ? "checked" : ""} onchange="toggleTask(${task.id})">
      <span>
        ${task.text}
        <small style="display: block; font-size: 0.75rem; opacity: 0.7;">${task.timestamp}</small>
      </span>
      <div style="display: flex; gap: 5px;">
        <button onclick="editTask(${task.id})" style="padding: 0.5rem; font-size: 0.8rem;">Edit</button>
        <button onclick="removeTask(${task.id})" style="padding: 0.5rem; font-size: 0.8rem; background: var(--error-color, #ef4444);">Remove</button>
      </div>
    `;

    taskList.appendChild(li);
  });

  updateStats();
}

function updateStats() {
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  if (taskStats) {
    taskStats.innerText = `✅ ${completedCount} / ${totalCount} completed`;
  }

  if (celebration) {
    if (totalCount > 0 && completedCount === totalCount) {
      celebration.classList.remove("hidden");
      setTimeout(() => celebration.classList.add("show"), 10);
    } else {
      celebration.classList.remove("show");
      celebration.classList.add("hidden");
    }
  }
}

// --- Theme Management ---

function initTheme() {
  let savedTheme = "cosmic";
  try {
    savedTheme = (window.TaskQuestStorage
      ? window.TaskQuestStorage.getTheme()
      : localStorage.getItem("taskquest_v1.theme") || localStorage.getItem("quests_theme")) || "cosmic";
  } catch (e) {
    console.warn("[TaskQuest] Could not read theme from storage.", e);
  }
  document.documentElement.setAttribute("data-theme", savedTheme);

  if (themeSwitcher) {
    themeSwitcher.value = savedTheme;
    themeSwitcher.addEventListener("change", (e) => {
      const selectedTheme = e.target.value;
      document.documentElement.setAttribute("data-theme", selectedTheme);
      try {
        if (window.TaskQuestStorage) {
          window.TaskQuestStorage.setTheme(selectedTheme);
        } else {
          localStorage.setItem("taskquest_v1.theme", selectedTheme);
        }
      } catch (err) {
        console.warn("[TaskQuest] Failed to persist theme.", err);
      }
    });
  }
}



/* Export JSON Logic */
document.getElementById('exportJsonBtn')?.addEventListener('click', () => { const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2)); const dlAnchorElem = document.createElement('a'); dlAnchorElem.setAttribute('href', dataStr); dlAnchorElem.setAttribute('download', 'taskquest_backup.json'); dlAnchorElem.click(); });
