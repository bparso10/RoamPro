"use strict";
(() => {
  // src/index.ts
  var ID = "roampro-ai-sidebar";
  var COMMAND_LABEL = "Toggle RoamPro AI Sidebar";
  var containerEl = null;
  var styleEl = null;
  var commandRegistered = false;
  var state = {
    open: false,
    loading: false,
    messages: [
      {
        role: "assistant",
        content: "Hi \u2014 I can answer questions using your active page or selected block as context."
      }
    ]
  };
  var getSetting = (extensionAPI, key, fallback = "") => {
    const value = extensionAPI.settings.get(key);
    return typeof value === "string" ? value : fallback;
  };
  var getCurrentContext = async () => {
    const api = window.roamAlphaAPI;
    if (!api?.ui?.mainWindow?.getOpenPageOrBlockUid) return "";
    const uid = api.ui.mainWindow.getOpenPageOrBlockUid();
    if (!uid) return "";
    try {
      const result = await api.data.pull("[:block/string :node/title]", [":block/uid", uid]);
      if (!result) return "";
      if (result[":block/string"]) return `Active block: ${result[":block/string"]}`;
      if (result[":node/title"]) return `Active page title: ${result[":node/title"]}`;
    } catch (e) {
      console.warn(`${ID}: unable to read active context`, e);
    }
    return "";
  };
  var createPrompt = (context, history) => {
    const prefix = "You are RoamPro Copilot, an AI assistant for Roam Research. Answer concisely, use bullet points when useful, and propose follow-up actions grounded in notes context.";
    return [
      { role: "system", content: prefix },
      ...context ? [{ role: "system", content: `Roam context: ${context}` }] : [],
      ...history
    ];
  };
  var callLLM = async (extensionAPI, messages) => {
    const endpoint = getSetting(extensionAPI, "endpoint", "https://api.openai.com/v1/chat/completions");
    const apiKey = getSetting(extensionAPI, "apiKey");
    const model = getSetting(extensionAPI, "model", "gpt-4o-mini");
    if (!apiKey) {
      return "Please set your API key in RoamPro AI Sidebar settings.";
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI request failed (${response.status}): ${body}`);
    }
    const json = await response.json();
    return json?.choices?.[0]?.message?.content ?? "No response returned.";
  };
  var renderMessages = (root) => {
    const list = root.querySelector(`.${ID}__messages`);
    list.innerHTML = "";
    state.messages.forEach((message) => {
      const bubble = document.createElement("div");
      bubble.className = `${ID}__bubble ${ID}__bubble--${message.role}`;
      bubble.textContent = message.content;
      list.appendChild(bubble);
    });
    list.scrollTop = list.scrollHeight;
  };
  var setLoading = (root, loading) => {
    state.loading = loading;
    const button = root.querySelector(`.${ID}__send`);
    button.disabled = loading;
    button.textContent = loading ? "Thinking\u2026" : "Send";
  };
  var submit = async (extensionAPI, root) => {
    const input = root.querySelector(`.${ID}__input`);
    const text = input.value.trim();
    if (!text || state.loading) return;
    state.messages.push({ role: "user", content: text });
    input.value = "";
    renderMessages(root);
    setLoading(root, true);
    try {
      const context = await getCurrentContext();
      const prompt = createPrompt(context, state.messages);
      const reply = await callLLM(extensionAPI, prompt);
      state.messages.push({ role: "assistant", content: reply });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error";
      state.messages.push({ role: "assistant", content: `Error: ${error}` });
    } finally {
      setLoading(root, false);
      renderMessages(root);
    }
  };
  var ensureStyles = () => {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.id = `${ID}-styles`;
    styleEl.textContent = `
    .${ID} { position: fixed; top: 46px; right: 0; width: 380px; height: calc(100vh - 46px); background: var(--rm-main-bg, #fff); border-left: 1px solid var(--rm-border-color, #ddd); z-index: 30; display:flex; flex-direction:column; }
    .${ID}__header { padding: 10px 12px; font-weight: 600; border-bottom: 1px solid var(--rm-border-color, #ddd); }
    .${ID}__messages { flex:1; overflow:auto; padding:12px; display:flex; flex-direction:column; gap:10px; }
    .${ID}__bubble { border-radius: 10px; padding: 9px 10px; white-space: pre-wrap; line-height: 1.35; }
    .${ID}__bubble--assistant { background: #f1f5f9; color:#111; }
    .${ID}__bubble--user { background: #1d4ed8; color:#fff; margin-left: 35px; }
    .${ID}__composer { border-top: 1px solid var(--rm-border-color, #ddd); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .${ID}__input { resize: vertical; min-height: 70px; width:100%; padding:8px; }
    .${ID}__send { align-self: flex-end; }
    body.${ID}--open #roam-right-sidebar-content { margin-right: 380px; }
  `;
    document.head.appendChild(styleEl);
  };
  var createSidebar = (extensionAPI) => {
    ensureStyles();
    if (!containerEl) {
      containerEl = document.createElement("div");
      containerEl.className = ID;
      containerEl.innerHTML = `
      <div class="${ID}__header">RoamPro AI Copilot</div>
      <div class="${ID}__messages"></div>
      <div class="${ID}__composer">
        <textarea class="${ID}__input" placeholder="Ask about this page, brainstorm, summarize, rewrite\u2026"></textarea>
        <button class="bp3-button bp3-intent-primary ${ID}__send">Send</button>
      </div>
    `;
      const send = containerEl.querySelector(`.${ID}__send`);
      const input = containerEl.querySelector(`.${ID}__input`);
      send.addEventListener("click", () => submit(extensionAPI, containerEl));
      input.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          submit(extensionAPI, containerEl);
        }
      });
      renderMessages(containerEl);
    }
    document.body.appendChild(containerEl);
    document.body.classList.add(`${ID}--open`);
    state.open = true;
  };
  var destroySidebar = () => {
    if (!containerEl) return;
    containerEl.remove();
    document.body.classList.remove(`${ID}--open`);
    state.open = false;
  };
  var toggleSidebar = (extensionAPI) => {
    if (state.open) destroySidebar();
    else createSidebar(extensionAPI);
  };
  var onload = ({ extensionAPI }) => {
    extensionAPI.settings.panel.create({
      tabTitle: "RoamPro AI",
      settings: [
        {
          id: "apiKey",
          name: "API Key",
          description: "OpenAI-compatible API key used for chat completions.",
          action: { type: "input", placeholder: "sk-..." }
        },
        {
          id: "endpoint",
          name: "Endpoint URL",
          description: "Defaults to OpenAI's /chat/completions endpoint.",
          action: { type: "input", placeholder: "https://api.openai.com/v1/chat/completions" }
        },
        {
          id: "model",
          name: "Model",
          description: "Chat model identifier.",
          action: { type: "input", placeholder: "gpt-4o-mini" }
        }
      ]
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: COMMAND_LABEL,
      callback: () => toggleSidebar(extensionAPI)
    });
    commandRegistered = true;
    console.log(`${ID}: loaded`);
  };
  var onunload = ({ extensionAPI }) => {
    destroySidebar();
    styleEl?.remove();
    styleEl = null;
    if (commandRegistered) {
      extensionAPI.ui.commandPalette.removeCommand({ label: COMMAND_LABEL });
    }
    console.log(`${ID}: unloaded`);
  };
  var index_default = { onload, onunload };
})();
