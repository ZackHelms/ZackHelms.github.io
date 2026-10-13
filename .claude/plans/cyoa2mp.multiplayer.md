# cyoa2mp - CYOA2 step 4: other phones at the table

**Status:** IMPLEMENTED 2026-10-13 (the CD's four answers; the rest is in "Assumed" below and in `.claude/cyoa2.md`)
**Requested:** 2026-10-09 (roadmap step 4), answered 2026-10-13.
**Scope:** `games/cyoa2/index.html` (new QR CODES and TOGETHER sections, a Players
panel, guest mode), `.claude/tests/drive-cyoa2.cjs` (section 2), `.claude/cyoa2.md`.

## Goal

A host's phone runs the tale exactly as now. Other phones in the same room join it by
scanning codes, see the same board and story, make their own travellers, and act for
those travellers only. The host's engine judges every act; nothing about the tale lives
anywhere but the host. A phone that drops out leaves its travellers to the host until
it comes back.

## The CD's answers (2026-10-13, recorded in `.claude/cyoa2.md` § CD decisions)

1. Joining: **QR, same room** - phone to phone over WebRTC, no server, two scans per guest.
2. **All on the host** - one engine, one Game Master, keys never leave the host, the
   narrator speaks only from the host; guests read the story silently.
3. **Each owns theirs** - a guest acts only for its own travellers, the host for anyone;
   guests make their own characters on their own phones.
4. **Host takes over** a phone that drops out; it reclaims its travellers on rejoining.

## Design

### Pairing (no server, no third party)

- `RTCPeerConnection({ iceServers: [] })`: host candidates only (mDNS names on phones),
  which is what "same room" means. No STUN, so the page still calls no outside service.
- One connection per guest. The host makes the offer; ICE gathering is waited out (no
  trickle), so each side's description is one message.
- **A description is compacted** to the few values that matter (ice-ufrag, ice-pwd, the
  sha-256 fingerprint, setup role, up to four UDP candidates as mDNS uuid or IP and port)
  in a small binary form, base64url: about 140 characters. The other side rebuilds a
  standard data-channel SDP from them. Verified in Chromium (raw IPs and mDNS).
- **Host shows** a QR of `<page url>#j=<offer>` (and the link, to copy). The guest scans
  it with the phone's camera app; the page opens in guest mode and answers.
- **Guest shows** a QR of `<page url>#a=<answer>`. The host scans it with the camera app;
  that opens a second tab of the page, which hands the code to the game's tab
  (BroadcastChannel, plus a localStorage event, read again when the game tab is shown)
  and says "go back to your game". A code can always be pasted. (Scanning inside the page
  with `BarcodeDetector` was planned and not built: Safari does not have it, so the camera
  app and the second tab are the way on every phone. A follow-up.)
- **QR encoder** in the page (byte mode, level M, versions 1-25, all eight masks scored),
  no library. Proven against an independent encoder (segno) matrix for matrix, and a
  rendered code decoded by OpenCV, once; the suite carries segno's matrices as fixtures.

### One engine, mirrored

- `Net.role`: `solo` (as today), `host`, `guest`.
- **Host -> guests:** the tale as packState(), first whole, then **deltas**: every top-level
  key whose JSON changed, and for maps every map key that changed. Checked every 60 ms
  while anyone is connected, so a walk streams a step at a time. Messages are numbered;
  a guest that misses one asks for the whole again. Chunked under 16 KB. Also `busy`
  (the Game Master is speaking).
- **Guest:** keeps the packed tale, merges each delta, and rebuilds `G.st` with
  `unpackState()` (the sanitizer every save goes through). Pieces that moved slide from
  where they were. The guest **never** runs the engine on its copy: `intent()` refuses
  everything on a guest, Session.tick and the walk stepper do not run, and the guest
  never saves.
- **Guest -> host: acts**, the same calls the host's own buttons make: `go` (a walk:
  goals, then), `door`, `travel`, `ask` (npc, topic), `use` (what, verb), `attack`,
  `ability`, `item`, `dash`, `end`, `init`, `lead`, `party` (add, name, class, roll),
  `say` (a typed line, where Claude has the table). Each carries `who`, the traveller.
- **The host judges:** the act must name a traveller seated to that guest; in rounds it
  must be that traveller's turn; outside rounds the traveller takes the lead first (the
  party follows whoever acts, as it does now). Then the host's own UI function runs it,
  with `Net.remote` set: cards are not shown on the host, toasts go back to the guest.
  The host answers every act (`ok`, `say`, `text`), and the guest shows its own card.

### Seats

- `st.seats = { P2: { dev, name } }`: which device a traveller belongs to, kept in the
  save (sanitized on load like everything else). A device id is random, kept in the
  guest's localStorage; its name is what the guest typed on joining.
- Unseated travellers are the host's. The host acts for anyone.
- A phone silent for 12 s is shown as **away and the line is kept** (built that way
  after the first version hung up on silence: a host out at the camera app went quiet
  long enough to lose its guests). A line that closes is gone. Either way its travellers
  stay and the host plays them; on rejoining with the same device id they are its again.
- The table's clock is a **timer**, not the board's animation frames.

## Assumed, not decided (say so to the CD)

| Assumed | Why |
| ------- | --- |
| The party follows whoever acts outside a fight (a guest's walk makes its traveller the leader) | step 2's follow-the-leader, unchanged |
| Any guest may roll initiative; only the host stands the table down, rests, saves | rests and the purse are the whole party's |
| A table decision the engine asks of the host (being seen, the ending) is shown on the host only | the host is the table |
| Guests cannot rate passages, keep notes or change the Game Master; they can read all of it | one tale, one set of notes, on the host |
| The model's words reach a guest when the telling is done, not as they stream | a telling can still be taken back |
| No STUN server: two phones on different networks cannot connect | the CD chose "same room", and the page calls no third party |
| Sounds and the voice play on the host only | the host is the table's speaker |
| A guest's own Settings offer only how the board looks | the rest is the host's |

## Steps

1. QR encoder + fixtures (segno) + one OpenCV decode of a rendered code.
2. Compact SDP codec; pairing in Chromium (two contexts, raw IPs and mDNS).
3. Net: roles, connections, chunked messages, heartbeat, deltas, guest adopt.
4. Seats in the save; host-side judging of acts; guards in the UI functions.
5. Players panel (host), join screen and guest mode (guest), the second-tab hand-off.
6. Suite section 2: a host and two guests over real WebRTC in Chromium.
7. Negative tests for section 2; docs (`.claude/cyoa2.md`, tests README, CLAUDE.md row).

## Gotchas / bindings

- Never `innerHTML`; a guest's name and every string from the wire is text.
- A guest's message is untrusted: size-capped, act names whitelisted, every field typed.
- The tale's save format gains `seats`; old saves load with none.
- The engine stays the only door: no act reaches `G.st` but through the host's UI
  functions, which call `intent()` exactly as a tap would.
- `unpackState` is the only way a guest's tale is made; never assign host data raw.

## Validation

Section 2 green, the whole suite green (807 + section 2), smoke green. Untested here and
for the CD's phones: Safari's acceptance of the rebuilt SDP, mDNS between two real phones
on one Wi-Fi, the camera-app hand-off between two tabs in iOS Safari.

## Follow-ups

A relay or STUN for players not in the room; streaming a model's words to guests; a
guest's own notes; ratings from guests; the narrator on a guest's phone; table mode (step 5).
