# news-image-20261118-v8

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/mmr9759/news-image-20261118-v8/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/mmr9759/news-image-20261118-v8/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

**THE WORLD TODAY — Wednesday 18 November 2026.** A one-page newspaper front page summing up the day's world news, drawn programmatically with Node 22 (stdlib only: hand-rolled PNG encoder + 5x7 bitmap font). No AI image generator, so every word is sharp and legible.

What this version does differently from the earlier ones: it keeps the clean front-page frame that read best, but fixes the three things that cost points — a date-checked story set (filler and dubious items swapped for the day's most consequential verified stories: the EU EUR45bn Ukraine loan, Peltola flipping the Senate, Cyclone Akvan, the Nvidia board ruling out Huang's return, Kahana elected speaker, Jesse Jackson's death, OpenAI's GPT-6.2), a fixed world map (single-column legend, 8 numbered pins in the right places — Cyclone Akvan in India, not the Cook Islands), and one consistent set of numbers used once (no markets ticker contradicting itself).

- **Masthead + date:** Wednesday 18 November 2026 — 23 stories, 7 regions, date-checked.
- **Lead:** US strikes Qeshm, Iran hits Gulf bases (Strait of Hormuz schematic); Kerch Bridge hit again; Xi and Putin open APEC in Shenzhen.
- **Map:** world map with 8 numbered pins + single-column "Where it happened" legend.
- **By the numbers:** Ebola 11,000+, Senate 56-44, Voyager 1 one light-day out, COP31 18-page draft.
- **Grid:** 12 icon tiles with headline + deck, plus an "Also" strip of 8 more stories.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

writes `entry.png` (1024x1024, ≤1 MiB) to the output directory (`/output` by default).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
