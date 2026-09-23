'use strict';

/**
 * 剪贴板监听
 * ---------------------------------------------------------------
 * 系统本身不会"通知"程序说剪贴板变了，所以这里用轮询的方式：
 * 每隔 0.6 秒读一次剪贴板文字，和上一次比对，不一样就认为你刚复制了新内容。
 * 这是桌面剪贴板工具的通行做法，几乎不占资源。
 */

const { clipboard } = require('electron');

const POLL_INTERVAL = 600;

let timer = null;
let lastText = '';
let onNewText = null;

function read() {
  try {
    return String(clipboard.readText() || '');
  } catch (err) {
    return '';
  }
}

function poll() {
  const text = read();
  if (!text) return;
  if (text === lastText) return;
  lastText = text;
  if (typeof onNewText === 'function') onNewText(text);
}

/** 开始监听。callback(text) 会在检测到新的复制内容时被调用 */
function start(callback) {
  stop();
  onNewText = callback;
  // 把当前剪贴板内容记为"已知"，避免一启动就把上次遗留的旧内容记进去
  lastText = read();
  timer = setInterval(poll, POLL_INTERVAL);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function isRunning() {
  return timer !== null;
}

/**
 * 把文字写回系统剪贴板。
 * 写之前先把 lastText 设成同一内容，这样轮询不会把它当成"你新复制的东西"重复记录一遍。
 */
function write(text) {
  const value = String(text == null ? '' : text);
  lastText = value;
  try {
    clipboard.writeText(value);
    return true;
  } catch (err) {
    console.error('[clipboard] 写入剪贴板失败：', err);
    return false;
  }
}

module.exports = { start, stop, isRunning, write, read };
