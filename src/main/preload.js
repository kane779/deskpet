'use strict';

/**
 * 主进程与界面之间的"安全通道"
 * ---------------------------------------------------------------
 * 界面层不能直接碰系统能力，所有操作都要经过这里转交给主进程。
 * 这样即使页面出问题，也不会伤到你的电脑。
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('deskpet', {
  /* 一次性取回全部数据 */
  loadAll: () => invoke('data:loadAll'),

  /* 待办 */
  addTodo: (payload) => invoke('todo:add', payload),
  toggleTodo: (id) => invoke('todo:toggle', id),
  updateTodo: (id, patch) => invoke('todo:update', id, patch),
  removeTodo: (id) => invoke('todo:remove', id),
  clearDoneTodos: (memoId) => invoke('todo:clearDone', memoId),

  /* 备忘录 */
  addMemo: (name) => invoke('memo:add', name),
  renameMemo: (id, name) => invoke('memo:rename', id, name),
  removeMemo: (id) => invoke('memo:remove', id),

  /* 剪贴板 */
  copyClip: (id) => invoke('clip:copy', id),
  removeClip: (id) => invoke('clip:remove', id),
  togglePin: (id) => invoke('clip:pin', id),
  clearClips: () => invoke('clip:clear'),
  addClipManually: (text) => invoke('clip:add', text),

  /* 设置与数据 */
  updateSettings: (patch) => invoke('settings:update', patch),
  exportData: () => invoke('data:export'),
  openDataFolder: () => invoke('data:openFolder'),
  openExternal: (url) => invoke('app:openExternal', url),
  getInfo: () => invoke('app:info'),

  /* 窗口 */
  hideWindow: () => invoke('win:hide'),
  quitApp: () => invoke('app:quit'),

  /* 悬浮球 */
  getBallPosition: () => invoke('ball:position'),
  moveBall: (x, y) => invoke('ball:move', x, y),
  togglePanel: () => invoke('ball:toggle'),
  hideBall: () => invoke('ball:hide'),

  /* 主进程主动推给界面的消息 */
  onDataChanged: (callback) => {
    ipcRenderer.on('data:changed', (_event, payload) => callback(payload));
  },
  onSwitchTab: (callback) => {
    ipcRenderer.on('switch-tab', (_event, tab) => callback(tab));
  },
  onToast: (callback) => {
    ipcRenderer.on('toast', (_event, message) => callback(message));
  }
});
