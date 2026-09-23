'use strict';

/* ============================================================
   桌面悬浮球交互
   - 左键单击：展开 / 收起主面板
   - 右键单击：隐藏悬浮球（用全局快捷键可以叫回来）
   - 按住拖动：挪到桌面任意位置，松手后自动记住

   拖动必须自己算：无边框窗口如果用系统自带的拖动区域，
   点击事件会被系统吞掉，右键和单击就都废了。
   ============================================================ */

const api = window.deskpet;
const ball = document.getElementById('ball');

let pressed = false;
let dragging = false;
let startScreenX = 0;
let startScreenY = 0;
let baseX = 0;
let baseY = 0;
let currentX = 0;
let currentY = 0;
let moveFrame = null;
let pendingX = 0;
let pendingY = 0;

/* 记下悬浮球当前位置，拖动时以它为基准 */
api.getBallPosition().then((res) => {
  if (res) {
    currentX = res.x;
    currentY = res.y;
  }
});

function flushMove() {
  moveFrame = null;
  api.moveBall(pendingX, pendingY);
}

function scheduleMove(x, y) {
  pendingX = x;
  pendingY = y;
  if (moveFrame) return;
  moveFrame = requestAnimationFrame(flushMove);
}

function stopDragging() {
  pressed = false;
  dragging = false;
  if (moveFrame) {
    cancelAnimationFrame(moveFrame);
    moveFrame = null;
  }
}

ball.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();

  pressed = true;
  dragging = false;
  startScreenX = event.screenX;
  startScreenY = event.screenY;
  baseX = currentX;
  baseY = currentY;
});

window.addEventListener('mousemove', (event) => {
  if (!pressed) return;

  const dx = event.screenX - startScreenX;
  const dy = event.screenY - startScreenY;

  // 移动超过 4 像素才算拖动，免得手一抖就把单击吃掉
  if (!dragging && Math.abs(dx) + Math.abs(dy) < 4) return;

  dragging = true;
  currentX = baseX + dx;
  currentY = baseY + dy;
  scheduleMove(currentX, currentY);
});

window.addEventListener('mouseup', (event) => {
  if (!pressed) return;

  const wasDragging = dragging;
  const button = event.button;
  stopDragging();

  if (wasDragging) {
    // 补一次最终位置，防止最后一帧被节流掉
    api.moveBall(currentX, currentY);
    return;
  }

  if (button === 0) api.togglePanel();
});

window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  api.hideBall();
});

// 只有拖动过程中意外失焦才需要收拾状态。
// 平时失焦不能重置 pressed，否则会把单击吞掉。
window.addEventListener('blur', () => {
  if (!dragging) return;
  api.moveBall(currentX, currentY);
  stopDragging();
});
