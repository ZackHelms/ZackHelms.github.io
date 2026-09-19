# When the page you need is behind the egress proxy — the print-to-PDF intake

From the 2026-09-19 character-lists session, which needed two different
third-party pages and could not reach either.

## What is actually blocked

The agent proxy denies far more of the open web than the config's § Publish
note implies. Confirmed 403 / `EGRESS_BLOCKED` this session:

| Host | Wanted for |
|---|---|
| `en.wikipedia.org`, `upload.wikimedia.org`, `commons.wikimedia.org` | public-domain portraits for entry pictures |
| `www.bookey.app` | a chapter-by-chapter book summary |

Both fetch paths fail the same way, so testing the second one is not worth the
call once the first has failed:

```
curl  -> curl: (56) CONNECT tunnel failed, response 403     # http=000, no body
WebFetch -> {"error_type":"EGRESS_BLOCKED","domain":"…"}
```

`curl -sS -w 'http=%{http_code}'` prints `http=000` on a refused CONNECT, which
looks like a network flake rather than a policy denial. The proxy's own status
endpoint is what actually names it, and is worth one call before concluding
anything:

```
curl -sS "$HTTPS_PROXY/__agentproxy/status" | python3 -c "
import json,sys
for f in json.load(sys.stdin).get('recentRelayFailures',[])[-4:]:
    print(f['kind'],'|',f['host'],'|',f['detail'])"
```

`/root/.ccr/README.md` is explicit that a 403/407 is an organization policy
denial and must be **reported, not routed around**. So the answer is never a
mirror or a proxy — it is to change the input.

## The intake that works: the CD prints to PDF

The CD hit on this unprompted and it is now the standard move: open the page in
a normal browser, **print → save to PDF**, attach the file. A 2.6 MB / 38-page
print of one article carried the whole thing.

Parse it with `.claude/scripts/pdf-text.py` (written this session):

```
python3 .claude/scripts/pdf-text.py doc.pdf \
  --split '^Chapter [0-9]+ \|' \
  --strip 'Quote Q&A Quiz' --strip 'Install .* App[^.]*' --section 12
```

Two things that cost time and are now handled inside the script:

* **`import pypdf` dies with a `pyo3_runtime.PanicException`** raised from
  cryptography's rust bindings. pypdf only needs cryptography for encrypted
  files, so `sys.modules.setdefault('cryptography', None)` before the import is
  enough. pypdf is not preinstalled; `pip install pypdf` works because pypi is
  in the proxy's noProxy list. No `pdftotext`, `pdfinfo`, PIL or pdfminer in
  this container.
* **Strip boilerplate AFTER splitting, never before.** A print rendering
  interleaves nav and repeated call-to-action strips with the content, and that
  boilerplate often shares a line with a section marker — so removing it first
  joins lines and the `^` anchor in `--split` stops matching. The first run
  silently returned 19 sections for a 21-chapter document, which is exactly the
  kind of quiet undercount that gets believed.

`Read` with `pages:` also works on a PDF and needs no tooling, but it renders
pages visually and costs context per page; for a long document extract the text
instead and read only what is needed.

## The part that is not a tooling problem

A page being reachable would not have settled whether its contents could be
used. Both sources this session were commercial products — a paid summary
service, and stock-photo-adjacent imagery — and this site is public. The
routing that applies:

* **Facts are usable; expression is not.** What happens in chapter 12 of a
  novel is a fact. The summary someone sells of chapter 12 is their writing.
  Summaries on the site are written from the source, never reproduced or
  lightly reworded from it.
* **Pictures got the stricter answer** — only public-domain/CC images, only for
  entries naming a real person or place, attribution kept alongside
  (`character-lists/CLAUDE.md`).

So the useful question when a fetch is blocked is not only "how do I read
this", but "what may I do with it once I can" — the second one often decides
the shape of the work regardless of the first.
