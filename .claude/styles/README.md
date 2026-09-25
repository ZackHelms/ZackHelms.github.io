# Site styles

Named visual styles a page on this site can be built in. The CD picks one by name
("build it in Almanac"); with no name given, a page gets the default.

| Style | Look | Spec | Used by |
|---|---|---|---|
| **Neon Arcade** (default) | Near-black `#06060e`, neon accents, Black Ops One + Share Tech Mono, Canvas 2D | `games/CLAUDE.md`, section "Shared Conventions" | every game, the games and experiments hubs, `2026election/`, `signals/` |
| **Almanac** | Light paper-grey with a matching dark mode, Barlow Semi Condensed + Source Serif 4, ink rules, source-labelled numbers | `almanac.md` | `carbon-footprint/` |
| **Grimoire** | Illuminated manuscript: vellum, iron-gall ink, vermilion rubrics, gold leaf, woodcut plates, candlelit night mode; Cinzel + IM Fell English | `grimoire.md` | `games/cyoa/` |

## How styles work here

- **Each page carries its style inline.** The single-file rule wins over reuse: there is
  no shared stylesheet, so a style is a spec plus a copyable `:root` token block, not an
  import. Switching an existing page to another style means replacing its token block,
  its font link and any component rules the new spec names.
- **A style is paint, not behaviour.** Changing a page's style never changes what the
  page does, what it measures, or its copy.
- **Adding a style:** write `<name>.md` here with the token block (light AND dark), the
  font pairing, the components, and the rules a page must keep; add a row above. A style
  earns a file once a page actually ships in it.
- There is no runtime switcher: a visitor cannot flip a page between styles. If the CD
  wants one, it would be a per-page `data-style` attribute over token blocks, and it
  belongs in a plan first.
