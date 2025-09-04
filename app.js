// Simple, snappy To‑Do app with localStorage, filters, and drag & drop
const $ = sel => document.querySelector(sel);
const $list = $("#list");
const $title = $("#newTitle");
const $due = $("#newDue");
const $prio = $("#newPrio");
const $add = $("#addBtn");
const $search = $("#search");
const $filter = $("#filterState");
const $sort = $("#sortBy");
const $clearDone = $("#clearDone");
const $counts = $("#counts");

const STORAGE_KEY = "todo.v1";
/** @type {Array<{id:string,title:string,done:boolean,created:number,due?:string,prio:'High'|'Medium'|'Low',notes?:string,order:number}>} */
let todos = load();

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return [] } }
function uid() { return Math.random().toString(36).slice(2,10); }

function addTodo(title, due, prio) {
  title = (title || "").trim();
  if (!title) return;
  const now = Date.now();
  const maxOrder = todos.reduce((m, t) => Math.max(m, t.order ?? 0), 0);
  todos.push({ id: uid(), title, done: false, created: now, due: due || "", prio: prio || "Medium", notes: "", order: maxOrder + 1 });
  save(); render();
  $title.value = ""; $due.value = ""; $prio.value = "Medium"; $title.focus();
}

function deleteTodo(id) { todos = todos.filter(t => t.id !== id); save(); render(); }
function toggleDone(id) { const t = todos.find(x => x.id === id); if (t){ t.done = !t.done; save(); render(); } }
function updateTitle(id, newTitle) { const t = todos.find(x => x.id === id); if (t){ t.title = newTitle.trim() || t.title; save(); render(); } }
function updateNotes(id, newNotes) { const t = todos.find(x => x.id === id); if (t){ t.notes = newNotes; save(); } }
function updateDue(id, newDue) { const t = todos.find(x => x.id === id); if (t){ t.due = newDue; save(); render(); } }
function updatePrio(id, newPrio) { const t = todos.find(x => x.id === id); if (t){ t.prio = newPrio; save(); render(); } }

function humanDate(iso) {
  if (!iso) return "";
  try { 
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
  } catch { return iso; }
}
function isToday(iso) {
  const d = new Date(); const i = new Date(iso + "T00:00:00");
  return d.toDateString() === i.toDateString();
}
function isOverdue(iso) {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(iso + "T00:00:00");
  return dd < today;
}

function applyFilters(list) {
  const q = ($search.value || "").toLowerCase();
  const state = $filter.value;
  let filtered = list.filter(t => t.title.toLowerCase().includes(q) || (t.notes||"").toLowerCase().includes(q));
  if (state === "active") filtered = filtered.filter(t => !t.done);
  if (state === "completed") filtered = filtered.filter(t => t.done);
  if (state === "today") filtered = filtered.filter(t => t.due && isToday(t.due));
  if (state === "overdue") filtered = filtered.filter(t => isOverdue(t.due));
  // Sorting
  const sort = $sort.value;
  const prioRank = { High: 0, Medium: 1, Low: 2 };
  filtered.sort((a,b) => {
    if (sort === "created") return (a.order ?? 0) - (b.order ?? 0);
    if (sort === "due") return (a.due||"9999").localeCompare(b.due||"9999");
    if (sort === "prio") return prioRank[a.prio] - prioRank[b.prio];
    if (sort === "alpha") return a.title.localeCompare(b.title);
    return 0;
  });
  return filtered;
}

function render() {
  const items = applyFilters(todos);
  $list.innerHTML = "";
  if (!items.length) {
    $list.innerHTML = `<div class="empty">Nothing here. Add your first task ✨</div>`;
  } else {
    for (const t of items) {
      $list.appendChild(renderItem(t));
    }
  }
  const active = todos.filter(t=>!t.done).length;
  const done = todos.length - active;
  $counts.textContent = `${todos.length} item${todos.length!==1?"s":""} — ${active} open, ${done} completed`;
}

function renderItem(t) {
  const el = document.createElement("div");
  el.className = "todo" + (t.done ? " completed" : "");
  el.draggable = true;
  el.dataset.id = t.id;
  el.innerHTML = `
    <input type="checkbox" aria-label="Mark done">
    <div class="content">
      <div class="title" contenteditable="true"></div>
      <div class="meta">
        <span class="badge prio-${t.prio}">${t.prio}</span>
        <span class="badge due">${t.due ? ("Due " + humanDate(t.due)) : "No due"}</span>
      </div>
      <textarea placeholder="Notes (optional) — supports multi-line"></textarea>
    </div>
    <div class="actions">
      <button class="ghost" title="Edit (E)">Edit</button>
      <button class="danger" title="Delete (Del)">Delete</button>
    </div>
  `;
  const $cb = el.querySelector('input[type="checkbox"]');
  const $title = el.querySelector(".title");
  const $notes = el.querySelector("textarea");
  const $edit = el.querySelector(".actions .ghost");
  const $del = el.querySelector(".actions .danger");
  const $due = el.querySelector(".meta .due");
  const $prioBadge = el.querySelector(".meta .badge");

  $cb.checked = t.done;
  $title.textContent = t.title;
  $notes.value = t.notes || "";
  // update due badge style
  if (isOverdue(t.due) && !t.done) $due.style.borderColor = "#ff6b6b"; 

  $cb.addEventListener("change", () => toggleDone(t.id));
  $del.addEventListener("click", () => deleteTodo(t.id));
  $edit.addEventListener("click", () => { $title.focus(); selectAll($title); });
  $title.addEventListener("blur", () => updateTitle(t.id, $title.textContent));
  $title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $title.blur(); }
  });
  $notes.addEventListener("input", () => updateNotes(t.id, $notes.value));

  // Quick inline editors via context menu
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openQuickMenu(e.clientX, e.clientY, t);
  });

  // Drag & drop order
  el.addEventListener("dragstart", () => { el.classList.add("dragging"); });
  el.addEventListener("dragend", () => { el.classList.remove("dragging"); save(); render(); });
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = document.querySelector(".todo.dragging");
    if (!dragging || dragging === el) return;
    const rect = el.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    const parent = el.parentElement;
    if (before) parent.insertBefore(dragging, el); else parent.insertBefore(dragging, el.nextSibling);
    // update order values based on DOM order
    Array.from(parent.children).forEach((node, idx) => {
      const id = node.dataset.id;
      const item = todos.find(x => x.id === id);
      if (item) item.order = idx + 1;
    });
  });

  // Click prio badge to cycle priority
  $prioBadge.addEventListener("click", () => {
    const order = ["High","Medium","Low"];
    const i = order.indexOf(t.prio);
    const next = order[(i+1)%order.length];
    updatePrio(t.id, next);
  });

  // Click due badge to set date
  $due.addEventListener("click", async () => {
    const next = prompt("Set due date (YYYY-MM-DD) — leave empty to clear:", t.due || "");
    if (next !== null) updateDue(t.id, next.trim());
  });

  return el;
}

function selectAll(el){ const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }

// Quick menu
function openQuickMenu(x, y, t) {
  closeQuickMenu();
  const menu = document.createElement("div");
  menu.id = "quickmenu";
  Object.assign(menu.style, {
    position: "fixed", left: x+"px", top: y+"px",
    background: "#0f1230", border: "1px solid #2a2e5a", borderRadius: "10px", padding: "8px",
    boxShadow: "0 10px 20px rgba(0,0,0,.4)", zIndex: 1000
  });
  menu.innerHTML = `
    <button data-act="today">Due: Today</button>
    <button data-act="tomorrow">Due: Tomorrow</button>
    <button data-act="clear">Clear Due</button>
  `;
  for (const btn of menu.querySelectorAll("button")) {
    Object.assign(btn.style, { display:"block", width:"100%", background:"transparent", border:"1px solid #2a2e5a", margin:"6px 0", padding:"6px 10px", borderRadius:"8px", color:"#eef0ff" });
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      const d = new Date();
      if (act === "today") updateDue(t.id, d.toISOString().slice(0,10));
      if (act === "tomorrow") { d.setDate(d.getDate()+1); updateDue(t.id, d.toISOString().slice(0,10)); }
      if (act === "clear") updateDue(t.id, "");
      closeQuickMenu();
    });
  }
  document.body.appendChild(menu);
  setTimeout(() => {
    const onDoc = (e) => { if (!menu.contains(e.target)) closeQuickMenu(); };
    document.addEventListener("mousedown", onDoc, { once:true });
  },0);
}
function closeQuickMenu(){ const m = document.getElementById("quickmenu"); if (m) m.remove(); }

// Handlers
$add.addEventListener("click", () => addTodo($title.value, $due.value, $prio.value));
$title.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTodo($title.value, $due.value, $prio.value);
});
$clearDone.addEventListener("click", () => { todos = todos.filter(t=>!t.done); save(); render(); });
$search.addEventListener("input", render);
$filter.addEventListener("change", render);
$sort.addEventListener("change", render);

// Accessibility: keyboard shortcuts for selected item
document.addEventListener("keydown", (e) => {
  const active = document.activeElement.closest(".todo");
  if (!active) return;
  const id = active.dataset.id;
  if (e.key === " " && document.activeElement.classList.contains("todo")) { e.preventDefault(); toggleDone(id); }
  if (e.key === "Delete") { deleteTodo(id); }
  if (e.key.toLowerCase() === "e") {
    const title = active.querySelector(".title"); title.focus(); selectAll(title);
  }
});

// Seed example tasks if empty
if (todos.length === 0) {
  addTodo("Finish To‑Do app", new Date().toISOString().slice(0,10), "High");
  addTodo("Share with the world", "", "Medium");
  addTodo("Drink water", "", "Low");
} else {
  render();
}
