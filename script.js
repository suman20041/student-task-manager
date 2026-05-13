function addTask() {
  const input = document.getElementById("taskInput");
  const priorityInput = document.getElementById("priorityInput");
  const dueDateInput = document.getElementById("dueDateInput");
  const task = input.value.trim();
  const priority = priorityInput.value;
  const dueDate = dueDateInput.value;
  const errorMsg = document.getElementById("errorMsg");

  if (task === "") {
    errorMsg.textContent = "Please enter a task.";
    return;
  }
  errorMsg.textContent = "";

  const now = new Date();
  const timestamp = ` (${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;

  const taskData = {
    text: task,
    completed: false,
    timestamp: timestamp,
    priority: priority,
    dueDate: dueDate
  };

  createTaskElement(taskData);
  input.value = "";
  dueDateInput.value = "";
  taskTracker();
  saveTasks();
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.innerHTML = `
    <input type="checkbox" ${task.completed ? 'checked' : ''}>
    <span class="${task.completed ? 'completed' : ''}">${task.text}</span>
    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
    ${task.dueDate ? `<span class="due-date">📅 ${task.dueDate}</span>` : ''}
    <small style="margin-left: 10px; color: #888;">${task.timestamp}</small>
    <button class="edit-btn">Edit</button>
    <button class="remove-btn">Remove</button>
  `;

  const checkbox = li.querySelector('input[type="checkbox"]');
  checkbox.addEventListener("change", () => {
    li.querySelector('span').classList.toggle("completed");
    taskTracker();
    saveTasks();
  });

  const editButton = li.querySelector('.edit-btn');
  const span = li.querySelector('span');
  editButton.addEventListener("click", () => {
    if (editButton.textContent === "Edit") {
      const inputEdit = document.createElement("input");
      inputEdit.type = "text";
      inputEdit.value = span.textContent;
      li.replaceChild(inputEdit, span);
      editButton.textContent = "Save";
      inputEdit.focus();
    } else {
      const inputEdit = li.querySelector('input[type="text"]');
      span.textContent = inputEdit.value;
      li.replaceChild(span, inputEdit);
      editButton.textContent = "Edit";
      saveTasks();
    }
  });

  li.querySelector('.remove-btn').addEventListener("click", () => {
    li.remove();
    taskTracker();
    saveTasks();
  });

  document.getElementById("taskList").appendChild(li);
}

function saveTasks() {
  const tasks = [];
  document.querySelectorAll("#taskList li").forEach((li) => {
    const dueDateEl = li.querySelector(".due-date");
    tasks.push({
      text: li.querySelector("span").textContent,
      completed: li.querySelector("input").checked,
      timestamp: li.querySelector("small").textContent,
      priority: li.querySelector(".priority-badge").textContent,
      dueDate: dueDateEl ? dueDateEl.textContent.replace("📅 ", "") : ""
    });
  });
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function loadTasks() {
  const savedTasks = JSON.parse(localStorage.getItem("tasks") || "[]");
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";
  savedTasks.forEach((task) => createTaskElement(task));
  taskTracker();
}

document.addEventListener("DOMContentLoaded", loadTasks);

const clearAllBtn = document.getElementById("clearAllBtn");
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all tasks?")) {
      document.getElementById("taskList").innerHTML = "";
      taskTracker();
      saveTasks();
    }
  });
}

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const query = searchInput.value.toLowerCase();
    document.querySelectorAll("#taskList li").forEach((li) => {
      const text = li.querySelector("span").textContent.toLowerCase();
      li.style.display = text.includes(query) ? "flex" : "none";
    });
  });
}

function taskTracker() {
  const tasks = document.querySelectorAll("#taskList li");
  const completed = document.querySelectorAll("#taskList input:checked");
  
  const progress = tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0;
  const progressBar = document.getElementById("progressBar");
  if (progressBar) progressBar.style.width = progress + "%";

  const stats = document.getElementById("taskStats");
  if (stats) stats.innerText = `✅ ${completed.length} / ${tasks.length} completed (${Math.round(progress)}%)`;

  const celebration = document.getElementById("celebration");
  if (tasks.length > 0 && tasks.length === completed.length) {
    celebration.classList.remove("hidden");
    celebration.classList.add("show");
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  } else {
    celebration.classList.remove("show");
    celebration.classList.add("hidden");
  }
}

/* Theme Switcher */
const themeSwitcher = document.getElementById("themeSwitcher");
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
