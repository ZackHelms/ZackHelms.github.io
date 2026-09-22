# 2026election/

**Not a game.** A single-page voter reference for ZIP **27513 (Cary, NC)** for the
**Nov 3, 2026** general election: every contest a 27513 voter can see, who is
running, party, links to their own words and record, and a color-coded read of
each candidate's stance on **AI and data centers**.

Live at `https://tythos.com/2026election/`.

## Files

| File | What it is |
|---|---|
| `data.js` | **Single source of truth.** `window.ELECTION = {...}`: contests, candidates, stance ratings, sources, district geography, backdrop timeline. Plain ASCII only. |
| `index.html` | The page. Reads `data.js`; no other dependencies (Google Fonts only). |
| `build.mjs` | `node 2026election/build.mjs` checks `data.js` and regenerates the two downloads. Run it after every data edit. |
| `candidates.csv`, `candidates.json` | **Generated** downloads. Do not hand-edit. |

## Where the data came from

- **Candidates:** NCSBE general-election candidate list (PDF dated 2026-09-21)
  and `Candidate_Listing_2026.csv`, filtered to Wake County general-election
  contests (both at `https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/`).
- **Which contests reach 27513:** the NCSBE Wake voter file (`ncvoter92`,
  2026-09-20) aggregated by residential ZIP and district. Only counts are kept
  (`combos27513`, `precincts` in `data.js`). 27513 splits across U.S. House 2/4,
  NC Senate 16/17, NC House 11/41/49, commissioner 3/7/4 (4 has no 2026 race),
  superior court 10A/10D (10A has no 2026 race), district court 10D/10F. School
  board is District 9 for effectively everyone.
- **Stances:** web search of news coverage, candidate sites and bill records.
  Direct page loads were blocked in the research environment, so campaign sites
  derived only from a filing email domain carry the `u` (unverified) flag.

## Rating rules (the user's definitions)

- **green** - supports AI / data centers AND demands they pay their own way or
  benefit the town (own power, no ratepayer subsidy, no tax breaks, local say)
- **yellow** - wishy-washy or contradictory
- **orange** - opposed / pro-moratorium with no terms for yes
- **red** - supports with no stated protections
- **gray** - nothing found, or the office does not set this policy (not a rating)

`basis` records whether the color comes from the candidate's own words
(`stated`), from a vote or co-sponsorship (`inferred`), or nothing (`none`/`na`).

## Updating

1. Edit `data.js` (add sources to `src`, change `ai.c`, bump `meta.updated`).
2. `node 2026election/build.mjs` - fails loudly on a bad color, party, URL,
   district key or non-ASCII character.
3. Commit `data.js` together with the regenerated `candidates.*`.

Later issue tables (the CD plans more than AI) should be added as a parallel
per-candidate field shaped like `ai`, plus a matching `ratings` map, so the
page can switch issues without touching the contest data.
