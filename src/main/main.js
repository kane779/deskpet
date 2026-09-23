'use strict';

/**
 * DeskPet 主进程
 * ---------------------------------------------------------------
 * 负责：悬浮面板窗口、系统托盘、全局快捷键、开机自启、
 *       剪贴板监听、待办到期提醒、本地数据读写。
 */

const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain,
  screen, shell, Notification, nativeImage
} = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const clipWatcher = require('./clipboard');

// 统一数据目录名，保证"开发时运行"和"安装后运行"用的是同一份数据
app.setName('DeskPet');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const ICON = path.join(ASSETS, 'icon.png');
const TRAY_ICON = path.join(ASSETS, 'tray.png');

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+V';
const WIN_WIDTH = 360;
const WIN_HEIGHT = 548;
const CLIP_TEXT_LIMIT = 20000;

let win = null;
let tray = null;
let reminderTimer = null;
let moveTimer = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/* 数据                                                                */
/* ------------------------------------------------------------------ */

function publicData() {
  const d = store.get();
  return {
    settings: d.settings,
    memos: d.memos,
    todos: d.todos,
    clips: d.clips
  };
}

function broadcast() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('data:changed', publicData());
  }
}

function toast(message) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('toast', message);
  }
}

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */

function clampToScreen(x, y) {
  const displays = screen.getAllDisplays();
  const visible = displays.some((display) => {
    const area = display.workArea;
    return (
      x >= area.x - 60 &&
      y >= area.y - 60 &&
      x < area.x + area.width &&
      y < area.y + area.height
    );
  });
  if (visible) return { x, y };

  const area = screen.getPrimaryDisplay().workAreaSize;
  return { x: area.width - WIN_WIDTH - 28, y: area.height - WIN_HEIGHT - 28 };
}

function createWindow() {
  const data = store.get();
  const area = screen.getPrimaryDisplay().workAreaSize;

  const rawX = Number.isFinite(data.window.x) ? data.window.x : area.width - WIN_WIDTH - 28;
  const rawY = Number.isFinite(data.window.y) ? data.window.y : area.height - WIN_HEIGHT - 28;
  const pos = clampToScreen(Math.round(rawX), Math.round(rawY));

  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: true,
    title: 'DeskPet',
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  win.setAlwaysOnTop(true, 'floating');
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));

  if (process.platform === 'darwin') {
    // Mac 上允许面板出现在所有桌面空间，包括全屏应用之上
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.once('ready-to-show', () => {
    // 开机自启时带上 --hidden，静默待在托盘里，不打扰你
    if (!process.argv.includes('--hidden')) {
      win.show();
    }
  });

  win.on('moved', scheduleSavePosition);

  win.on('close', (event) => {
    if (quitting) return;
    // 关闭 = 收起到托盘。程序要继续在后台跑，否则到点没法提醒你
    event.preventDefault();
    savePositionNow();
    win.hide();
  });

  win.on('closed', () => {
    win = null;
  });
}

function scheduleSavePosition() {
  if (moveTimer) clearTimeout(moveTimer);
  moveTimer = setTimeout(savePositionNow, 400);
}

function savePositionNow() {
  if (!win || win.isDestroyed()) return;
  if (moveTimer) {
    clearTimeout(moveTimer);
    moveTimer = null;
  }
  const [x, y] = win.getPosition();
  const d = store.get();
  d.window = { x, y };
  store.touch();
}

function showWindow() {
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) win.show();
  win.setAlwaysOnTop(true, 'floating');
  win.focus();
}

function toggleWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    showWindow();
  }
}

/** 快捷键：显示面板并切到剪贴板页 */
function revealClipboardTab() {
  showWindow();
  if (!win || win.isDestroyed()) return;
  const send = () => {
    if (win && !win.isDestroyed()) win.webContents.send('switch-tab', 'clip');
  };
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send);
  else send();
}

/* ------------------------------------------------------------------ */
/* 托盘                                                                */
/* ------------------------------------------------------------------ */

function createTray() {
  // macOS 菜单栏用"模板图"，系统会自动跟随浅色/深色模式反色
  const trayPath =
    process.platform === 'darwin' ? path.join(ASSETS, 'trayTemplate.png') : TRAY_ICON;

  let image = nativeImage.createFromPath(trayPath);
  if (image.isEmpty()) image = nativeImage.createFromPath(TRAY_ICON);
  if (image.isEmpty()) image = nativeImage.createFromPath(ICON);
  if (image.isEmpty()) image = nativeImage.createEmpty();

  if (process.platform === 'darwin' && !image.isEmpty()) {
    image.setTemplateImage(true);
  }

  tray = new Tray(image);
  tray.setToolTip('DeskPet · 桌面小助手');
  refreshTrayMenu();

  // Windows / Linux：左键单击切换面板显示。Mac 上交给菜单处理
  if (process.platform !== 'darwin') {
    tray.on('click', () => toggleWindow());
  }
}

function refreshTrayMenu() {
  if (!tray) return;
  const settings = store.get().settings;

  const menu = Menu.buildFromTemplate([
    { label: '显示 / 收起面板', click: () => toggleWindow() },
    { type: 'separator' },
    {
      label: '自动记录剪贴板',
      type: 'checkbox',
      checked: !!settings.clipboardEnabled,
      click: (item) => updateSettings({ clipboardEnabled: item.checked })
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: !!settings.launchAtLogin,
      click: (item) => updateSettings({ launchAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: '打开数据文件夹', click: () => openDataFolder() },
    { label: '导出数据备份', click: () => exportData() },
    { type: 'separator' },
    {
      label: '退出 DeskPet',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

/* ------------------------------------------------------------------ */
/* 快捷键 / 开机自启                                                    */
/* ------------------------------------------------------------------ */

function registerShortcut() {
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    // 没有已注册的快捷键时会抛错，忽略即可
  }

  const accelerator = store.get().settings.shortcut || DEFAULT_SHORTCUT;
  try {
    return globalShortcut.register(accelerator, revealClipboardTab);
  } catch (err) {
    console.error('[shortcut] 注册失败：', err);
    return false;
  }
}

function applyLoginItem() {
  if (process.platform === 'linux') return;
  const enabled = !!store.get().settings.launchAtLogin;
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      args: ['--hidden']
    });
  } catch (err) {
    console.error('[autostart] 设置开机自启失败：', err);
  }
}

/* ------------------------------------------------------------------ */
/* 剪贴板                                                              */
/* ------------------------------------------------------------------ */

function clampLimit(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 200;
  return Math.min(2000, Math.max(20, n));
}

function trimClips(data) {
  const limit = clampLimit(data.settings.clipboardLimit);
  const pinned = data.clips.filter((c) => c.pinned).sort((a, b) => b.createdAt - a.createdAt);
  const normal = data.clips.filter((c) => !c.pinned).sort((a, b) => b.createdAt - a.createdAt);
  data.clips = pinned.concat(normal.slice(0, limit));
}

function pushClip(text) {
  const value = String(text == null ? '' : text).slice(0, CLIP_TEXT_LIMIT);
  if (!value.trim()) return;

  const data = store.get();
  const now = Date.now();
  const newestNormal = data.clips.find((item) => !item.pinned);

  if (newestNormal && newestNormal.text === value) {
    // 刚复制的内容和最新一条完全一样，只更新时间，不重复占位置
    newestNormal.createdAt = now;
  } else {
    data.clips.unshift({ id: store.uid(), text: value, createdAt: now, pinned: false });
  }

  trimClips(data);
  store.touch();
  broadcast();
}

function startClipboardWatcher() {
  if (!store.get().settings.clipboardEnabled) {
    clipWatcher.stop();
    return;
  }
  clipWatcher.start((text) => pushClip(text));
}

/* ------------------------------------------------------------------ */
/* 到期提醒                                                            */
/* ------------------------------------------------------------------ */

function checkDueTodos() {
  const data = store.get();
  const now = Date.now();
  let changed = false;

  for (const todo of data.todos) {
    if (todo.done || !todo.dueAt || todo.notified) continue;
    if (todo.dueAt > now) continue;
    todo.notified = true;
    changed = true;
    notifyTodo(todo.text);
  }

  if (changed) {
    store.touch();
    broadcast();
  }
}

function notifyTodo(text) {
  if (!Notification.isSupported()) return;
  const body = text.length > 80 ? text.slice(0, 80) + '…' : text;
  try {
    const notification = new Notification({
      title: 'DeskPet 待办提醒',
      body,
      icon: ICON
    });
    notification.on('click', () => showWindow());
    notification.show();
  } catch (err) {
    console.error('[reminder] 弹出通知失败：', err);
  }
}

function startReminder() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(checkDueTodos, 30000);
  checkDueTodos();
}

/* ------------------------------------------------------------------ */
/* 数据导出 / 文件夹                                                   */
/* ------------------------------------------------------------------ */

function exportData() {
  const data = store.get();
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(app.getPath('documents'), 'DeskPet导出');
  fs.mkdirSync(dir, { recursive: true });

  // 1) 完整备份，以后想恢复数据就靠它
  fs.writeFileSync(
    path.join(dir, `DeskPet-完整备份-${stamp}.json`),
    JSON.stringify(data, null, 2),
    'utf8'
  );

  // 2) 待办导出成 Markdown，可以直接贴进笔记软件
  const lines = ['# DeskPet 待办导出', '', `导出时间：${new Date().toLocaleString()}`, ''];
  if (!data.memos.length) lines.push('（还没有备忘录）', '');
  for (const memo of data.memos) {
    const items = data.todos.filter((t) => t.memoId === memo.id);
    lines.push(`## ${memo.name}`, '');
    if (!items.length) lines.push('（空）');
    for (const todo of items) {
      const mark = todo.done ? 'x' : ' ';
      const due = todo.dueAt ? `　截止：${new Date(todo.dueAt).toLocaleString()}` : '';
      lines.push(`- [${mark}] ${todo.text}${due}`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(dir, `DeskPet-待办-${stamp}.md`), lines.join('\n'), 'utf8');

  // 3) 剪贴板导出成纯文本
  const clipLines = [
    'DeskPet 剪贴板记录导出',
    `导出时间：${new Date().toLocaleString()}`,
    `共 ${data.clips.length} 条`,
    ''
  ];
  for (const item of data.clips) {
    const time = new Date(item.createdAt).toLocaleString();
    clipLines.push(`===== ${time}${item.pinned ? ' [已置顶]' : ''} =====`);
    clipLines.push(item.text);
    clipLines.push('');
  }
  fs.writeFileSync(path.join(dir, `DeskPet-剪贴板-${stamp}.txt`), clipLines.join('\n'), 'utf8');

  return dir;
}

async function openDataFolder() {
  const dir = path.dirname(store.dataFile());
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return dir;
}

/* ------------------------------------------------------------------ */
/* 设置                                                                */
/* ------------------------------------------------------------------ */

function updateSettings(patch) {
  const data = store.get();
  const changes = patch && typeof patch === 'object' ? patch : {};

  data.settings = Object.assign({}, data.settings, changes);
  data.settings.clipboardLimit = clampLimit(data.settings.clipboardLimit);
  store.touchNow();

  applyLoginItem();
  trimClips(data);
  store.touch();

  if ('clipboardEnabled' in changes) startClipboardWatcher();

  if ('shortcut' in changes) {
    const registered = registerShortcut();
    if (!registered) {
      data.settings.shortcut = DEFAULT_SHORTCUT;
      registerShortcut();
      store.touch();
      toast('这个快捷键已被其他软件占用，已恢复默认');
    }
  }

  setImmediate(refreshTrayMenu);
  broadcast();
  return publicData();
}

/* ------------------------------------------------------------------ */
/* 界面调用入口                                                        */
/* ------------------------------------------------------------------ */

function ok(extra) {
  return Object.assign({ ok: true, data: publicData() }, extra || {});
}

function registerIpc() {
  ipcMain.handle('data:loadAll', () => ok());

  ipcMain.handle('app:info', () => ok({
    info: {
      version: app.getVersion(),
      platform: process.platform,
      dataFile: store.dataFile(),
      shortcut: store.get().settings.shortcut,
      clipboardRunning: clipWatcher.isRunning()
    }
  }));

  /* ---------------- 待办 ---------------- */

  ipcMain.handle('todo:add', (_event, payload) => {
    const data = store.get();
    const text = String((payload && payload.text) || '').trim();
    if (!text) return ok();

    const memoId = (payload && payload.memoId) || (data.memos[0] && data.memos[0].id);
    if (!memoId) return ok();

    data.todos.unshift({
      id: store.uid(),
      memoId,
      text: text.slice(0, 500),
      done: false,
      createdAt: Date.now(),
      doneAt: null,
      dueAt: payload && payload.dueAt ? Number(payload.dueAt) : null,
      notified: false
    });
    store.touch();
    return ok();
  });

  ipcMain.handle('todo:toggle', (_event, id) => {
    const data = store.get();
    const todo = data.todos.find((item) => item.id === id);
    if (todo) {
      todo.done = !todo.done;
      todo.doneAt = todo.done ? Date.now() : null;
      if (!todo.done) todo.notified = false;
      store.touch();
    }
    return ok();
  });

  ipcMain.handle('todo:update', (_event, id, patch) => {
    const data = store.get();
    const todo = data.todos.find((item) => item.id === id);
    const changes = patch && typeof patch === 'object' ? patch : {};
    if (todo) {
      if (typeof changes.text === 'string' && changes.text.trim()) {
        todo.text = changes.text.trim().slice(0, 500);
      }
      if ('dueAt' in changes) {
        todo.dueAt = changes.dueAt ? Number(changes.dueAt) : null;
        todo.notified = false;
      }
      store.touch();
    }
    return ok();
  });

  ipcMain.handle('todo:remove', (_event, id) => {
    const data = store.get();
    data.todos = data.todos.filter((item) => item.id !== id);
    store.touch();
    return ok();
  });

  ipcMain.handle('todo:clearDone', (_event, memoId) => {
    const data = store.get();
    data.todos = data.todos.filter((item) => {
      const belongs = !memoId || item.memoId === memoId;
      return !(item.done && belongs);
    });
    store.touch();
    return ok();
  });

  /* ---------------- 备忘录 ---------------- */

  ipcMain.handle('memo:add', (_event, name) => {
    const data = store.get();
    const title = String(name || '').trim() || '新备忘录';
    data.memos.push({ id: store.uid(), name: title.slice(0, 40), createdAt: Date.now() });
    store.touch();
    return ok();
  });

  ipcMain.handle('memo:rename', (_event, id, name) => {
    const data = store.get();
    const memo = data.memos.find((item) => item.id === id);
    const title = String(name || '').trim();
    if (memo && title) {
      memo.name = title.slice(0, 40);
      store.touch();
    }
    return ok();
  });

  ipcMain.handle('memo:remove', (_event, id) => {
    const data = store.get();
    if (data.memos.length <= 1) {
      toast('至少要保留一个备忘录');
      return ok();
    }
    data.memos = data.memos.filter((item) => item.id !== id);
    data.todos = data.todos.filter((item) => item.memoId !== id);
    store.touch();
    return ok();
  });

  /* ---------------- 剪贴板 ---------------- */

  ipcMain.handle('clip:copy', (_event, id) => {
    const data = store.get();
    const item = data.clips.find((entry) => entry.id === id);
    if (!item) return ok({ copied: false });
    const copied = clipWatcher.write(item.text);
    return ok({ copied });
  });

  ipcMain.handle('clip:remove', (_event, id) => {
    const data = store.get();
    data.clips = data.clips.filter((item) => item.id !== id);
    store.touch();
    return ok();
  });

  ipcMain.handle('clip:pin', (_event, id) => {
    const data = store.get();
    const item = data.clips.find((entry) => entry.id === id);
    if (item) {
      item.pinned = !item.pinned;
      trimClips(data);
      store.touch();
    }
    return ok();
  });

  ipcMain.handle('clip:clear', (_event, keepPinned) => {
    const data = store.get();
    // 默认保留置顶条目，避免误删你特意收藏的内容
    data.clips = keepPinned === false ? [] : data.clips.filter((item) => item.pinned);
    store.touch();
    return ok();
  });

  ipcMain.handle('clip:add', (_event, text) => {
    if (typeof text === 'string' && text.trim()) pushClip(text);
    return ok();
  });

  /* ---------------- 设置与数据 ---------------- */

  ipcMain.handle('settings:update', (_event, patch) => {
    const data = updateSettings(patch);
    return { ok: true, data };
  });

  ipcMain.handle('data:export', () => {
    try {
      return ok({ dir: exportData() });
    } catch (err) {
      return { ok: false, message: String((err && err.message) || err), data: publicData() };
    }
  });

  ipcMain.handle('data:openFolder', async () => {
    const dir = await openDataFolder();
    return ok({ dir });
  });

  ipcMain.handle('app:openExternal', async (_event, url) => {
    const target = String(url || '');
    if (/^https?:\/\//i.test(target)) await shell.openExternal(target);
    return ok();
  });

  /* ---------------- 窗口 ---------------- */

  ipcMain.handle('win:hide', () => {
    if (win && !win.isDestroyed()) {
      savePositionNow();
      win.hide();
    }
    return ok();
  });

  ipcMain.handle('app:quit', () => {
    quitting = true;
    app.quit();
    return ok();
  });
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.on('window-all-closed', () => {
    // 故意留空：窗口收起后程序继续待在托盘里，这样才能到点提醒你
  });

  app.on('activate', () => showWindow());

  app.on('before-quit', () => {
    // 系统关机、任务管理器结束进程等场景也会走到这里，
    // 先标记成"真的要退出"，close 事件才不会去拦截它
    quitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (reminderTimer) clearInterval(reminderTimer);
    clipWatcher.stop();
    // 退出前把还没落盘的改动立刻写进去，避免丢掉最后几秒的操作
    store.save(true);
  });

  app.whenReady().then(() => {
    // Windows 上必须设置这个，系统通知才会显示成 DeskPet 而不是 Electron
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.deskpet.app');
    }

    store.load();
    registerIpc();
    applyLoginItem();
    createWindow();
    createTray();

    const shortcutReady = registerShortcut();
    if (!shortcutReady && win) {
      win.webContents.once('did-finish-load', () => {
        toast('快捷键被其他软件占用了，可在设置里换一个');
      });
    }

    startClipboardWatcher();
    startReminder();
  });
}
