#!/usr/bin/env python3
"""Derive the PWA icons from public/icon.png. Pure stdlib, no image libraries.

    python3 scripts/make-icons.py

Reads the master artwork and writes:

    icon-192.png            transparent, as-is
    icon-512.png            transparent, as-is
    icon-maskable-512.png   opaque, inset into the maskable safe zone
    apple-touch-icon.png    opaque 180px (iOS composites transparency on black)

Re-run it whenever public/icon.png changes.
"""
import math
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "..", "public")
MASTER = os.path.join(PUBLIC, "icon.png")

# Fallback background for the opaque variants, used only if the artwork has no
# transparency to sample around. Normally edge_color() picks it up from the art.
BG_FALLBACK = (16, 100, 212)


# ------------------------------------------------------------------ read ---
def read_png(path):
    """Minimal decoder: 8-bit non-interlaced, colour type 2 (RGB) or 6 (RGBA)."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("%s is not a PNG" % path)

    pos, idat, hdr = 8, [], None
    while pos < len(data):
        (n,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + n]
        if tag == b"IHDR":
            hdr = struct.unpack(">IIBBBBB", body)
        elif tag == b"IDAT":
            idat.append(body)
        elif tag == b"IEND":
            break
        pos += 12 + n

    w, h, depth, ctype, comp, filt, interlace = hdr
    if depth != 8 or interlace != 0 or ctype not in (2, 6):
        raise SystemExit(
            "unsupported PNG (depth=%d colour=%d interlace=%d); re-export "
            "public/icon.png as an 8-bit non-interlaced RGB or RGBA PNG"
            % (depth, ctype, interlace))

    ch = 4 if ctype == 6 else 3
    raw = zlib.decompress(b"".join(idat))
    stride = w * ch
    out, prev = [], bytearray(stride)
    pos = 0
    for _ in range(h):
        ft = raw[pos]
        line = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        for i in range(stride):
            a = line[i - ch] if i >= ch else 0
            b = prev[i]
            c = prev[i - ch] if i >= ch else 0
            if ft == 1:
                line[i] = (line[i] + a) & 0xFF
            elif ft == 2:
                line[i] = (line[i] + b) & 0xFF
            elif ft == 3:
                line[i] = (line[i] + (a + b) // 2) & 0xFF
            elif ft == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        if ch == 3:  # normalise to RGBA
            rgba = bytearray(w * 4)
            for x in range(w):
                rgba[x * 4:x * 4 + 3] = line[x * 3:x * 3 + 3]
                rgba[x * 4 + 3] = 255
            line = rgba
        out.append(line)
        prev = line if ch == 4 else prev
    return w, h, out


# --------------------------------------------------------------- resample ---
def box_resize(src, sw, sh, dw, dh):
    """Area-average downscale. Premultiplies alpha so edges do not fringe."""
    out = []
    for dy in range(dh):
        y0, y1 = dy * sh // dh, max(dy * sh // dh + 1, (dy + 1) * sh // dh)
        row = bytearray(dw * 4)
        for dx in range(dw):
            x0, x1 = dx * sw // dw, max(dx * sw // dw + 1, (dx + 1) * sw // dw)
            r = g = b = a = n = 0
            for y in range(y0, y1):
                line = src[y]
                for x in range(x0, x1):
                    i = x * 4
                    al = line[i + 3]
                    r += line[i] * al
                    g += line[i + 1] * al
                    b += line[i + 2] * al
                    a += al
                    n += 1
            if a:
                row[dx * 4] = min(255, r // a)
                row[dx * 4 + 1] = min(255, g // a)
                row[dx * 4 + 2] = min(255, b // a)
            row[dx * 4 + 3] = a // n if n else 0
        out.append(row)
    return out


def edge_color(rows, w, h):
    """The artwork's own colour just inside its outer edge.

    The opaque variants inset the art and fill the rest; filling with a colour
    the art does not contain leaves a visible ring around it. Sampling a ring
    at 88% of the radius picks up the badge's border instead, so the fill reads
    as a continuation of the mark. Median, not mean, so the few samples that
    land on a lighter detail do not drag the colour up.
    """
    seen = []
    for i in range(72):
        a = 2 * math.pi * i / 72
        x = int(w / 2 + w * 0.44 * math.cos(a))
        y = int(h / 2 + h * 0.44 * math.sin(a))
        if not (0 <= x < w and 0 <= y < h):
            continue
        px = rows[y][x * 4:x * 4 + 4]
        if px[3] > 250:
            seen.append(tuple(px[:3]))
    if not seen:
        return BG_FALLBACK
    return tuple(sorted(s[c] for s in seen)[len(seen) // 2] for c in range(3))


def on_background(fg, size, inset, bg):
    """Centre `fg` on an opaque `bg` square, leaving `inset` of margin."""
    inner = int(round(size * (1 - 2 * inset)))
    small = box_resize(fg, len(fg[0]) // 4, len(fg), inner, inner)
    off = (size - inner) // 2
    out = [bytearray(bytes(bg) + b"\xff") * size for _ in range(size)]
    for y in range(inner):
        line = small[y]
        dst = out[y + off]
        for x in range(inner):
            i, j = x * 4, (x + off) * 4
            al = line[i + 3]
            if not al:
                continue
            for k in range(3):
                dst[j + k] = (line[i + k] * al + dst[j + k] * (255 - al)) // 255
            dst[j + 3] = 255
    return out


# ----------------------------------------------------------------- write ---
def write_png(path, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    size = len(rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("%-24s %d x %d  %d bytes" % (os.path.basename(path), size, size, len(png)))


w, h, src = read_png(MASTER)
if w != h:
    print("warning: %dx%d master is not square, output will be squashed" % (w, h))
BG = edge_color(src, w, h)
print("master %dx%d, background #%02x%02x%02x" % ((w, h) + BG))
print("(use that colour for theme_color in vite.config.js and the theme-color")
print(" meta in index.html, so the PWA chrome matches the mark)")

write_png(os.path.join(PUBLIC, "icon-192.png"), box_resize(src, w, h, 192, 192))
write_png(os.path.join(PUBLIC, "icon-512.png"), box_resize(src, w, h, 512, 512))
# Maskable icons get cropped to a circle or squircle: keep the art inside the
# safe zone and fill the corners, since transparency is not allowed to show.
write_png(os.path.join(PUBLIC, "icon-maskable-512.png"),
          on_background(src, 512, 0.13, BG))
# iOS ignores the manifest and composites transparency on black, so this one
# is opaque too.
write_png(os.path.join(PUBLIC, "apple-touch-icon.png"),
          on_background(src, 180, 0.02, BG))
