# FFL1 Dialog & Story Text

All text in this file must be marked with a confidence level:
- **HIGH** = directly extracted from ROM binary
- **MEDIUM** = web-sourced; structure/content plausible but not verified against ROM binary
- **LOW** = guessed or inferred; needs verification before treating as authoritative

---

## Intro / Opening Story

**Confidence: MEDIUM** (web-sourced; needs ROM DTE decode for verification)

Note: Story text in the ROM is DTE-compressed (see rom-data.md §DTE). Every English bigram
is encoded as a single byte via the DTE1/DTE2 tables, making raw-byte searching impossible
without a full DTE decoder. The text below matches the emulator screenshot sequence but
has not been verified byte-by-byte against the ROM binary.

```
IT HAS BEEN SAID
THAT THE TOWER IN
THE CENTER OF THE
WORLD IS CONNECTED
TO PARADISE.

DREAMING OF A LIFE
IN PARADISE, MANY
HAVE CHALLENGED
THE SECRET OF THE
TOWER, BUT NO ONE
KNOWS WHAT BECAME
OF THEM.

NOW THERE IS
ANOTHER WHO WILL
BRAVE THE ADVENTURE
...
```

---

## UI Strings (Bank 3, confirmed from ROM)

**Confidence: HIGH** — found at ROM 0x0ECC8, normalbase encoding, confirmed via byte-by-byte read.

- `start`
- `continue`
- `fight`
- `run`
- `item`

---

## Sections Not Yet Extracted

- Guild NPC dialog (join-party offer)
- Town NPC dialog
- Boss pre-battle text
- Game-over text
- Crystal ball / save-point text
- Victory / level-up messages
