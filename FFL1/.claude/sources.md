# ROM Research Sources

Reference guide for sources used in FFL1 ROM analysis. Includes commentary on reliability,
what each source is good for, and general guidance applicable to future Game Boy ROM work.

---

## FFL1-Specific Sources

### Data Crystal Wiki
- **URL**: `https://datacrystal.tcrf.net/wiki/The_Final_Fantasy_Legend` and `/ROM_map`
- **Direct fetch**: Returns 403; use web search to find cached/indexed content
- **Confirmed reliable for**: Character encoding table (`0x8A`=a…), bank layout, DTE encoding constants (`normalbase=$8A`, `dte1base=$50`, `dte2base=$C0`)
- **Less reliable for**: Data table strides (said "8 bytes" for stat table; FFLRandomizer source showed 9 bytes — always cross-check strides with a second source)
- **General GB guidance**: Data Crystal is the standard starting point for any GB/GBC/GBA ROM; most well-known games have at least a partial map. Check both the main page and the /ROM_map subpage.

### FFLRandomizer (eclipseyy/FFLRandomizer)
- **URL**: `https://github.com/eclipseyy/FFLRandomizer` — `randomize_ffl.py`
- **Reliability**: **HIGHEST** for data table offsets and strides — this code reads and writes the actual ROM bytes, so any offset it uses is verified by the fact that the randomizer works
- **Confirmed useful for**: Stat table stride (9 bytes), item table structure, shop addresses, chest addresses, encounter data, meat transformation table, mutant growth rates, guild data layout
- **How to use**: Read the Python source directly; any `data[offset]` or slice operation is a verified ROM read. Function names reveal which mechanic each offset controls.
- **General guidance**: **Always look for a working randomizer or ROM hack for the target game.** Randomizer source code is often the single most reliable public documentation of ROM data layout because it must be exactly right to produce a working ROM. Search GitHub for `<game name> randomizer` and inspect the source.

### TASVideos GameResources
- **URL**: `https://tasvideos.org/GameResources/GB/FinalFantasyLegend`
- **Direct fetch**: Returns 403; use web search
- **Confirmed reliable for**: RNG table structure (`0xC300`–`0xC37F`), per-event RNG isolation, mutant growth RNG address (`0xC30B`)
- **Less reliable for**: Exact WRAM addresses for stats/inventory (verify with a second source)
- **General GB guidance**: TASVideos game resources pages are excellent for RNG manipulation, frame timing, and WRAM addresses that matter for speedruns. Good for any game that has been TAS'd. Often includes lag frame analysis and optimal input sequences that reveal how the engine works.

### GameFAQs Save-State Hacking Guide (mafafu)
- **URL**: `https://gamefaqs.gamespot.com/gameboy/563273-the-final-fantasy-legend/faqs/30705`
- **Reliability**: LOW-MEDIUM — save-state file offsets are emulator-specific (SMYGB format); may not map directly to SRAM addresses in the ROM
- **Confirmed useful for**: Character data field layout (name, race/sex byte, HP, stats, item slots), race/sex byte encoding (`0xAD`=human-m, `0xAE`=human-f, `0xB3`=mutant-m, `0xB4`=mutant-f)
- **General guidance**: GameFAQs save-state guides are common for older games and reveal data layout, but verify that offsets match your ROM/emulator combination. Save-state offsets ≠ SRAM addresses.

### GameShark Codes (Almar's Guides)
- **URL**: `https://www.almarsguides.com/retro/walkthroughs/GameBoy/Games/FinalFantasyLegend/Gameshark/`
- **Reliability**: MEDIUM for WRAM addresses — GameShark format `01VVAAAA` directly encodes the WRAM address, so addresses are extractable with confidence. Values written are less reliable (may be approximate or differ by region).
- **Confirmed useful for**: Gold WRAM (`0xCC8D`–`0xCC8F`), character HP WRAM (`0xCC06`, `0xCC1F`, `0xCC38`, `0xCC51`), character stride (25 bytes between characters)
- **General GB guidance**: GameShark codes for GB/GBC are in format `01VVAAAA`. Extract the WRAM address from bytes 3-4 (reversed): `01 VV [lo] [hi]` → WRAM = `0x[hi][lo]`. This is one of the fastest ways to find WRAM addresses for any well-known GB game.

### savefiles.hacksy.dev
- **URL**: `https://savefiles.hacksy.dev/docs/gb/final-fantasy-legend/items`
- **Reliability**: LOW — found via search extract only; not independently verified
- **Confirmed useful for**: Item ID list (0x00=Potion, 0x01=XPotion, etc.), note that save file stores item IDs nibble-swapped
- **General guidance**: Save file documentation sites like this exist for many popular RPGs. Good for item/spell/character IDs but verify the encoding against the actual ROM.

---

## General Game Boy ROM Research Tools and Approaches

### BGB Debugger (HIGHEST VALUE for live analysis)
- **What it is**: Cycle-accurate GB emulator with built-in debugger, VRAM viewer, OAM viewer, memory map, disassembler
- **Best for**: Setting PC breakpoints to catch rendering routines; watching VRAM/OAM writes to identify sprite tile indices; tracing SRAM reads/writes to map save data; finding any runtime address by observing when a value changes
- **Key workflow**: Load ROM → trigger the screen/event you want to trace → set a write breakpoint on the relevant VRAM/OAM range → step through the code at the breakpoint to find the render routine
- **Download**: `https://bgb.bircd.org/`

### Ghidra + GB CPU Plugin (best for static analysis)
- **What it is**: NSA reverse engineering suite; GB plugin adds Z80/SM83 disassembly and memory map understanding
- **Best for**: Full static disassembly; finding all callers of a known function; analyzing code without running it
- **Limitation**: Bank switching makes automatic analysis miss cross-bank calls; manual bank tagging required
- **Plugin**: `https://github.com/Gekkio/ghidra-snes-lc-lc86k` (search for current GB plugin)

### No$GMB
- **What it is**: Older GB/GBC debugger; still useful for its disassembly view
- **Best for**: Quick inspection; sometimes finds things BGB misses due to different interpretation of edge cases

### Tile/Graphics Extraction (our current approach)
- **Tool**: Python + Pillow
- **1bpp tiles** (font/text): 8 bytes/tile; each byte = one row; bit 7 = leftmost pixel
- **2bpp tiles** (graphics): 16 bytes/tile; interleaved lo/hi bitplanes; 2 bytes/row
- **Workflow**: Load ROM bytes → slice the tile bank → decode pixels → Pillow Image → PNG
- **Advantage**: Scriptable, reproducible, no install beyond `pip install pillow`

### Searching for Rendering Routines
When you need to find where a screen is rendered:
1. **VRAM write breakpoint** (BGB): Set a write breakpoint on `0x9800`–`0x9BFF` (BG tilemap) or `0x8000`–`0x9FFF` (tile data). When it fires during screen init, the PC is in the render routine.
2. **OAM DMA** (for sprite screens): Set breakpoint on `0xFF46` (DMA register write). The DMA source address tells you where sprite data is staged.
3. **String search**: If the screen has text, find the text bytes in ROM → trace where they're copied to VRAM → that's the text render routine.
4. **Known data pointer**: If you know a data table offset (e.g., the name table at `0x14000`), set a read breakpoint on it — any code that reads those bytes is a name renderer.

### Finding WRAM Addresses for Any Value
1. Load ROM in BGB or similar debugger with memory search
2. Note the value you want to track (e.g., current HP = 45)
3. Search RAM for `0x2D` (45 decimal)
4. Take a hit, reducing HP to 38 → search remaining candidates for `0x26`
5. Repeat until 1–2 candidates remain — that's the WRAM address
6. Cross-reference with GameShark codes if available

---

## Source Reliability Ranking (for Game Boy ROM work generally)

| Rank | Source type | Why |
|---|---|---|
| 1 | Working randomizer / ROM hack source code | Must be exactly right; directly reads/writes ROM bytes |
| 2 | BGB breakpoint tracing (live) | Observes actual hardware behavior |
| 3 | TASVideos game resources | Verified by TAS authors who need exact addresses |
| 4 | Data Crystal ROM map | Community-maintained; usually correct but may lag or have errors |
| 5 | GameShark codes | WRAM addresses are encoded directly in the code format |
| 6 | GameFAQs hacking guides | Useful layouts but often emulator-specific |
| 7 | Fan wikis / walkthroughs | Game behavior, not internal addresses |
