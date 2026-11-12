"""Google Play graphics for VeiloScan Business: icon, feature graphic, phone screenshots."""
# Usage: python3 -I make_graphics.py <app repo> raw .   (raw = 720x1600 demo-mode captures)
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(sys.argv[1])          # the app repo
SHOTS = Path(sys.argv[2])         # raw device screenshots (720x1600)
OUT = Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "screenshots").mkdir(exist_ok=True)

FONTS = ROOT / "src/assets/fonts"
def font(weight, size):
    return ImageFont.truetype(str(FONTS / f"Geist-{weight}.ttf"), size)

NAVY = (6, 27, 58)
NAVY_2 = (11, 52, 120)
ORANGE = (255, 107, 0)
WHITE = (255, 255, 255)
MARK_WHITE = Image.open(ROOT / "src/assets/brand/logo-mark-white.png").convert("RGBA")


def gradient(size, top, bottom, diagonal=True):
    """Smooth top-left → bottom-right blend (no rotation, so no hard edges)."""
    w, h = size
    base = Image.new("RGB", size, top)
    vertical = Image.linear_gradient("L").resize((w, h))
    if diagonal:
        horizontal = Image.linear_gradient("L").rotate(90).transpose(Image.FLIP_LEFT_RIGHT).resize((w, h))
        mask = Image.blend(vertical, horizontal, 0.4)
    else:
        mask = vertical
    return Image.composite(Image.new("RGB", size, bottom), base, mask)


def glow(canvas, center, radius, color, strength=150):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color + (strength,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.45))
    canvas.alpha_composite(layer)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


# ---------------------------------------------------------------- icon 512
def make_icon():
    s = 512
    bg = gradient((s, s), NAVY_2, NAVY).convert("RGBA")
    glow(bg, (430, 470), 190, ORANGE, 120)
    mark = MARK_WHITE.resize((350, 350), Image.LANCZOS)
    bg.alpha_composite(mark, ((s - 350) // 2, (s - 350) // 2 - 6))
    bg.convert("RGB").save(OUT / "icon-512.png", optimize=True)


# --------------------------------------------------------- screenshot frames
def status_bar(width, height=58):
    bar = Image.new("RGB", (width, height), WHITE)
    d = ImageDraw.Draw(bar)
    d.text((34, height // 2), "9:41", font=font("SemiBold", 30), fill=(15, 23, 42), anchor="lm")
    # signal, wifi-ish and battery, drawn simply
    x = width - 150
    for i in range(4):
        h = 8 + i * 5
        d.rounded_rectangle((x + i * 9, height // 2 + 10 - h, x + i * 9 + 6, height // 2 + 10), 2, fill=(15, 23, 42))
    bx = width - 92
    d.rounded_rectangle((bx, height // 2 - 11, bx + 46, height // 2 + 11), 6, outline=(15, 23, 42), width=3)
    d.rounded_rectangle((bx + 5, height // 2 - 6, bx + 35, height // 2 + 6), 3, fill=(15, 23, 42))
    d.rounded_rectangle((bx + 48, height // 2 - 5, bx + 52, height // 2 + 5), 2, fill=(15, 23, 42))
    return bar


def phone(shot_path, width):
    """The app screen (device status and nav bars cropped) in a slim dark phone frame."""
    raw = Image.open(shot_path).convert("RGB")
    screen = raw.crop((0, 70, 720, 1510))                    # app header … bottom tabs
    sb = status_bar(720, 52)
    full = Image.new("RGB", (720, sb.height + screen.height), WHITE)
    full.paste(sb, (0, 0))
    full.paste(screen, (0, sb.height))
    k = width / 830                                          # everything scales with the phone
    bezel, outer_r, inner_r = max(5, round(22 * k)), round(78 * k), round(58 * k)
    inner_w = width - 2 * bezel
    scale = inner_w / full.width
    full = full.resize((inner_w, round(full.height * scale)), Image.LANCZOS)
    frame = Image.new("RGBA", (width, full.height + 2 * bezel), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, width - 1, frame.height - 1), outer_r, fill=(14, 20, 34, 255))
    d.rounded_rectangle((2, 2, width - 3, frame.height - 3), outer_r - 2, outline=(60, 72, 96, 255), width=max(1, round(2 * k)))
    frame.alpha_composite(rounded(full, inner_r), (bezel, bezel))
    # camera punch-hole
    cx, r, cy = width // 2, max(3, round(11 * k)), bezel + round(21 * k)
    d = ImageDraw.Draw(frame)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(14, 20, 34, 255))
    return frame


def shadow_of(img, blur=40, opacity=110, offset=(0, 30)):
    a = img.split()[-1].point(lambda v: opacity if v else 0)
    sh = Image.new("RGBA", (img.width + 2 * blur * 2, img.height + 2 * blur * 2), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (0, 0, 0, 255)), (blur * 2, blur * 2), a)
    return sh.filter(ImageFilter.GaussianBlur(blur)), (offset[0] - blur * 2, offset[1] - blur * 2)


def wrap(text, fnt, max_w, draw):
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = f"{line} {w}".strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            line = trial
        else:
            lines.append(line)
            line = w
    lines.append(line)
    if len(lines) == 2:  # balance two lines, so no single word sits alone
        words = text.split()
        best = min(range(1, len(words)), key=lambda k: max(draw.textlength(" ".join(words[:k]), font=fnt), draw.textlength(" ".join(words[k:]), font=fnt)))
        lines = [" ".join(words[:best]), " ".join(words[best:])]
    return lines


SCREENS = [
    ("d-home", "Your whole store in your pocket", "Today's sales, orders and customers at a glance"),
    ("d-orders", "Never miss an order", "New, accepted and ready orders in one list"),
    ("d-order", "Accept, pack and hand over", "Move every pickup order along with one tap"),
    ("d-credit", "Track every rupee on credit", "Due dates, reminders and collections in one place"),
    ("d-customers", "Know your regular customers", "Purchases, credit and history for each customer"),
    ("d-reports", "See how your shop is doing", "Sales, profit and trends by day, week or month"),
    ("d-stock", "Restock before you run out", "Low and out-of-stock items, with what to reorder"),
]


def make_screenshots():
    W, H = 1080, 1920
    for i, (name, title, sub) in enumerate(SCREENS, 1):
        canvas = gradient((W, H), NAVY_2, NAVY).convert("RGBA")
        glow(canvas, (W - 60, 120), 260, ORANGE, 70)
        glow(canvas, (80, H - 200), 320, (40, 110, 255), 60)
        d = ImageDraw.Draw(canvas)
        # caption
        ft, fs = font("ExtraBold", 68), font("Medium", 38)
        y = 128
        for line in wrap(title, ft, W - 140, d):
            d.text((W // 2, y), line, font=ft, fill=WHITE, anchor="mt")
            y += 82
        d.rounded_rectangle((W // 2 - 44, y + 6, W // 2 + 44, y + 14), 4, fill=ORANGE)
        y += 40
        for line in wrap(sub, fs, W - 180, d):
            d.text((W // 2, y), line, font=fs, fill=(203, 213, 225), anchor="mt")
            y += 50
        # phone rising from the bottom edge
        ph = phone(SHOTS / f"{name}.png", 830)
        top = max(y + 46, 470)
        sh, off = shadow_of(ph)
        canvas.alpha_composite(sh, ((W - ph.width) // 2 + off[0], top + off[1]))
        canvas.alpha_composite(ph, ((W - ph.width) // 2, top))
        canvas.convert("RGB").save(OUT / "screenshots" / f"{i:02d}-{name.removeprefix('d-')}.png", optimize=True)


# ------------------------------------------------------ feature graphic 1024x500
def make_feature():
    W, H = 1024, 500
    canvas = gradient((W, H), NAVY_2, NAVY).convert("RGBA")
    glow(canvas, (980, 470), 260, ORANGE, 110)
    glow(canvas, (120, 40), 200, (40, 110, 255), 70)
    d = ImageDraw.Draw(canvas)
    mark = MARK_WHITE.resize((92, 92), Image.LANCZOS)
    canvas.alpha_composite(mark, (56, 92))
    fw = font("ExtraBold", 58)
    d.text((160, 104), "Veilo", font=fw, fill=WHITE)
    d.text((160 + d.textlength("Veilo", font=fw), 104), "Scan", font=fw, fill=ORANGE)
    d.text((163, 170), "B U S I N E S S", font=font("SemiBold", 21), fill=(203, 213, 225))
    fh = font("Bold", 40)
    d.text((58, 250), "Run your store", font=fh, fill=WHITE)
    d.text((58, 298), "from your phone", font=fh, fill=WHITE)
    d.text((58, 368), "Orders · Billing · Credit · Stock · Reports", font=font("Medium", 21), fill=(255, 179, 128))
    # two phones on the right
    for name, x, y, w, ang in [("d-reports", 760, 70, 230, -6), ("d-home", 585, 120, 250, 0)]:
        ph = phone(SHOTS / f"{name}.png", w)
        if ang:
            ph = ph.rotate(ang, resample=Image.BICUBIC, expand=True)
        sh, off = shadow_of(ph, blur=18, opacity=120, offset=(0, 14))
        canvas.alpha_composite(sh, (x + off[0], y + off[1]))
        canvas.alpha_composite(ph, (x, y))
    canvas.convert("RGB").save(OUT / "feature-graphic-1024x500.png", optimize=True)


make_icon()
make_screenshots()
make_feature()
print("done", sorted(p.name for p in OUT.rglob("*.png")))
