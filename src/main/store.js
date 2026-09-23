'use strict';

/**
 * 本地数据存储
 * ---------------------------------------------------------------
 * 所有数据都存在你自己电脑上的一个 JSON 文件里，不联网、不上传。
 * 文件位置：
 *   Windows  C:\Users\你的用户名\AppData\Roaming\DeskPet\data.json
 *   macOS    ~/Library/Application Support/DeskPet/data.json
 * 你可以直接复制这个文件做备份，也可以用记事本打开查看。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

let dataFilePath = null;
let cache = null;
let saveTimer = null;

/** 数据文件的完整路径（需要 app 就绪后才能取到） */
function dataFile() {
  if (!dataFilePath) {
    dataFilePath = path.join(app.getPath('userData'), 'data.json');
  }
  return dataFilePath;
}

/** 默认数据结构 */
function defaults() {
  return {
    version: 1,
    settings: {
      launchAtLogin: false,
      clipboardEnabled: true,
      clipboardLimit: 200,
      ballVisible: true,
      shortcut: 'CommandOrControl+Shift+V'
    },
    window: { x: null, y: null, ballX: null, ballY: null },
    memos: [],
    todos: [],
    clips: []
  };
}

/** 生成一个短随机 ID */
function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 读取数据；第一次运行会自动建好文件并放一条示例待办 */
function load() {
  if (cache) return cache;

  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch (err) {
    raw = null;
  }

  const data = defaults();

  if (raw && typeof raw === 'object') {
    if (raw.settings && typeof raw.settings === 'object') {
      Object.assign(data.settings, raw.settings);
    }
    if (raw.window && typeof raw.window === 'object') {
      Object.assign(data.window, raw.window);
    }
    if (Array.isArray(raw.memos)) data.memos = raw.memos;
    if (Array.isArray(raw.todos)) data.todos = raw.todos;
    if (Array.isArray(raw.clips)) data.clips = raw.clips;
  } else {
    const memoId = uid();
    data.memos.push({ id: memoId, name: '我的待办', createdAt: Date.now() });
    data.todos.push({
      id: uid(),
      memoId,
      text: '点左边的圆圈，就能打钩划掉',
      done: false,
      createdAt: Date.now(),
      doneAt: null,
      dueAt: null,
      notified: false
    });
  }

  cache = data;
  save(true);
  return cache;
}

/** 写回磁盘。immediate 为真时立刻写入，否则合并 200 毫秒内的多次改动 */
function save(immediate) {
  if (!cache) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const write = () => {
    try {
      const file = dataFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // 先写临时文件再改名，避免断电/崩溃时把原数据写坏
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error('[store] 保存数据失败：', err);
    }
  };

  if (immediate) write();
  else saveTimer = setTimeout(write, 200);
}

function get() {
  return load();
}

/** 标记数据有改动，稍后保存 */
function touch() {
  save(false);
  return cache;
}

/** 标记数据有改动，立刻保存 */
function touchNow() {
  save(true);
  return cache;
}

module.exports = { dataFile, defaults, uid, load, get, save, touch, touchNow, clone };
