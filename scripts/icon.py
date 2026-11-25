# Draws the Even Hub icon (branding/icon.png): the site's rising-odds line on a 12x12 grid, each cell a 2x2 block
# of #F4F4F4 on transparent, which is the only format `evenhub update --icon` accepts. Run: python3 scripts/icon.py
import struct, zlib, os

GRID = [  # 12x12, '#' = lit cell: a line that rises, dips, then climbs to a dot
    "............",
    "............",
    ".........##.",
    ".........##.",
    "........#...",
    ".......#....",
    "......#.....",
    "..#..#......",
    ".#.##.......",
    "#...........",
    "............",
    "............",
]
LIT = (0xF4, 0xF4, 0xF4, 0xFF)
OFF = (0, 0, 0, 0)

rows = []
for y in range(24):
    row = b"\x00"  # filter: none
    for x in range(24):
        row += bytes(LIT if GRID[y // 2][x // 2] == "#" else OFF)
    rows.append(row)

def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 24, 24, 8, 6, 0, 0, 0)) \
    + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
out = os.path.join(os.path.dirname(__file__), "..", "branding", "icon.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "wb").write(png)
print("\n".join(r.replace(".", " ").replace("#", "█") for r in GRID))
print(f"wrote {os.path.normpath(out)} ({len(png)} bytes)")
