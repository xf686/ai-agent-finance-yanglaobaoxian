# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server (HMR)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run lint` — ESLint over `**/*.{js,jsx}` (flat config, `dist` ignored)

There is no test runner configured in this project.

## Architecture

This is a single-page React 19 + Vite 8 app implementing a Chinese-language pension planning assistant ("安享养老"). The app is intentionally structured as a series of **versioned monolithic components** rather than a modular tree.

### Entry path
`index.html` → `src/main.jsx` → `src/App.jsx` → `src/PensionAI_v6.jsx`

`App.jsx` is a one-line re-export that selects which version is live:
```js
export { default } from './PensionAI_v6'
```
`PensionAI_v1.jsx` … `PensionAI_v6.jsx` each contain a complete, self-contained implementation of the app. Each version layers features on top of the previous one (e.g. V6 adds a 2D SVG digital-avatar with lip-sync animation on top of V5). **To switch the active version, change the re-export in `App.jsx`** rather than editing `main.jsx`. Earlier versions are kept as working references, not dead code — do not assume they can be deleted without the user's say-so.

### Data and the `@data` alias
`vite.config.js` defines a `@data` alias that resolves to the top-level `data/` directory:
```js
import KNOWLEDGE_BASE from "@data/knowledgeBase.json"
```
`data/knowledgeBase.json` is the RAG corpus — an array of `{id, title, category, keywords, content}` records covering Chinese pension policy, calculation rules, company products, and FAQs. Retrieval is a simple in-memory keyword-score match (see `retrieveKnowledge` in each version).

### Request pipeline (inside each `PensionAI_vN.jsx`)
On user input the component runs, in order:
1. **Profile extraction** — regex-scrape age / gender / salary / city (and "涨薪" updates) out of the message, merge into the persisted profile.
2. **Intent detection** (`detectIntent`) — maps keywords in the message + profile-completeness to one of: `calculate`, `gap`, `recommend`, `full_analysis`, `chat`.
3. **Function calls** (`executeFunctionCall`) — deterministic JS calculators: `calcBasicPension`, `calcPensionGap`, `calcSupplementPlan`. These use the `CITY_AVG_SALARY` and `PAYMENT_MONTHS` tables and Chinese statutory retirement ages. Their output shape (`{functionName, input, result}`) is rendered in the UI as a "function call" card.
4. **Knowledge retrieval** (`retrieveKnowledge`) — top-3 keyword matches from `KNOWLEDGE_BASE`.
5. **Prompt assembly** (`buildSystemPrompt`) — stitches profile + function results + retrieved docs into a system prompt. Has a `isVoice` branch that forces short, colloquial, markdown-free output.
6. **LLM call** to MiniMax (`MINIMAX_API_URL`, model `MiniMax-M2`). If no real API key is set, the code falls back to a local mock responder.

### External integrations
- **MiniMax chat & TTS** — API key is a placeholder string `YOUR_MINIMAX_API_KEY` at the top of each version file. The UI has an "API settings" modal that lets the user paste a real key at runtime; `isUsingRealApi` gates whether real calls or the mock path is used.
- **Voice input** — uses the browser `SpeechRecognition` / `webkitSpeechRecognition` API with `lang = "zh-CN"`. If unavailable, voice UI degrades gracefully.
- **Voice output** — MiniMax `t2a_v2` TTS when a real API key is present; otherwise falls back to `window.speechSynthesis`.

### Persistence
User state lives in `localStorage` under version-scoped keys (e.g. `pension_ai_profile_v6`, `pension_ai_calc_history_v6`). Bumping the version suffix effectively resets stored state for that version.

### Styling
Styles are inline-object style maps defined inside each version file (no CSS modules, no Tailwind). `src/App.css` and `src/index.css` provide only minimal globals.

## Conventions to be aware of

- ESLint rule `no-unused-vars` is configured with `varsIgnorePattern: '^[A-Z_]'` — constants named in `UPPER_CASE` or `PascalCase` are allowed to be unused without lint errors.
- Identifiers, UI copy, JSON keys in function-call results, and the knowledge base content are all in **Chinese**. Preserve Chinese strings verbatim when editing — they are user-facing and keyword-matched by the retrieval/intent code.
