"""Generate 16x16 sprite PNGs using only Python stdlib."""
import struct, zlib, os

def png_bytes(pixels):
    """pixels: list of 16 rows, each 16 (r,g,b,a) tuples."""
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw = b''
    for row in pixels:
        raw += b'\x00'  # filter type None
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])

    ihdr = struct.pack('>IIBBBBB', 16, 16, 8, 2, 0, 0, 0)  # 8-bit RGB... wait need RGBA
    # Use color type 6 = RGBA
    ihdr = struct.pack('>II', 16, 16) + bytes([8, 6, 0, 0, 0])

    data = zlib.compress(raw)

    return (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr) +
        chunk(b'IDAT', data) +
        chunk(b'IEND', b'')
    )

T = (0, 0, 0, 0)        # transparent
SK = (244, 196, 138, 255)  # skin
EY = (34, 34, 34, 255)    # eyes
BD = (58, 111, 191, 255)  # body/shirt blue
LG = (26, 26, 46, 255)    # legs dark
FT = (139, 69, 19, 255)   # feet brown
HR = (80, 40, 10, 255)    # hair

def make_frame(f):
    # 16x16 grid, row 0 = top
    g = [[T]*16 for _ in range(16)]

    def px(r, c, col):
        if 0 <= r < 16 and 0 <= c < 16:
            g[r][c] = col

    def rect(r0, c0, h, w, col):
        for r in range(r0, r0+h):
            for c in range(c0, c0+w):
                px(r, c, col)

    # Hair
    rect(0, 6, 2, 4, HR)
    # Head
    rect(1, 5, 4, 6, SK)
    # Eyes
    px(2, 6, EY); px(2, 9, EY)
    # Torso
    rect(5, 5, 5, 6, BD)
    # Arms — frame 0: arms down; frame 1: left arm forward, right arm back
    if f == 0:
        rect(5, 3, 4, 2, BD)   # left arm
        rect(5, 11, 4, 2, BD)  # right arm
    else:
        rect(5, 3, 3, 2, BD)   # left arm shorter (swung forward)
        rect(6, 11, 4, 2, BD)  # right arm lower (swung back)
    # Legs
    if f == 0:
        rect(10, 5, 4, 2, LG)  # left leg
        rect(10, 9, 4, 2, LG)  # right leg
    else:
        rect(10, 5, 6, 2, LG)  # left leg long (forward step)
        rect(10, 9, 3, 2, LG)  # right leg short (back)
    # Feet
    rect(14, 4, 2, 3, FT)
    rect(14, 9, 2, 3, FT)

    return g

out_dir = os.path.dirname(os.path.abspath(__file__))
for i, label in enumerate(['a', 'b']):
    pixels = make_frame(i)
    path = os.path.join(out_dir, f'sprite001-{label}.png')
    with open(path, 'wb') as fh:
        fh.write(png_bytes(pixels))
    print(f'wrote {path}')
