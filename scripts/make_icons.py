"""產生 PWA 需要的 PNG 圖示（Android 安裝、iOS 主畫面）。

用法（Pillow 只安裝在專案的 .venv 開發群組中）：
    uv run --group dev scripts/make_icons.py

輸出：
    web/icons/icon-192.png、icon-512.png、icon-maskable-512.png、apple-touch-icon.png
圖案與 web/icons/icon.svg 相同（葉片 + 放大鏡）。
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "web" / "icons"
S = 4  # 超取樣倍率，縮小後邊緣較平滑


def leaf_polygon(cx: float, top: float, bottom: float, half_w: float, n: int = 60) -> list[tuple[float, float]]:
    """以兩條弧線組成的葉片外形。"""
    import math

    pts = []
    for i in range(n + 1):
        t = i / n
        y = top + (bottom - top) * t
        w = half_w * math.sin(math.pi * t) ** 0.8
        pts.append((cx + w, y))
    for i in range(n, -1, -1):
        t = i / n
        y = top + (bottom - top) * t
        w = half_w * math.sin(math.pi * t) ** 0.8
        pts.append((cx - w, y))
    return pts


def draw_icon(size: int, maskable: bool = False) -> Image.Image:
    big = size * S
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = big / 512

    # 背景（maskable 圖示需填滿整個畫布，安全區在中央 80%）
    if maskable:
        d.rectangle([0, 0, big, big], fill=(47, 107, 42))
        scale, off = 0.78, big * 0.11
    else:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(112 * k), fill=(47, 107, 42))
        scale, off = 1.0, 0

    def p(x: float, y: float) -> tuple[float, float]:
        return (off + x * k * scale, off + y * k * scale)

    # 葉片
    leaf = [p(x, y) for x, y in leaf_polygon(236, 92, 404, 130)]
    d.polygon(leaf, fill=(155, 224, 122))
    lw = max(1, int(12 * k * scale))
    vein = (47, 122, 40)
    d.line([p(236, 404), p(236, 120)], fill=vein, width=lw)
    for y0, y1, dx in [(330, 286, 66), (260, 214, 74), (196, 160, 52)]:
        d.line([p(236, y0), p(236 - dx, y1)], fill=vein, width=lw)
        d.line([p(236, y0), p(236 + dx, y1)], fill=vein, width=lw)
    # 病斑
    for cx, cy, r in [(200, 248, 16), (276, 300, 12)]:
        a, b = p(cx - r, cy - r), p(cx + r, cy + r)
        d.ellipse([a, b], fill=(138, 90, 43))
    # 放大鏡
    a, b = p(340 - 74, 340 - 74), p(340 + 74, 340 + 74)
    d.ellipse([a, b], outline=(255, 255, 255), width=int(26 * k * scale))
    d.line([p(394, 394), p(448, 448)], fill=(255, 255, 255), width=int(34 * k * scale))

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    targets = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, True),  # iOS 會自動加圓角，故用滿版
    }
    for name, (size, maskable) in targets.items():
        draw_icon(size, maskable).save(OUT / name, optimize=True)
        print("已產生", name)


if __name__ == "__main__":
    main()
