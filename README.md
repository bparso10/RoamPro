# RoamPro — AI Chat Sidebar Extension

RoamPro is a Roam Research extension that adds an AI copilot sidebar inspired by Obsidian Copilot:

- persistent chat panel anchored to the right side of Roam
- OpenAI-compatible backend support (endpoint + API key + model)
- context-aware prompting using currently open Roam page/block
- fast toggle through Command Palette (`Toggle RoamPro AI Sidebar`)

## Architecture

This implementation follows Roam extension patterns documented in the Roam Developer Hub:

1. Register extension lifecycle hooks (`onload`, `onunload`)
2. Create a settings panel for API credentials and model options
3. Add a Command Palette command for quick UX access
4. Use `window.roamAlphaAPI` to read active page/block context
5. Render a right-side chat UI with minimal CSS and keyboard shortcuts

## Setup

```bash
npm install
npm run build
```

This generates `extension.js`, which you can load in Roam as a local extension build.

## Usage

1. Open Roam > Extensions > RoamPro AI settings.
2. Set:
   - `API Key`
   - `Endpoint URL` (optional; defaults to OpenAI chat completions)
   - `Model`
3. Open Command Palette and run `Toggle RoamPro AI Sidebar`.
4. Ask questions. Use **Ctrl/Cmd + Enter** to send.

## Roadmap

- Block references + backlink retrieval as richer context windows
- Streaming responses
- Slash commands (`/summarize page`, `/rewrite block`)
- Tool mode for creating TODOs and page drafts
