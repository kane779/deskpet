"""
把界面截图和悬浮球合成一张封面图（README 的第一张图）。

前提：screenshots/01-待办.png 已经存在（由 tools/make-screenshots.ps1 生成）。
需要 Pillow：pip install Pillow
"""

import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "screenshots")

panel_src = Image.open(os.path.join(SHOTS, "01-待办.png")).convert("RGBA")
# 截图四周留了 24px 的背景边距，先裁掉
panel = panel_src.crop((24, 24, panel_src.width - 24, panel_src.height - 24))

scale = 640 / panel.height
panel = panel.resize((int(panel.width * scale), 640), Image.LANCZOS)

ball = Image.open(os.path.join(ROOT, "assets", "ball.png")).convert("RGBA")
ball = ball.resize((104, 104), Image.LANCZOS)

WIDTH, HEIGHT = 1040, 720
canvas = Image.new("RGBA", (WIDTH, HEIGHT))
draw = ImageDraw.Draw(canvas)

# 很淡的竖向渐变，像桌面背景
for y in range(HEIGHT):
    t = y / (HEIGHT - 1)
    draw.line(
        [(0, y), (WIDTH, y)],
        fill=(int(238 - 12 * t), int(240 - 12 * t), int(246 - 10 * t), 255),
    )

panel_x = 620
panel_y = (HEIGHT - panel.height) // 2
canvas.paste(panel, (panel_x, panel_y), panel)

ball_x = panel_x - ball.width - 34
ball_y = (HEIGHT - ball.height) // 2
canvas.paste(ball, (ball_x, ball_y), ball)

target = os.path.join(SHOTS, "00-悬浮球与面板.png")
canvas.convert("RGB").save(target)
print("已生成", target)
