const STORAGE_KEY = "daily-todolist-tasks-v2";

const sampleTasks = [
  { time: "05:00", task: "Dậy", completed: false },
  { time: "05:05", task: "Tắm, đánh răng, rửa mặt", completed: false },
  { time: "05:30", task: "Ăn sáng", completed: false },
  { time: "05:45", task: "Lên kế hoạch công việc trong ngày", completed: false },
  { time: "06:00", task: "Ngồi vào bàn làm việc / bắt đầu xử lý việc cá nhân", completed: false },
  { time: "08:30", task: "Di chuyển đi làm", completed: false },
  { time: "09:00", task: "Làm ca sáng", completed: false },
  { time: "12:00", task: "Nghỉ trưa", completed: false },
  { time: "13:30", task: "Bắt đầu làm việc ca chiều", completed: false },
  { time: "17:40", task: "Tan làm", completed: false },
  { time: "17:40", task: "Di chuyển về nhà", completed: false },
  { time: "18:30", task: "Thể dục / thể thao", completed: false },
  { time: "19:30", task: "Tắm", completed: false },
  { time: "20:00", task: "Ăn cơm tối", completed: false },
  { time: "20:30", task: "Làm việc buổi tối", completed: false },
  { time: "22:00", task: "Đọc sách", completed: false },
  { time: "22:30", task: "Vệ sinh cá nhân", completed: false },
  { time: "23:00", task: "Đi ngủ", completed: false },
];

const els = {
  app: document.querySelector(".app-screen"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  currentTime: document.querySelector("#currentTime"),
  progressPercent: document.querySelector("#progressPercent"),
  progressCount: document.querySelector("#progressCount"),
  taskProgressBar: document.querySelector("#taskProgressBar"),
  remainingText: document.querySelector("#remainingText"),
  dayProgressText: document.querySelector("#dayProgressText"),
  dayProgressBar: document.querySelector("#dayProgressBar"),
  editToggle: document.querySelector("#editToggle"),
  addTaskButton: document.querySelector("#addTaskButton"),
  saveButton: document.querySelector("#saveButton"),
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialog: document.querySelector("#closeDialog"),
  cancelTask: document.querySelector("#cancelTask"),
  startInput: document.querySelector("#startInput"),
  endInput: document.querySelector("#endInput"),
  titleInput: document.querySelector("#titleInput"),
  completedInput: document.querySelector("#completedInput"),
  toast: document.querySelector("#toast"),
};

let tasks = loadTasks();
let editing = false;
let editingTaskId = null;

function normalizeTask(raw, index) {
  const rawTime = raw.time || raw.startTime || "00:00";
  const [startTime, endTime] = rawTime.includes("-") ? rawTime.split("-") : [rawTime, raw.endTime];
  return {
    id: raw.id || `task-${Date.now()}-${index}`,
    startTime,
    endTime: endTime || "",
    title: raw.title || raw.task,
    completed: Boolean(raw.completed),
  };
}

function loadTasks() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (!stored) return sortTasks(sampleTasks.map(normalizeTask));

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return sortTasks(sampleTasks.map(normalizeTask));
    }
    return sortTasks(parsed.map(normalizeTask));
  } catch {
    return sortTasks(sampleTasks.map(normalizeTask));
  }
}

function saveTasks(showMessage = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage can be unavailable in embedded browsers; the UI should still work.
  }
  if (showMessage) showToast("Đã lưu danh sách");
}

function sortTasks(items) {
  return [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

function formatRange(task) {
  return task.endTime ? `${task.startTime}-${task.endTime}` : task.startTime;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getCurrentMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatClock(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getTaskEndMinutes(index) {
  const task = tasks[index];
  if (task.endTime) return toMinutes(task.endTime);
  if (tasks[index + 1]) return toMinutes(tasks[index + 1].startTime);
  return 23 * 60 + 59;
}

function getActiveTaskIndex(nowMinutes = getCurrentMinutes()) {
  return tasks.findIndex((task, index) => {
    const start = toMinutes(task.startTime);
    const end = getTaskEndMinutes(index);
    return nowMinutes >= start && nowMinutes < end;
  });
}

function render() {
  const now = new Date();
  const activeIndex = getActiveTaskIndex(getCurrentMinutes(now));
  renderHeader(now);
  renderProgress();
  renderTasks(activeIndex, formatClock(now));
}

function renderHeader(now) {
  const minutes = getCurrentMinutes(now);
  const percent = Math.min(100, Math.max(0, (minutes / 1440) * 100));
  const hoursElapsed = Math.floor(minutes / 60);
  const minutesElapsed = minutes % 60;

  els.currentTime.textContent = formatClock(now);
  els.dayProgressBar.style.width = `${percent}%`;
  els.dayProgressText.textContent = `${Math.round(percent)}% · Đã qua ${hoursElapsed}h ${String(minutesElapsed).padStart(2, "0")}m`;
}

function renderProgress() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;

  els.progressPercent.textContent = `${percent}%`;
  els.progressCount.textContent = `${completed}/${total}`;
  els.taskProgressBar.style.width = `${percent}%`;
  els.remainingText.textContent = remaining ? `Còn ${remaining} việc cần hoàn thành` : "Tất cả công việc đã hoàn thành";
  document.querySelector(".donut").style.setProperty("--percent", percent);
}

function renderTasks(activeIndex, nowLabel) {
  els.taskList.innerHTML = "";
  els.emptyState.hidden = tasks.length > 0;
  els.app.classList.toggle("editing", editing);
  els.editToggle.setAttribute("aria-pressed", String(editing));
  els.editToggle.querySelector("span:last-child").textContent = editing ? "Xong" : "Chỉnh sửa";

  tasks.forEach((task, index) => {
    const row = document.createElement("article");
    row.className = `task-row${index === activeIndex ? " active" : ""}${task.completed ? " completed" : ""}`;

    const timeCell = document.createElement("div");
    timeCell.className = "time-cell";
    timeCell.textContent = formatRange(task);

    const taskCell = document.createElement("div");
    taskCell.className = "task-cell";
    taskCell.innerHTML = '<span class="timeline-line" aria-hidden="true"></span><span class="timeline-dot" aria-hidden="true"></span>';

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    taskCell.append(title);

    if (index === activeIndex) {
      const nowLine = document.createElement("span");
      nowLine.className = "now-line";
      nowLine.innerHTML = `<span class="now-label">${nowLabel}</span>`;
      row.append(nowLine);
    }

    const statusCell = document.createElement("div");
    statusCell.className = "status-cell";

    if (index === activeIndex) {
      const badge = document.createElement("span");
      badge.className = "active-badge";
      badge.textContent = "Đang diễn ra";
      taskCell.append(badge);
    }

    const editControls = document.createElement("span");
    editControls.className = "edit-controls";
    editControls.append(createMiniButton("Sửa", "✎", () => openTaskDialog(task.id)));
    editControls.append(createMiniButton("Xóa", "×", () => deleteTask(task.id), "delete"));
    statusCell.append(editControls);

    const checkbox = document.createElement("input");
    checkbox.className = "status-check";
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Đánh dấu ${task.title}`);
    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      saveTasks();
      render();
    });
    statusCell.append(checkbox);

    row.append(timeCell, taskCell, statusCell);
    els.taskList.append(row);
  });
}

function createMiniButton(label, text, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `mini-button ${extraClass}`.trim();
  button.setAttribute("aria-label", label);
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function openTaskDialog(taskId = null) {
  editingTaskId = taskId;
  const task = tasks.find((item) => item.id === taskId);
  els.dialogTitle.textContent = task ? "Chỉnh sửa việc" : "Thêm việc";
  els.startInput.value = task ? task.startTime : "";
  els.endInput.value = task ? task.endTime : "";
  els.titleInput.value = task ? task.title : "";
  els.completedInput.checked = task ? task.completed : false;
  if (typeof els.dialog.showModal === "function") {
    els.dialog.showModal();
  } else {
    els.dialog.setAttribute("open", "");
  }
  els.startInput.focus();
}

function closeTaskDialog() {
  if (typeof els.dialog.close === "function") {
    els.dialog.close();
  } else {
    els.dialog.removeAttribute("open");
  }
  els.form.reset();
  editingTaskId = null;
}

function deleteTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const confirmed = window.confirm(`Xóa công việc "${task.title}"?`);
  if (!confirmed) return;
  tasks = tasks.filter((item) => item.id !== taskId);
  saveTasks();
  render();
  showToast("Đã xóa công việc");
}

function submitTask(event) {
  event.preventDefault();
  const startTime = els.startInput.value;
  const endTime = els.endInput.value;
  const title = els.titleInput.value.trim();
  const isEditingExisting = Boolean(editingTaskId);

  if (!startTime || !title) return;
  if (endTime && toMinutes(endTime) <= toMinutes(startTime)) {
    showToast("Giờ kết thúc phải sau giờ bắt đầu");
    return;
  }

  if (isEditingExisting) {
    tasks = tasks.map((task) =>
      task.id === editingTaskId
        ? { ...task, startTime, endTime, title, completed: els.completedInput.checked }
        : task,
    );
  } else {
    const randomId =
      window.crypto && typeof window.crypto.randomUUID === "function" ? window.crypto.randomUUID() : Date.now();
    tasks.push({
      id: `task-${randomId}`,
      startTime,
      endTime,
      title,
      completed: els.completedInput.checked,
    });
  }

  tasks = sortTasks(tasks);
  saveTasks();
  closeTaskDialog();
  render();
  showToast(isEditingExisting ? "Đã cập nhật công việc" : "Đã thêm công việc");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

els.editToggle.addEventListener("click", () => {
  editing = !editing;
  render();
});

els.addTaskButton.addEventListener("click", () => openTaskDialog());
els.saveButton.addEventListener("click", () => saveTasks(true));
els.form.addEventListener("submit", submitTask);
els.closeDialog.addEventListener("click", closeTaskDialog);
els.cancelTask.addEventListener("click", closeTaskDialog);
els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) closeTaskDialog();
});

render();
setInterval(render, 1000);
