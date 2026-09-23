"""
DeskPet 图标生成脚本
---------------------------------------------------------------
从设计稿 design/ball-icon-source.png 生成 assets 下所有图标：
  icon.png    512x512   应用图标（安装包、桌面快捷方式、窗口任务栏）
  tray.png     32x32    托盘图标（Windows 与 macOS 菜单栏共用）
  ball.png    256x256   桌面悬浮球

处理逻辑：沿水平中线找出设计稿里那个圆形的边界 -> 按圆心裁成正方形
-> 套一个圆形透明遮罩（把白色背景去掉）-> 缩放输出。

换了新设计稿？直接替换 design/ball-icon-source.png 再运行本脚本即可。
需要 Pillow：pip install Pillow
"""

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "design", "ball-icon-source.png")
OUT_DIR = os.path.join(ROOT, "assets")

SS = 4  # 超采样倍数：先放大处理再缩小，边缘才平滑


def find_circle(img):
    """
    沿图片水平中线扫描，找出主体圆形的左右边缘。
    用中线是因为那里只会穿过圆形本身，右上角的装饰短线不会干扰。
    """
    width, height = img.size
    pixels = img.convert("RGB").load()
    mid = height // 2

    left = None
    right = None
    for x in range(width):
        r, g, b = pixels[x, mid]
        if (255 - r) + (255 - g) + (255 - b) > 60:
            if left is None:
                left = x
            right = x

    if left is None or right is None or right - left < 10:
        return (width / 2, height / 2, min(width, height) / 2 - 2)

    return ((left + right) / 2, mid, (right - left) / 2)


def make_circle(img, cx, cy, radius, size):
    """按给定圆裁切，套圆形透明遮罩，输出 size×size 的 PNG"""
    big = size * SS
    scale = big / (radius * 2)

    resized = img.resize(
        (max(1, int(img.width * scale)), max(1, int(img.height * scale))),
        Image.LANCZOS,
    )
    box = (
        int(cx * scale - big / 2),
        int(cy * scale - big / 2),
        int(cx * scale + big / 2),
        int(cy * scale + big / 2),
    )

    cropped = resized.crop(box).convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
    cropped.putalpha(mask)

    return cropped.resize((size, size), Image.LANCZOS)


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f"找不到设计稿：{SRC}")

    source = Image.open(SRC).convert("RGB")
    cx, cy, radius = find_circle(source)
    print(f"设计稿 {source.size}，识别到圆形 圆心=({cx:.0f},{cy:.0f}) 半径={radius:.0f}")

    targets = [
        ("icon.png", 512),
        ("tray.png", 32),
        ("ball.png", 256),
    ]

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, size in targets:
        target = os.path.join(OUT_DIR, name)
        make_circle(source, cx, cy, radius, size).save(target)
        print("已生成", target)


if __name__ == "__main__":
    main()
