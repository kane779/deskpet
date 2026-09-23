"""
DeskPet 图标生成脚本
---------------------------------------------------------------
运行一次即可生成 assets 目录下的图标文件：
  icon.png            512x512，应用图标（安装包、桌面快捷方式、窗口）
  tray.png            32x32，托盘图标，浅色，用于 Windows
  trayTemplate.png    32x32，托盘图标，纯黑透明，用于 macOS 菜单栏

想换图标风格？改下面的颜色常量后重新运行本脚本即可。
需要 Pillow：pip install Pillow
"""

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "assets"))
os.makedirs(OUT_DIR, exist_ok=True)

SS = 4  # 超采样倍数：先画大图再缩小，边缘才平滑

BG_TOP = (124, 152, 255)
BG_BOTTOM = (72, 96, 214)
ACCENT_DARK = (72, 96, 214, 255)
WHITE = (255, 255, 255, 255)
TRAY_LIGHT = (222, 225, 234, 255)
TRAY_BLACK = (0, 0, 0, 255)


def lerp(a, b, t):
    return a + (b - a) * t


def vertical_gradient(size, top, bottom):
    """从上到下的线性渐变"""
    img = Image.new("RGB", (size, size), top)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        draw.line(
            [(0, y), (size, y)],
            fill=(
                int(lerp(top[0], bottom[0], t)),
                int(lerp(top[1], bottom[1], t)),
                int(lerp(top[2], bottom[2], t)),
            ),
        )
    return img


def hline(draw, x1, x2, y, width, color):
    """画一条圆头横线"""
    draw.rounded_rectangle(
        [int(x1), int(y - width / 2), int(x2), int(y + width / 2)],
        radius=max(1, width // 2),
        fill=color,
    )


def check_mark(draw, left, top, box, width, color):
    """在一个方框内画对勾"""
    draw.line(
        [
            (int(left + box * 0.24), int(top + box * 0.52)),
            (int(left + box * 0.44), int(top + box * 0.72)),
            (int(left + box * 0.78), int(top + box * 0.28)),
        ],
        fill=color,
        width=max(2, width),
        joint="curve",
    )


def draw_list_symbol(draw, size, rows=3, main_color=WHITE, accent_color=ACCENT_DARK):
    """
    应用图标里的"待办清单"符号：
    第一行是已打钩的实心方框，其余是空方框。
    """
    top, bottom = 0.285, 0.715
    step = (bottom - top) / max(1, rows - 1)

    box = 0.118 * size
    marker_cx = 0.355 * size
    text_x1 = 0.482 * size
    text_len = 0.200 * size
    line_width = max(2, int(size * 0.040))
    box_width = max(2, int(size * 0.026))

    for index in range(rows):
        cy = (top + index * step) * size
        left = marker_cx - box / 2
        box_top = cy - box / 2

        if index == 0:
            draw.rounded_rectangle(
                [int(left), int(box_top), int(left + box), int(box_top + box)],
                radius=int(box * 0.30),
                fill=main_color,
            )
            check_mark(draw, left, box_top, box, int(box_width * 0.95), accent_color)
        else:
            draw.rounded_rectangle(
                [int(left), int(box_top), int(left + box), int(box_top + box)],
                radius=int(box * 0.30),
                outline=main_color,
                width=box_width,
            )

        length = text_len if index != rows - 1 else text_len * 0.72
        hline(draw, text_x1, text_x1 + length, cy, line_width, main_color)


def build_app_icon():
    size = 512 * SS
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(vertical_gradient(size, BG_TOP, BG_BOTTOM), (0, 0))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * 0.225), fill=255
    )
    icon.putalpha(mask)

    draw_list_symbol(ImageDraw.Draw(icon), size, rows=3)
    return icon.resize((512, 512), Image.LANCZOS)


def build_tray(color):
    """
    托盘图标要能在 16~32 像素下看清，所以只保留一个"带勾的方框"。
    """
    size = 128 * SS
    tray = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tray)

    line_width = max(2, int(size * 0.080))
    margin = int(size * 0.16)
    box = size - margin * 2

    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.17),
        outline=color,
        width=line_width,
    )
    check_mark(draw, margin, margin, box, line_width, color)

    return tray.resize((32, 32), Image.LANCZOS)


def main():
    targets = [
        ("icon.png", build_app_icon()),
        ("tray.png", build_tray(TRAY_LIGHT)),
        ("trayTemplate.png", build_tray(TRAY_BLACK)),
    ]

    for name, image in targets:
        target = os.path.join(OUT_DIR, name)
        image.save(target)
        print("generated:", target)


if __name__ == "__main__":
    main()
