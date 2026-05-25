// --- State Management ---
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let activeFilter = 'All';

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
  const filterOverdueBtn = document.getElementById('filterOverdueBtn');
  if (filterOverdueBtn){
    filterOverdueBtn.addEventListener('click', ()=>{
      const isActive = filterOverdueBtn.classList.contains('active');
      if (isActive){
        filterOverdueBtn.classList.remove('active'); activeFilter = 'All';
      } else {
        // deactivate other filters briefly if needed
        document.querySelectorAll('.filter-btn.active')?.forEach(b=>b.classList.remove('active'));
        filterOverdueBtn.classList.add('active'); activeFilter = 'Overdue';
      }
      renderTasks();
    });
  }
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

  const deadlineVal = document.getElementById('deadlineInput')?.value || null;
  const deadlineIso = deadlineVal ? new Date(deadlineVal).toISOString() : null;
  const dependsVal = document.getElementById('dependsSelect')?.value || '';
  const newTask = {
    id: Date.now(),
    text: text,
    completed: false,
    timestamp: `(${day}, ${date} at ${time})`,
    deadline: deadlineIso
    , dependsOn: dependsVal ? Number(dependsVal) : null
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
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  // Prevent completing if blocked by an incomplete prerequisite
  if (!task.completed && task.dependsOn) {
    const pre = tasks.find(t => t.id === task.dependsOn);
    if (pre && !pre.completed) {
      try { window.showToast(`Blocked — complete: ${pre.text}`, 'warning'); } catch(e){}
      return;
    }
  }
  tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveAndRender();
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const newText = prompt("Edit task:", task.text);
  if (newText !== null && newText.trim() !== "") {
    task.text = newText.trim();
  }
  // prompt for dependency selection (minimal UI): list tasks with index
  const choices = tasks.filter(t => t.id !== id).map((t, i) => `${i+1}. ${t.text} (id:${t.id}${t.completed? ' ✓':''})`);
  const sel = prompt(`Select prerequisite by number (empty = none):\n${choices.join('\n')}`);
  if (sel !== null) {
    const n = Number(sel);
    if (Number.isFinite(n) && n>=1 && n<=choices.length) {
      // map back to task id
      const chosen = tasks.filter(t => t.id !== id)[n-1];
      task.dependsOn = chosen ? chosen.id : null;
    } else if (sel.trim() === '') {
      task.dependsOn = null;
    }
  }
  saveAndRender();
}

function saveAndRender() {
  // compute overdue flags before saving
  updateOverdueFlags();
  localStorage.setItem("tasks", JSON.stringify(tasks));
  renderTasks();
  // Notify other modules (badges, analytics) that tasks changed
  try { document.dispatchEvent(new CustomEvent('tasksUpdated')); } catch (e) {}
}

function updateOverdueFlags(){
  const now = Date.now();
  tasks = tasks.map(t => {
    const copy = { ...t };
    copy.overdue = false;
    if (!copy.completed && copy.deadline){
      try{
        const d = new Date(copy.deadline).getTime();
        if (!isNaN(d) && d < now) copy.overdue = true;
      }catch(e){}
    }
    return copy;
  });
}

function renderTasks() {
  taskList.innerHTML = "";

  // refresh depends select for creation
  populateDependsSelect();

  tasks.forEach(task => {
    // apply filter
    if (activeFilter === 'Overdue' && !task.overdue) return;

    const li = document.createElement("li");
    if (task.completed) li.classList.add("completed");
    if (task.overdue) li.classList.add('overdue');

    const deadlineLabel = task.deadline ? new Date(task.deadline).toLocaleString() : '';
    const prereq = task.dependsOn ? tasks.find(t=>t.id===task.dependsOn) : null;
    const depBadge = prereq ? (prereq.completed ? `<span class="dep-badge ready">Ready</span>` : `<span class="dep-badge blocked">Blocked</span>`) : '';
    const depInfo = prereq ? `<div class="dep-info">Depends on: ${escapeHtml(prereq.text)}</div>` : '';
    li.innerHTML = `
      <input type="checkbox" ${task.completed ? "checked" : ""} onchange="toggleTask(${task.id})">
      <span>
        ${task.text}
        ${depBadge}
        <small style="display: block; font-size: 0.75rem; opacity: 0.7;">${task.timestamp}</small>
        ${deadlineLabel ? `<div class="task-deadline ${task.overdue ? 'overdue' : ''}">Due: ${deadlineLabel}</div>` : ''}
        ${depInfo}
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
  const overdueCount = tasks.filter(t => t.overdue).length;

  if (taskStats) {
    taskStats.innerText = `✅ ${completedCount} / ${totalCount} completed`;
  }

  const overdueEl = document.getElementById('overdueCount');
  if (overdueEl) {
    overdueEl.innerText = overdueCount;
    const sc = overdueEl.closest('.stat-card');
    if (sc) sc.classList.toggle('overdue', overdueCount>0);
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
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  if (themeSwitcher) {
    themeSwitcher.value = savedTheme;
    themeSwitcher.addEventListener("change", (e) => {
      const selectedTheme = e.target.value;
      document.documentElement.setAttribute("data-theme", selectedTheme);
      localStorage.setItem("theme", selectedTheme);
    });
  }
}

function populateDependsSelect(){
  const sel = document.getElementById('dependsSelect');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">No prerequisite</option>';
  tasks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.text = `${t.text}${t.completed? ' ✓':''}`;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

function escapeHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}



/* Export JSON Logic */
document.getElementById('exportJsonBtn')?.addEventListener('click', () => { const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2)); const dlAnchorElem = document.createElement('a'); dlAnchorElem.setAttribute('href', dataStr); dlAnchorElem.setAttribute('download', 'taskquest_backup.json'); dlAnchorElem.click(); });
