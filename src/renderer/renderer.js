'use strict';

/* ============================================================
   DeskPet 界面逻辑
   数据从主进程拿，所有改动都交回主进程保存。
   ============================================================ */

const api = window.deskpet;
const $ = (id) => document.getElementById(id);

const state = {
  settings: {},
  memos: [],
  todos: [],
  clips: [],
  info: {}
};

const ui = {
  tab: 'todo',
  memoId: null,
  filter: 'active',
  search: ''
};

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

const ICON = {
  check: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6.5"/></svg>',
  close: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  edit: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M11.2 2.8l2 2-7.6 7.6-2.6.6.6-2.6z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M8 4.7V8l2.2 1.4"/></svg>',
  pin: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4.6 2.6h6.8v10.8L8 10.7l-3.4 2.7z"/></svg>',
  pinFill: '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M4.6 2.2h6.8a.4.4 0 0 1 .4.4v11a.4.4 0 0 1-.63.32L8 11.35l-3.17 2.57A.4.4 0 0 1 4.2 13.6v-11a.4.4 0 0 1 .4-.4z"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="5.6" y="5.6" width="7.8" height="7.8" rx="1.6"/><path d="M3.2 10.4a1.6 1.6 0 0 1-1.6-1.6V3.2a1.6 1.6 0 0 1 1.6-1.6h5.6a1.6 1.6 0 0 1 1.6 1.6"/></svg>'
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function iconBtn(html, title, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mini-btn' + (className ? ' ' + className : '');
  button.title = title;
  button.innerHTML = html;
  return button;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';

  const date = new Date(ts);
  const now = new Date();
  const hm = pad(date.getHours()) + ':' + pad(date.getMinutes());

  if (date.toDateString() === now.toDateString()) return hm;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return '昨天 ' + hm;

  const sameYear = date.getFullYear() === now.getFullYear();
  const md = (date.getMonth() + 1) + '月' + date.getDate() + '日';
  return sameYear ? `${md} ${hm}` : `${date.getFullYear()}年${md}`;
}

function dueText(ts) {
  const date = new Date(ts);
  const now = new Date();
  const hm = pad(date.getHours()) + ':' + pad(date.getMinutes());
  const md = (date.getMonth() + 1) + '月' + date.getDate() + '日';

  if (date.toDateString() === now.toDateString()) return '今天 ' + hm;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return '明天 ' + hm;

  return md + ' ' + hm;
}

function toLocalInputValue(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shortcutLabel(accel) {
  return String(accel || '')
    .replace('CommandOrControl', navigator.platform.toLowerCase().includes('mac') ? 'Cmd' : 'Ctrl')
    .replace('CmdOrCtrl', navigator.platform.toLowerCase().includes('mac') ? 'Cmd' : 'Ctrl');
}

/* ------------------------------------------------------------------ */
/* 提示条与模态框                                                      */
/* ------------------------------------------------------------------ */

let toastTimer = null;

function showToast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 2200);
}

let modalResolve = null;

function openModal(options) {
  const opts = Object.assign(
    { title: '', text: '', value: '', placeholder: '', inputType: 'text', okText: '确定', showInput: true },
    options || {}
  );

  return new Promise((resolve) => {
    modalResolve = resolve;

    $('modal-title').textContent = opts.title;
    $('modal-text').textContent = opts.text;
    $('modal-text').hidden = !opts.text;

    const input = $('modal-input');
    input.type = opts.inputType;
    input.value = opts.value;
    input.placeholder = opts.placeholder;
    input.hidden = !opts.showInput;

    $('modal-ok').textContent = opts.okText;
    $('modal').hidden = false;

    setTimeout(() => {
      if (opts.showInput) input.focus();
    }, 30);
  });
}

function closeModal(result) {
  $('modal').hidden = true;
  const resolve = modalResolve;
  modalResolve = null;
  if (resolve) resolve(result);
}

/* ------------------------------------------------------------------ */
/* 数据同步                                                            */
/* ------------------------------------------------------------------ */

function applyData(data) {
  if (!data) return;
  state.settings = data.settings || state.settings;
  state.memos = Array.isArray(data.memos) ? data.memos : state.memos;
  state.todos = Array.isArray(data.todos) ? data.todos : state.todos;
  state.clips = Array.isArray(data.clips) ? data.clips : state.clips;

  if (!state.memos.some((m) => m.id === ui.memoId)) {
    ui.memoId = state.memos[0] ? state.memos[0].id : null;
  }

  renderMemos();
  renderTodos();
  renderClips();
  renderSettings();
  renderStatus();
}

async function act(promise) {
  try {
    const res = await promise;
    if (res && res.data) applyData(res.data);
    return res;
  } catch (err) {
    showToast('操作失败：' + ((err && err.message) || err));
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 渲染：备忘录                                                        */
/* ------------------------------------------------------------------ */

function renderMemos() {
  const select = $('memo-select');
  select.innerHTML = '';

  for (const memo of state.memos) {
    const items = state.todos.filter((t) => t.memoId === memo.id);
    const done = items.filter((t) => t.done).length;
    const option = document.createElement('option');
    option.value = memo.id;
    option.textContent = `${memo.name}  ${done}/${items.length}`;
    select.appendChild(option);
  }

  if (ui.memoId) select.value = ui.memoId;
}

/* ------------------------------------------------------------------ */
/* 渲染：待办                                                          */
/* ------------------------------------------------------------------ */

function renderTodos() {
  const list = $('todo-list');
  list.innerHTML = '';

  const all = state.todos.filter((t) => t.memoId === ui.memoId);
  const items = all
    .filter((t) => (ui.filter === 'all' ? true : ui.filter === 'done' ? t.done : !t.done))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.done) {
        if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return b.createdAt - a.createdAt;
      }
      return (b.doneAt || 0) - (a.doneAt || 0);
    });

  const left = all.filter((t) => !t.done).length;
  $('todo-counter').textContent = all.length ? `未完成 ${left} / 共 ${all.length}` : '';

  if (!items.length) {
    const empty = el('li', 'empty');
    empty.innerHTML =
      ui.filter === 'done'
        ? '还没有已完成的事项'
        : ui.filter === 'active'
          ? '<span>暂时没有待办<br>在上面输入框写下要做什么，按回车就行</span>'
          : '这个备忘录还是空的';
    list.appendChild(empty);
    return;
  }

  for (const todo of items) {
    const item = el('li', 'todo' + (todo.done ? ' done' : ''));

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'check';
    check.title = todo.done ? '点一下恢复为未完成' : '点一下打钩完成';
    check.innerHTML = ICON.check;
    check.addEventListener('click', () => act(api.toggleTodo(todo.id)));
    item.appendChild(check);

    const main = el('div', 'todo-main');
    main.appendChild(el('div', 'todo-text', todo.text));

    if (todo.dueAt) {
      const due = el('div', 'todo-due' + (todo.dueAt < Date.now() && !todo.done ? ' overdue' : ''));
      due.innerHTML = ICON.clock;
      const label = el('span', null, '截止 ' + dueText(todo.dueAt));
      due.appendChild(label);
      main.appendChild(due);
    }

    item.appendChild(main);

    const actions = el('div', 'todo-actions');

    const editButton = iconBtn(ICON.edit, '修改文字或截止时间');
    editButton.addEventListener('click', () => editTodo(todo));
    actions.appendChild(editButton);

    const removeButton = iconBtn(ICON.close, '删除这条', 'danger');
    removeButton.addEventListener('click', async () => {
      const yes = await openModal({
        title: '删除这条待办？',
        text: todo.text,
        showInput: false,
        okText: '删除'
      });
      if (yes) act(api.removeTodo(todo.id));
    });
    actions.appendChild(removeButton);

    item.appendChild(actions);
    list.appendChild(item);
  }
}

async function editTodo(todo) {
  const text = await openModal({
    title: '修改内容',
    value: todo.text,
    placeholder: '要做的事',
    okText: '下一步'
  });
  if (text == null) return;

  const trimmed = String(text).trim();
  if (!trimmed) return;

  const due = await openModal({
    title: '设置截止时间',
    text: '留空表示不设提醒。到时间后 DeskPet 会弹出系统通知。',
    value: todo.dueAt ? toLocalInputValue(todo.dueAt) : '',
    inputType: 'datetime-local',
    okText: '保存'
  });
  if (due == null) return;

  const dueAt = due ? new Date(due).getTime() : null;
  act(api.updateTodo(todo.id, { text: trimmed, dueAt: Number.isFinite(dueAt) ? dueAt : null }));
}

/* ------------------------------------------------------------------ */
/* 渲染：剪贴板                                                        */
/* ------------------------------------------------------------------ */

function renderClips() {
  const list = $('clip-list');
  list.innerHTML = '';

  const keyword = ui.search.trim().toLowerCase();
  const items = keyword
    ? state.clips.filter((c) => c.text.toLowerCase().includes(keyword))
    : state.clips;

  $('clip-counter').textContent = keyword
    ? `找到 ${items.length} / ${state.clips.length} 条`
    : `共 ${state.clips.length} 条`;

  $('clip-enabled').checked = !!state.settings.clipboardEnabled;

  if (!items.length) {
    const empty = el('li', 'empty');
    empty.innerHTML = keyword
      ? '没有匹配的内容'
      : state.settings.clipboardEnabled
        ? '<span>还没有记录<br>随便复制一段文字试试，它会自动出现在这里</span>'
        : '<span>自动记录已关闭<br>打开上面的开关就会开始记录</span>';
    list.appendChild(empty);
    return;
  }

  for (const clip of items) {
    const card = el('div', 'clip' + (clip.pinned ? ' pinned' : ''));
    card.title = '点一下就把这段内容复制回剪贴板';

    card.appendChild(el('div', 'clip-text', clip.text));

    const foot = el('div', 'clip-foot');
    foot.appendChild(el('span', 'clip-time', `${timeAgo(clip.createdAt)} · ${clip.text.length} 字`));

    const actions = el('div', 'clip-actions');

    const pinButton = iconBtn(clip.pinned ? ICON.pinFill : ICON.pin, clip.pinned ? '取消置顶' : '置顶（不会被自动清理）', clip.pinned ? 'on' : '');
    pinButton.addEventListener('click', (event) => {
      event.stopPropagation();
      act(api.togglePin(clip.id));
    });
    actions.appendChild(pinButton);

    const copyButton = iconBtn(ICON.copy, '复制回剪贴板');
    copyButton.addEventListener('click', (event) => {
      event.stopPropagation();
      copyClip(clip);
    });
    actions.appendChild(copyButton);

    const removeButton = iconBtn(ICON.close, '删除这一条', 'danger');
    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      act(api.removeClip(clip.id));
    });
    actions.appendChild(removeButton);

    foot.appendChild(actions);
    card.appendChild(foot);

    card.addEventListener('click', () => copyClip(clip));
    list.appendChild(card);
  }
}

async function copyClip(clip) {
  const res = await act(api.copyClip(clip.id));
  if (res && res.copied) showToast('已复制到剪贴板，去需要的地方粘贴吧');
  else if (res) showToast('复制失败，请再试一次');
}

/* ------------------------------------------------------------------ */
/* 渲染：设置与状态栏                                                  */
/* ------------------------------------------------------------------ */

function renderSettings() {
  const panel = $('settings-sheet');
  if (panel.hidden) return;

  $('set-autostart').checked = !!state.settings.launchAtLogin;
  $('set-ball').checked = state.settings.ballVisible !== false;
  $('set-limit').value = state.settings.clipboardLimit || 200;
  $('set-shortcut').value = shortcutLabel(state.settings.shortcut);
  $('set-datapath').textContent = state.info.dataFile || '—';
  $('set-version').textContent = state.info.version ? 'DeskPet v' + state.info.version : '';
}

function renderStatus() {
  const left = state.todos.filter((t) => !t.done).length;
  $('status-text').textContent = `未完成 ${left} 项 · 剪贴板 ${state.clips.length} 条`;

  const running = !!state.settings.clipboardEnabled;
  $('status-hint').textContent = running
    ? shortcutLabel(state.settings.shortcut) + ' 呼出'
    : '记录已暂停';
}

/* ------------------------------------------------------------------ */
/* 标签页                                                              */
/* ------------------------------------------------------------------ */

function switchTab(tab) {
  if (tab !== 'todo' && tab !== 'clip') return;
  ui.tab = tab;

  for (const button of document.querySelectorAll('.tab')) {
    button.classList.toggle('is-active', button.dataset.tab === tab);
  }
  $('page-todo').classList.toggle('is-active', tab === 'todo');
  $('page-clip').classList.toggle('is-active', tab === 'clip');
}

/* ------------------------------------------------------------------ */
/* 事件绑定                                                            */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $('btn-hide').addEventListener('click', () => api.hideWindow());
  $('btn-settings').addEventListener('click', () => {
    $('settings-sheet').hidden = false;
    renderSettings();
  });
  $('btn-close-settings').addEventListener('click', () => {
    $('settings-sheet').hidden = true;
  });

  for (const button of document.querySelectorAll('.tab')) {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  }

  /* ---------- 待办 ---------- */

  $('todo-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('todo-input');
    const text = input.value.trim();
    if (!text) return;

    const raw = $('todo-due').value;
    const dueAt = raw ? new Date(raw).getTime() : null;

    input.value = '';
    $('todo-due').value = '';
    await act(api.addTodo({
      text,
      memoId: ui.memoId,
      dueAt: Number.isFinite(dueAt) ? dueAt : null
    }));
    input.focus();
  });

  $('memo-select').addEventListener('change', (event) => {
    ui.memoId = event.target.value;
    renderTodos();
  });

  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      ui.filter = chip.dataset.filter;
      for (const other of document.querySelectorAll('.chip')) {
        other.classList.toggle('is-active', other === chip);
      }
      renderTodos();
    });
  }

  const memoMenu = $('memo-menu');

  $('btn-memo-menu').addEventListener('click', (event) => {
    event.stopPropagation();
    memoMenu.hidden = !memoMenu.hidden;
  });

  memoMenu.addEventListener('click', async (event) => {
    const action = event.target.dataset ? event.target.dataset.action : null;
    if (!action) return;
    memoMenu.hidden = true;

    if (action === 'create') {
      const name = await openModal({ title: '新建待办', placeholder: '例如：工作 / 购物 / 学习', okText: '创建' });
      if (name == null) return;
      const res = await act(api.addMemo(String(name).trim() || '新备忘录'));
      const added = res && res.data && res.data.memos[res.data.memos.length - 1];
      if (added) {
        ui.memoId = added.id;
        renderMemos();
        renderTodos();
      }
      return;
    }

    const current = state.memos.find((m) => m.id === ui.memoId);
    if (!current) return;

    if (action === 'rename') {
      const name = await openModal({ title: '重命名备忘录', value: current.name, okText: '保存' });
      if (name == null || !String(name).trim()) return;
      act(api.renameMemo(current.id, String(name).trim()));
      return;
    }

    if (action === 'delete') {
      const yes = await openModal({
        title: '删除备忘录「' + current.name + '」？',
        text: '这个备忘录里的所有待办也会一起删除，无法恢复。',
        showInput: false,
        okText: '删除'
      });
      if (yes) {
        ui.memoId = null;
        act(api.removeMemo(current.id));
      }
    }
  });

  /* ---------- 剪贴板 ---------- */

  $('clip-search').addEventListener('input', (event) => {
    ui.search = event.target.value;
    renderClips();
  });

  $('clip-enabled').addEventListener('change', (event) => {
    act(api.updateSettings({ clipboardEnabled: event.target.checked }));
  });

  $('btn-clear-clip').addEventListener('click', async () => {
    const pinned = state.clips.filter((c) => c.pinned).length;
    const yes = await openModal({
      title: '清空剪贴板记录？',
      text: pinned
        ? `共 ${state.clips.length} 条，其中 ${pinned} 条已置顶会保留，其余全部删除。`
        : `共 ${state.clips.length} 条将全部删除。`,
      showInput: false,
      okText: '清空'
    });
    if (yes) act(api.clearClips(true));
  });

  /* ---------- 设置 ---------- */

  $('set-autostart').addEventListener('change', (event) => {
    act(api.updateSettings({ launchAtLogin: event.target.checked }));
  });

  $('set-ball').addEventListener('change', (event) => {
    act(api.updateSettings({ ballVisible: event.target.checked }));
  });

  $('set-limit').addEventListener('change', (event) => {
    act(api.updateSettings({ clipboardLimit: Number(event.target.value) }));
  });

  $('set-shortcut').addEventListener('keydown', async (event) => {
    event.preventDefault();
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    const key = normalizeKey(event);
    if (!key) return;
    parts.push(key);
    if (parts.length < 2) return;

    const accel = parts.join('+');
    $('set-shortcut').value = shortcutLabel(accel);

    const res = await act(api.updateSettings({ shortcut: accel }));
    // 如果这个组合键被别的软件占用了，主进程会退回默认值，这里同步显示真实生效的那个
    const applied =
      res && res.data && res.data.settings ? res.data.settings.shortcut : accel;
    $('set-shortcut').value = shortcutLabel(applied);
  });

  $('btn-open-folder').addEventListener('click', () => act(api.openDataFolder()));

  $('btn-export').addEventListener('click', async () => {
    const res = await act(api.exportData());
    if (res && res.ok) showToast('已导出到：' + res.dir);
    else if (res) showToast('导出失败：' + (res.message || '未知错误'));
  });

  $('btn-quit').addEventListener('click', async () => {
    const yes = await openModal({
      title: '完全退出 DeskPet？',
      text: '退出后待办提醒和剪贴板记录都会停止。下次开机若已开启自动启动，它会自己回来。',
      showInput: false,
      okText: '退出'
    });
    if (yes) api.quitApp();
  });

  /* ---------- 模态框 ---------- */

  $('modal-ok').addEventListener('click', () => {
    const input = $('modal-input');
    closeModal(input.hidden ? true : input.value);
  });

  $('modal-cancel').addEventListener('click', () => closeModal(null));

  $('modal').addEventListener('click', (event) => {
    if (event.target === $('modal')) closeModal(null);
  });

  $('modal-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('modal-ok').click();
    }
  });

  document.addEventListener('click', () => {
    memoMenu.hidden = true;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('modal').hidden) closeModal(null);
      else if (!$('settings-sheet').hidden) $('settings-sheet').hidden = true;
      else memoMenu.hidden = true;
    }
  });
}

function normalizeKey(event) {
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;

  const map = {
    Space: 'Space', Enter: 'Return', Escape: 'Escape',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
    Comma: ',', Period: '.', Slash: '/',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Insert: 'Insert', Delete: 'Delete', Tab: 'Tab', Backspace: 'Backspace'
  };

  return map[code] || '';
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  bindEvents();

  const initial = await api.loadAll();
  if (initial && initial.data) applyData(initial.data);

  const details = await api.getInfo();
  if (details && details.info) {
    state.info = details.info;
    renderSettings();
  }

  api.onDataChanged((data) => applyData(data));
  api.onSwitchTab((tab) => switchTab(tab));
  api.onToast((message) => showToast(message));

  $('todo-input').focus();
}

window.addEventListener('DOMContentLoaded', init);
