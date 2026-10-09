window.__ModuleLoader__.load({id:"@missher/dsh-output-renderer",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/preferences.ts
var LAYOUTS = ["reader", "cards", "process", "checklist"];
var MOTIONS = ["smooth", "fade"];
var DENSITIES = ["comfortable", "tight"];
var TEXT_SIZES = ["standard", "large"];
var DEFAULTS = { layout: "reader", motion: "fade", density: "comfortable", textSize: "standard" };
var ENTRY_ID = "output-renderer";
var PACKAGE_ID = "@missher/dsh-output-renderer";
function preferences(value) {
  if (value === null || typeof value !== "object") return { ...DEFAULTS };
  const record = value;
  return {
    layout: LAYOUTS.includes(record.layout) ? record.layout : DEFAULTS.layout,
    motion: MOTIONS.includes(record.motion) ? record.motion : DEFAULTS.motion,
    density: DENSITIES.includes(record.density) ? record.density : DEFAULTS.density,
    textSize: TEXT_SIZES.includes(record.textSize) ? record.textSize : DEFAULTS.textSize
  };
}

// src/client/settings.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function createPreferences(form) {
  const initial = form.getSnapshot();
  const store = (0, import_dsh_client_store.createSnapshotStore)({
    value: preferences(initial.value),
    saving: false,
    error: false,
    status: initial.status,
    ready: initial.status === "ready",
    writable: initial.writable && initial.mode === "host"
  });
  let disposed = false;
  const sync = () => {
    if (disposed) return;
    const snap = form.getSnapshot();
    const current = store.getSnapshot();
    store.set({
      ...current,
      value: current.saving ? current.value : preferences(snap.value),
      status: snap.status,
      ready: snap.status === "ready",
      writable: snap.writable && snap.mode === "host"
    });
  };
  const unsubscribe = form.subscribe(sync);
  return {
    store,
    async set(key, value) {
      const before = store.getSnapshot();
      if (disposed || before.saving || !before.ready || !before.writable) return;
      store.set({ ...before, value: { ...before.value, [key]: value }, saving: true, error: false });
      let accepted = false;
      try {
        accepted = await form.set(key, value);
      } catch (_error) {
      }
      if (disposed) return;
      const snap = form.getSnapshot();
      store.set({
        value: preferences(snap.value),
        saving: false,
        error: !accepted,
        status: snap.status,
        ready: snap.status === "ready",
        writable: snap.writable && snap.mode === "host"
      });
    },
    dispose() {
      disposed = true;
      unsubscribe();
    }
  };
}

// src/client/Assistant.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// ../../../../../../Deepseek-harness-Cordis/coordination/2026-10-03/session-bridge-integration/git-source/packages/util/workspace-path/lib/index.js
function isWindowsStylePath(value) {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}
function isAbsoluteWorkspacePath(path) {
  return path.startsWith("/") || isWindowsStylePath(path);
}
function fileMediaUrl(base, path) {
  if (!/^https?:/u.test(base) && !base.startsWith("dsh-app://app/") || !isAbsoluteWorkspacePath(path) || /^[/\\]{2}/u.test(path) || /[\u0000-\u001f\u007f]/u.test(path)) return void 0;
  return new URL(`api/file?path=${encodeURIComponent(path)}`, base).href;
}

// src/client/stream.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/frame-text.ts
var FrameText = class {
  constructor(initial, clock, publish) {
    this.clock = clock;
    this.publish = publish;
    this.target = initial;
    this.shown = initial;
  }
  clock;
  publish;
  target;
  shown;
  boundaries = [];
  openStart = 0;
  frame;
  lastTime;
  debtStart;
  disposed = false;
  running = false;
  motion = "fade";
  reduced = false;
  segmented = false;
  segmenter;
  update(text, running, motion, reduced = false) {
    if (this.disposed) return;
    const appended = text.startsWith(this.target);
    const changed = text !== this.target;
    this.target = text;
    this.running = running;
    this.motion = motion;
    this.reduced = reduced;
    if (!running || reduced || !appended) {
      this.flush();
      return;
    }
    if (motion !== "smooth") this.clearSegments();
    else if (text !== this.shown && (changed || !this.segmented)) this.segment(text, appended && this.segmented);
    if (this.target !== this.shown && this.frame === void 0) this.frame = this.clock.request(this.tick);
  }
  /** Flush when a page is hidden, a turn stops, or its source is replaced. */
  flush() {
    if (this.frame !== void 0) this.clock.cancel(this.frame);
    this.frame = void 0;
    this.lastTime = void 0;
    this.debtStart = void 0;
    this.clearSegments();
    this.emit(this.target);
  }
  dispose() {
    this.disposed = true;
    if (this.frame !== void 0) this.clock.cancel(this.frame);
    this.frame = void 0;
    this.clearSegments();
  }
  emit(text) {
    if (text === this.shown || this.disposed) return;
    this.shown = text;
    this.publish(text);
  }
  segment(text, appended) {
    this.segmenter ??= new Intl.Segmenter(void 0, { granularity: "grapheme" });
    const start = appended ? this.openStart : 0;
    if (appended) {
      while ((this.boundaries.at(-1) ?? 0) > start) this.boundaries.pop();
    } else this.boundaries = [];
    let last = start;
    for (const part of this.segmenter.segment(text.slice(start))) {
      last = start + part.index;
      this.boundaries.push(last + part.segment.length);
    }
    this.openStart = last;
    this.segmented = true;
  }
  clearSegments() {
    if (!this.segmented) return;
    this.boundaries = [];
    this.openStart = 0;
    this.segmented = false;
  }
  tick = (now) => {
    this.frame = void 0;
    if (this.disposed) return;
    if (!this.running || this.reduced || this.motion === "fade") {
      this.flush();
      return;
    }
    const available = this.openStart;
    if (available <= this.shown.length) {
      this.lastTime = void 0;
      this.debtStart = void 0;
      return;
    }
    this.debtStart ??= now;
    const dt = this.lastTime === void 0 ? 0 : Math.max(0, now - this.lastTime);
    this.lastTime = now;
    const remainingTime = Math.max(1, 96 - (now - this.debtStart));
    const desired = remainingTime <= dt ? available : this.shown.length + Math.max(1, Math.ceil((available - this.shown.length) * dt / remainingTime));
    let low = 0;
    let high = this.boundaries.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.boundaries[mid] < desired) low = mid + 1;
      else high = mid;
    }
    const end = Math.min(available, this.boundaries[low] ?? available);
    this.emit(this.target.slice(0, end));
    if (end < available) this.frame = this.clock.request(this.tick);
    else {
      this.lastTime = void 0;
      this.debtStart = void 0;
    }
  };
};

// src/client/stream.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function useReducedMotion() {
  const query = (0, import_react.useMemo)(() => window.matchMedia("(prefers-reduced-motion: reduce)"), []);
  const [reduced, setReduced] = (0, import_react.useState)(query.matches);
  (0, import_react.useLayoutEffect)(() => {
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, [query]);
  return reduced;
}
function readableNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let item;
  while (item = walker.nextNode()) {
    if (item.parentElement?.closest('[data-code-block-banner],button,[role="button"],[aria-hidden="true"]')) continue;
    if (item.parentElement?.closest("p,li,h1,h2,h3,h4,h5,h6,pre code,td,th")) nodes.push(item);
  }
  return nodes;
}
function backgroundAt(node) {
  let current = node;
  while (current) {
    const color = getComputedStyle(current).backgroundColor;
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
    current = current.parentElement;
  }
  return getComputedStyle(document.documentElement).getPropertyValue("--dsw-alias-bg-base").trim() || "Canvas";
}
function StreamMarkdown({ text, running, motion, labels, mentions, pathImages, compact = false }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = (0, import_react.useState)(text);
  const controller = (0, import_react.useRef)(null);
  const content = (0, import_react.useRef)(null);
  const overlay = (0, import_react.useRef)(null);
  const previous = (0, import_react.useRef)(running ? "" : null);
  const active = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const clearFade = (0, import_react.useCallback)(() => {
    for (const animation of active.current) animation.cancel();
    active.current.clear();
    overlay.current?.replaceChildren();
  }, []);
  (0, import_react.useLayoutEffect)(() => {
    const buffer = new FrameText(text, {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (id) => cancelAnimationFrame(id)
    }, setShown);
    controller.current = buffer;
    return () => {
      buffer.dispose();
      controller.current = null;
    };
  }, []);
  (0, import_react.useLayoutEffect)(() => {
    const visibility = () => {
      if (!document.hidden) {
        if (running && !reduced && motion === "fade" && content.current) {
          previous.current = readableNodes(content.current).map((node) => node.data).join("");
        }
        return;
      }
      previous.current = null;
      clearFade();
      controller.current?.flush();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [running, motion, reduced, clearFade]);
  (0, import_react.useLayoutEffect)(() => {
    controller.current?.update(text, running, motion, reduced || document.hidden);
  }, [text, running, motion, reduced]);
  (0, import_react.useLayoutEffect)(() => {
    const body = content.current;
    const layer = overlay.current;
    if (!body || !layer) return;
    if (!running || reduced || document.hidden || motion !== "fade") {
      previous.current = null;
      clearFade();
      return;
    }
    const nodes = readableNodes(body);
    const next = nodes.map((node) => node.data).join("");
    const old = previous.current;
    previous.current = next;
    if (old === null || next === old) return;
    if (!next.startsWith(old)) {
      clearFade();
      return;
    }
    if (typeof layer.animate !== "function") return;
    const from = Math.max(old.length, next.length - 640);
    const rect = layer.getBoundingClientRect();
    let offset = 0;
    let count = 0;
    for (const node of nodes) {
      const end = offset + node.length;
      if (end > from) {
        const background = backgroundAt(node.parentElement ?? body);
        const range = document.createRange();
        range.setStart(node, Math.max(0, from - offset));
        range.setEnd(node, node.length);
        for (const part of range.getClientRects()) {
          if (part.width <= 0 || part.height <= 0 || count++ >= 64) break;
          const shade = document.createElement("span");
          Object.assign(shade.style, {
            position: "absolute",
            left: `${part.left - rect.left}px`,
            top: `${part.top - rect.top}px`,
            width: `${part.width}px`,
            height: `${part.height}px`,
            background
          });
          layer.append(shade);
          const animation = shade.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });
          active.current.add(animation);
          const clear = () => {
            shade.remove();
            active.current.delete(animation);
          };
          animation.onfinish = clear;
          animation.oncancel = clear;
          if (active.current.size > 96) active.current.values().next().value?.cancel();
        }
        range.detach();
      }
      offset = end;
      if (count >= 64) break;
    }
  }, [shown, running, motion, reduced, clearFade]);
  (0, import_react.useLayoutEffect)(() => {
    const animations = active.current;
    const layer = overlay.current;
    let width = content.current?.getBoundingClientRect().width;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next === width) return;
      width = next;
      for (const animation of animations) animation.cancel();
      animations.clear();
      layer?.replaceChildren();
    });
    if (content.current) resize?.observe(content.current);
    return () => {
      resize?.disconnect();
      for (const animation of animations) animation.cancel();
      animations.clear();
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-output-stream", "data-output-motion": motion, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: content, "data-output-text": true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.MarkdownText,
      {
        text: running && !reduced ? shown : text,
        streaming: running,
        labels,
        fileMentions: mentions,
        pathImages,
        variant: compact ? "compact" : "body"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: overlay, className: "dsh-output-fade-layer", "aria-hidden": "true" })
  ] });
}

// src/client/StepLabel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function StepLabel({ step, status, text }) {
  const labels = { running: "stepRunning", settled: "stepSettled", interrupted: "stopped" };
  const marks = { running: "\xB7", settled: "\u2713", interrupted: "\u2212" };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-output-step-heading", "data-output-step-status": status, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-output-step-mark", "aria-hidden": "true", children: marks[status] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
      text("step"),
      " ",
      step
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-output-step-state", children: text(labels[status]) })
  ] });
}

// src/client/Assistant.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var Assistant = (0, import_react2.memo)(function Assistant2({
  node,
  groupPart,
  useTurnData,
  openFile,
  renderMessageImages,
  fileMentions,
  useOutputPreferences,
  outputText,
  t
}) {
  const { motion, layout, density, textSize } = useOutputPreferences((state) => state.value);
  const data = node.data;
  const running = data.status === "running";
  const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
  const tail = useTurnData("turn-tail");
  const owner = (0, import_react2.useMemo)(() => {
    if (turn?.status !== "closed" || !data.finalNode || tail?.closing?.finalNode.seq !== data.finalNode.seq) return void 0;
    return { turn, seq: data.finalNode.seq, openFile };
  }, [turn, data.finalNode, tail, openFile]);
  const mentions = (0, import_react2.useMemo)(() => owner ? fileMentions(owner) : void 0, [owner, fileMentions]);
  const labels = (0, import_react2.useMemo)(() => ({
    code: {
      copyLabel: t("copy"),
      copiedLabel: t("copied"),
      toolbarLabels: { codeLabel: t("codeBlock.title"), wrapLabel: t("codeBlock.wrap"), unwrapLabel: t("codeBlock.unwrap") }
    },
    footnotes: t("markdown.footnotes")
  }), [t]);
  const pathImages = (0, import_react2.useMemo)(() => ({ resolve(value) {
    let path;
    try {
      path = decodeURIComponent(value.split(/[?#]/u)[0] ?? "");
    } catch (_error) {
      return void 0;
    }
    return fileMediaUrl(document.baseURI, path);
  } }), []);
  const reasoning = [];
  const response = [];
  for (let index = 0; index < data.blocks.length; index++) {
    const block = data.blocks[index];
    if (block.kind === "tool-call" || groupPart === "reasoning" && block.kind !== "reasoning" || groupPart === "response" && block.kind === "reasoning") continue;
    if (block.kind === "reasoning") {
      if (!block.text.trim()) continue;
      reasoning.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        StreamMarkdown,
        {
          text: block.text,
          running: running && index === data.blocks.length - 1,
          motion,
          labels,
          compact: true
        },
        index
      ));
    } else if (block.kind === "text") {
      if (!block.text.trim()) continue;
      response.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        StreamMarkdown,
        {
          text: block.text,
          running,
          motion,
          labels,
          mentions,
          pathImages
        },
        index
      ));
    } else if (block.kind === "image") {
      const first = index;
      const images = [{ attachment: block.attachment }];
      while (data.blocks[index + 1]?.kind === "image") {
        const next = data.blocks[++index];
        if (next.kind === "image") images.push({ attachment: next.attachment });
      }
      response.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react2.Fragment, { children: renderMessageImages({ images, align: "start" }) }, first));
    } else {
      response.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_dsh_client_ui_primitives2.JsonBlock,
        {
          label: t("message.unknownBlock"),
          payload: block.block,
          truncatedLabel: (total) => t("json.truncated", { total })
        },
        index
      ));
    }
  }
  const hasReasoning = data.blocks.some((block) => block.kind === "reasoning" && block.text.trim());
  const hasResponse = data.blocks.some((block) => block.kind === "text" ? block.text.trim() : block.kind !== "reasoning" && block.kind !== "tool-call");
  const interrupted = data.status === "interrupted" && (groupPart !== "reasoning" || !hasResponse);
  if (!reasoning.length && !response.length && !interrupted) return null;
  const checklistStep = layout === "checklist" && (reasoning.length > 0 || !hasReasoning && (response.length > 0 || interrupted));
  const showStopped = interrupted && (layout !== "checklist" || !hasReasoning && !checklistStep);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      className: `dsh-output-assistant${checklistStep ? " dsh-output-checklist-step" : ""}`,
      "data-output-layout": layout,
      "data-output-part": groupPart,
      "data-output-density": density,
      "data-output-text-size": textSize,
      "data-output-both": reasoning.length > 0 && response.length > 0 || void 0,
      "data-output-running": running || void 0,
      children: [
        checklistStep && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(StepLabel, { step: data.step, status: data.status, text: outputText }),
        reasoning.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dsh-output-reasoning", "aria-label": outputText("thinking"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-output-label", children: outputText("thinking") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { "data-reasoning-full": true, children: reasoning })
        ] }),
        response.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dsh-output-answer", "aria-label": outputText("answer"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-output-label dsh-output-answer-label", children: outputText("answer") }),
          response
        ] }),
        showStopped && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-output-stopped", children: outputText("stopped") })
      ]
    }
  );
});

// src/client/Settings.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime4 = require("react/jsx-runtime");
function Settings({ useOutputPreferences, setPreference, t }) {
  const state = useOutputPreferences((value) => value);
  const processPreview = state.value.layout === "process" || state.value.layout === "checklist";
  const sampleText = t(processPreview ? "processSample" : "sample");
  const [sample, setSample] = (0, import_react3.useState)(sampleText);
  const [playing, setPlaying] = (0, import_react3.useState)(false);
  const frame = (0, import_react3.useRef)(0);
  const labels = (0, import_react3.useMemo)(() => ({ code: { copyLabel: t("copy"), copiedLabel: t("copied"), toolbarLabels: { codeLabel: t("code"), wrapLabel: t("wrap"), unwrapLabel: t("unwrap") } }, footnotes: t("footnotes") }), [t]);
  (0, import_react3.useEffect)(() => {
    cancelAnimationFrame(frame.current);
    setSample(sampleText);
    setPlaying(false);
    return () => cancelAnimationFrame(frame.current);
  }, [sampleText]);
  const replay = () => {
    cancelAnimationFrame(frame.current);
    setSample("");
    setPlaying(true);
    let started;
    let lastChunk = -1;
    const tick = (time) => {
      started ??= time;
      const count = Math.floor((time - started) / 80) * 3;
      if (count !== lastChunk) {
        lastChunk = count;
        setSample(sampleText.slice(0, count));
      }
      if (count >= sampleText.length) {
        setSample(sampleText);
        setPlaying(false);
      } else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const disabled = state.saving || !state.ready || !state.writable;
  const statusKey = state.status === "loading" ? "loading" : state.status === "unavailable" || !state.writable ? "unavailable" : state.error ? "failed" : state.saving ? "saving" : "saved";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-output-settings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-output-settings-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("section") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-settings-status", role: "status", "data-error": statusKey === "failed" || void 0, children: t(statusKey) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dsh-output-intro", children: t("intro") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { disabled, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: t("layout") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-options", children: LAYOUTS.map((layout) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        import_dsh_client_ui_primitives3.Button,
        {
          variant: "outline",
          "aria-pressed": state.value.layout === layout,
          disabled,
          onClick: () => {
            void setPreference("layout", layout);
          },
          className: "dsh-output-choice",
          "data-choice": layout,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-output-mini", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {})
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-output-choice-copy", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-output-choice-name", children: t(layout) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-output-description", children: t(`${layout}Hint`) })
            ] })
          ]
        },
        layout
      )) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-output-fields", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-output-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("thinking") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dsh-output-description", children: t("thinkingHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("alwaysOpen") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { className: "dsh-output-field", disabled, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: t("density") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-controls", children: DENSITIES.map((density) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          import_dsh_client_ui_primitives3.Button,
          {
            variant: "outline",
            size: "sm",
            disabled,
            "aria-pressed": state.value.density === density,
            onClick: () => {
              void setPreference("density", density);
            },
            children: t(density)
          },
          density
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { className: "dsh-output-field", disabled, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: t("textSize") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-controls", children: TEXT_SIZES.map((size) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          import_dsh_client_ui_primitives3.Button,
          {
            variant: "outline",
            size: "sm",
            disabled,
            "aria-pressed": state.value.textSize === size,
            onClick: () => {
              void setPreference("textSize", size);
            },
            children: t(size)
          },
          size
        )) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("fieldset", { disabled, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("legend", { children: t("motion") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-motions", children: MOTIONS.map((motion) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        import_dsh_client_ui_primitives3.Button,
        {
          variant: "outline",
          disabled,
          "aria-pressed": state.value.motion === motion,
          onClick: () => {
            void setPreference("motion", motion);
          },
          className: "dsh-output-choice",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-output-choice-name", children: t(motion) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-output-description", children: t(`${motion}Hint`) })
          ]
        },
        motion
      )) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "dsh-output-preview", "aria-label": t("preview"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-output-preview-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("preview") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", size: "sm", onClick: replay, children: t("replay") })
      ] }),
      processPreview && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-preview-process", "data-output-layout": state.value.layout, children: ["processNote", "verificationNote"].map((note, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            className: `dsh-output-assistant${state.value.layout === "checklist" ? " dsh-output-checklist-step" : ""}`,
            "data-output-layout": state.value.layout,
            "data-output-density": state.value.density,
            "data-output-text-size": state.value.textSize,
            children: [
              state.value.layout === "checklist" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(StepLabel, { step: index + 1, status: "settled", text: t }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "dsh-output-reasoning", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-label", children: t("thinking") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t(note) })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { className: "dsh-output-preview-tools", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("summary", { children: t("previewTool") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("previewToolDetail") })
        ] })
      ] }, note)) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: "dsh-output-assistant",
          "data-output-layout": state.value.layout,
          "data-output-both": !processPreview || void 0,
          "data-output-density": state.value.density,
          "data-output-text-size": state.value.textSize,
          children: [
            !processPreview && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "dsh-output-reasoning", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-label", children: t("thinking") }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("note") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "dsh-output-answer", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-output-label dsh-output-answer-label", children: t("answer") }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(StreamMarkdown, { text: sample, running: playing, motion: state.value.motion, labels })
            ] })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dsh-output-description", children: t("rate") })
  ] });
}

// src/client/locales.ts
var NS = "missher.output-renderer";
var en = {
  section: "Output appearance",
  layout: "Response layout",
  motion: "Streaming effect",
  intro: "A clear, single column for thinking and answers.",
  reader: "Clear reading",
  cards: "Soft cards",
  process: "Deep process, simple reply",
  checklist: "Task checklist",
  readerHint: "Continuous text with quiet tool details.",
  cardsHint: "Thinking and answers grouped in a single column.",
  processHint: "Keep the full process visible, with a distinct answer at the end.",
  checklistHint: "Number recorded steps and show their output status.",
  step: "Step",
  stepRunning: "Generating",
  stepSettled: "Output complete",
  density: "Content spacing",
  comfortable: "Comfortable",
  tight: "Compact",
  textSize: "Body text size",
  standard: "Standard \xB7 14 px",
  large: "Larger \xB7 16 px",
  thinkingHint: "Full text remains readable. Tool details fold independently.",
  alwaysOpen: "Always expanded",
  smooth: "Frame-synchronized",
  fade: "New text fade-in",
  smoothHint: "Reveal buffered text on display frames, without a fixed frame-rate cap.",
  fadeHint: "Fade in only arriving text. Previously displayed text stays unchanged.",
  note: "Thinking stays fully visible. Code, links, images and tool actions use the built-in renderer.",
  processNote: "Check the settings page, saving request and reload path. Compare the saved value with the value shown in the form, then reproduce the issue before making changes.",
  verificationNote: "Check normal saves, delayed responses, retries and persistence after reloading. Keep the full process visible and place the answer after the work.",
  previewTool: "Tool details \xB7 example",
  previewToolDetail: "Example only: inspect settings, apply a change and check the saved value.",
  processSample: "The save-and-revert issue is fixed. The saved setting remains after reloading.",
  rate: "Display refresh and model generation speed are independent. Reduced-motion preferences are respected.",
  saving: "Saving\u2026",
  saved: "Saved",
  loading: "Loading settings\u2026",
  unavailable: "Settings cannot be saved on this connection.",
  failed: "Could not save. The previous setting has been restored.",
  thinking: "Thinking",
  answer: "Response",
  stopped: "Stopped",
  preview: "Preview",
  replay: "Replay output",
  sample: "Every style keeps the complete answer.\n\nAdjust spacing and text size to read comfortably. New text appears smoothly; code, files and tool actions remain available.",
  copy: "Copy",
  copied: "Copied",
  code: "Code",
  wrap: "Wrap",
  unwrap: "Unwrap",
  footnotes: "Footnotes"
};
var zh = {
  section: "\u8F93\u51FA\u5916\u89C2",
  layout: "\u56DE\u590D\u5E03\u5C40",
  motion: "\u6D41\u5F0F\u8F93\u51FA\u6548\u679C",
  intro: "\u5355\u5217\u9605\u8BFB\uFF0C\u8BA9\u601D\u8003\u548C\u6B63\u6587\u5404\u81EA\u6E05\u695A",
  reader: "\u6E05\u6670\u9605\u8BFB",
  cards: "\u67D4\u548C\u5361\u7247",
  process: "\u6DF1\u60F3\u7B80\u7B54",
  checklist: "\u4EFB\u52A1\u6E05\u5355",
  readerHint: "\u7B80\u6D01\u6B63\u6587\uFF0C\u8F7B\u91CF\u5DE5\u5177\u8BB0\u5F55",
  cardsHint: "\u601D\u8003\u4E0E\u6B63\u6587\u5206\u7EC4\uFF0C\u4FDD\u6301\u5355\u5217",
  processHint: "\u5B8C\u6574\u5C55\u5F00\u8FC7\u7A0B\uFF0C\u6B63\u6587\u72EC\u7ACB\u6536\u5C3E",
  checklistHint: "\u6309\u5B9E\u9645\u6B65\u9AA4\u7F16\u53F7\uFF0C\u663E\u793A\u8F93\u51FA\u72B6\u6001",
  step: "\u6B65\u9AA4",
  stepRunning: "\u8F93\u51FA\u4E2D",
  stepSettled: "\u8F93\u51FA\u5B8C\u6210",
  density: "\u5185\u5BB9\u95F4\u8DDD",
  comfortable: "\u8212\u9002",
  tight: "\u7D27\u51D1",
  textSize: "\u6B63\u6587\u5927\u5C0F",
  standard: "\u6807\u51C6 \xB7 14 px",
  large: "\u8F83\u5927 \xB7 16 px",
  thinkingHint: "\u5168\u6587\u663E\u793A\uFF0C\u4FDD\u7559\u5B8C\u6574\u9605\u8BFB\uFF1B\u5DE5\u5177\u6298\u53E0\u72EC\u7ACB\u63A7\u5236",
  alwaysOpen: "\u59CB\u7EC8\u5C55\u5F00",
  smooth: "\u5237\u65B0\u7387\u540C\u6B65",
  fade: "\u65B0\u589E\u6587\u5B57\u6DE1\u5165",
  smoothHint: "\u6309\u5C4F\u5E55\u5237\u65B0\u8282\u594F\u663E\u793A\u7F13\u51B2\u6587\u5B57\uFF0C\u4E0D\u8BBE\u56FA\u5B9A\u5E27\u7387\u4E0A\u9650\u3002",
  fadeHint: "\u4EC5\u65B0\u5230\u8FBE\u7684\u6587\u5B57\u6E10\u663E\uFF0C\u5DF2\u7ECF\u8BFB\u8FC7\u7684\u5185\u5BB9\u4FDD\u6301\u7A33\u5B9A\u3002",
  note: "\u601D\u8003\u5168\u6587\u663E\u793A\u3002\u4EE3\u7801\u3001\u94FE\u63A5\u3001\u56FE\u7247\u548C\u5DE5\u5177\u64CD\u4F5C\u6CBF\u7528\u539F\u751F\u80FD\u529B\u3002",
  processNote: "\u5148\u68C0\u67E5\u8BBE\u7F6E\u9875\u9762\u3001\u4FDD\u5B58\u8BF7\u6C42\u548C\u91CD\u65B0\u8BFB\u53D6\u914D\u7F6E\u7684\u8DEF\u5F84\u3002\u5206\u522B\u6838\u5BF9\u5DF2\u4FDD\u5B58\u7684\u503C\u4E0E\u8868\u5355\u663E\u793A\u7684\u503C\uFF0C\u590D\u73B0\u95EE\u9898\u540E\u518D\u8FDB\u884C\u4FEE\u6539\u3002",
  verificationNote: "\u9010\u9879\u68C0\u67E5\u6B63\u5E38\u4FDD\u5B58\u3001\u5EF6\u8FDF\u54CD\u5E94\u3001\u5931\u8D25\u91CD\u8BD5\u548C\u5237\u65B0\u540E\u7684\u6301\u4E45\u5316\u3002\u5B8C\u6574\u4FDD\u7559\u8FC7\u7A0B\uFF0C\u5B8C\u6210\u540E\u5728\u4E0B\u65B9\u7ED9\u51FA\u7B54\u590D\u3002",
  previewTool: "\u5DE5\u5177\u8BE6\u60C5 \xB7 \u793A\u4F8B",
  previewToolDetail: "\u4EC5\u4F9B\u9884\u89C8\uFF1A\u68C0\u67E5\u8BBE\u7F6E\u3001\u5E94\u7528\u4FEE\u6539\uFF0C\u518D\u6838\u5BF9\u4FDD\u5B58\u7ED3\u679C\u3002",
  processSample: "\u5DF2\u4FEE\u590D\u4FDD\u5B58\u540E\u56DE\u9000\u7684\u95EE\u9898\u3002\u5237\u65B0\u540E\u8BBE\u7F6E\u4ECD\u4FDD\u7559\u3002",
  rate: "\u663E\u793A\u5237\u65B0\u7387\u4E0E\u6A21\u578B\u751F\u6210\u901F\u5EA6\u76F8\u4E92\u72EC\u7ACB\uFF1B\u9075\u5FAA\u7CFB\u7EDF\u201C\u51CF\u5C11\u52A8\u6001\u6548\u679C\u201D\u8BBE\u7F6E\u3002",
  saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
  saved: "\u5DF2\u4FDD\u5B58",
  loading: "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026",
  unavailable: "\u5F53\u524D\u8FDE\u63A5\u65E0\u6CD5\u4FDD\u5B58\u8BBE\u7F6E\u3002",
  failed: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u5DF2\u6062\u590D\u6B64\u524D\u7684\u8BBE\u7F6E\u3002",
  thinking: "\u601D\u8003\u8FC7\u7A0B",
  answer: "\u56DE\u590D",
  stopped: "\u5DF2\u505C\u6B62",
  preview: "\u6548\u679C\u9884\u89C8",
  replay: "\u91CD\u64AD\u8F93\u51FA",
  sample: "\u6240\u6709\u98CE\u683C\u90FD\u4FDD\u7559\u5B8C\u6574\u56DE\u590D\u3002\n\n\u8C03\u6574\u95F4\u8DDD\u4E0E\u5B57\u53F7\uFF0C\u8BA9\u957F\u6587\u66F4\u6613\u9605\u8BFB\u3002\u65B0\u589E\u6587\u5B57\u5E73\u6ED1\u51FA\u73B0\uFF0C\u4EE3\u7801\u3001\u6587\u4EF6\u4E0E\u5DE5\u5177\u64CD\u4F5C\u4FDD\u6301\u53EF\u7528\u3002",
  copy: "\u590D\u5236",
  copied: "\u5DF2\u590D\u5236",
  code: "\u4EE3\u7801",
  wrap: "\u81EA\u52A8\u6362\u884C",
  unwrap: "\u53D6\u6D88\u6362\u884C",
  footnotes: "\u811A\u6CE8"
};

// src/client/styles.css
var styles_default = `/* Output typography stays inside this renderer; theme tokens keep both themes readable. */
.dsh-output-assistant { --output-size: 14px; --output-leading: 1.7; --output-space: 16px; --output-section-gap: 20px; min-width: 0; display: flex; flex-direction: column; gap: var(--output-section-gap); color: var(--dsw-alias-label-primary); font-size: var(--output-size); line-height: var(--output-leading); }
.dsh-output-assistant[data-output-density="tight"] { --output-leading: 1.5; --output-space: 8px; --output-section-gap: 12px; }
.dsh-output-assistant[data-output-text-size="large"] { --output-size: 16px; }
.dsh-output-assistant > section { min-width: 0; }
.dsh-output-label { margin-bottom: 8px; font-size: var(--dsh-content-font-size-secondary, 13px); line-height: 1.5; color: var(--dsw-alias-label-secondary); font-weight: 500; }
.dsh-output-reasoning { padding-left: 16px; border-left: 0.5px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
.dsh-output-reasoning [data-reasoning-full] { display: grid; gap: var(--output-space); }
.dsh-output-answer { display: flex; flex-direction: column; gap: var(--output-space); }
.dsh-output-answer-label { display: none; margin-bottom: 0; }
.dsh-output-assistant [data-output-text] > div { font-size: var(--output-size); line-height: var(--output-leading); }
.dsh-output-reasoning [data-output-text] > div { font-size: calc(var(--output-size) - 1px); color: var(--dsw-alias-label-secondary); }
.dsh-output-assistant [data-output-text] > div > :is(p, ul, ol, blockquote) { margin-block: var(--output-space); }
.dsh-output-answer [data-output-text] > div > :is(h1,h2,h3,h4,h5,h6) { margin-block: calc(var(--output-space) * 1.5) calc(var(--output-space) * .625); line-height: 1.45; font-weight: 600; }
.dsh-output-answer [data-output-text] > div > h1 { font-size: 1.5em; }
.dsh-output-answer [data-output-text] > div > h2 { font-size: 1.3em; }
.dsh-output-answer [data-output-text] > div > h3 { font-size: 1.15em; }
.dsh-output-answer [data-output-text] > div > :is(h4,h5,h6) { font-size: 1em; }
.dsh-output-assistant [data-output-text] > div > :first-child { margin-top: 0; }
.dsh-output-assistant [data-output-text] > div > :last-child { margin-bottom: 0; }
.dsh-output-stream { position: relative; min-width: 0; }
.dsh-output-fade-layer { position: absolute; inset: 0; pointer-events: none; user-select: none; overflow: clip; contain: layout style; }
.dsh-output-stopped { align-self: flex-start; padding: 0 6px; border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dsh-output-assistant[data-output-layout="cards"] > section { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, var(--dsw-alias-bg-layer-1)); padding: var(--output-space) 18px; }
.dsh-output-assistant[data-output-layout="cards"] .dsh-output-answer-label { display: block; }
.dsh-output-assistant[data-output-layout="process"] .dsh-output-reasoning { border-left-width: 2px; }
.dsh-output-assistant[data-output-layout="process"] .dsh-output-answer { border-top: 0.5px solid var(--dsw-alias-border-l2); padding-top: var(--output-space); }
.dsh-output-assistant[data-output-layout="process"] .dsh-output-answer-label,
.dsh-output-assistant[data-output-layout="checklist"] .dsh-output-answer-label { display: block; margin-bottom: 0; }
.dsh-output-assistant[data-output-layout="checklist"] .dsh-output-answer { padding: var(--output-space); border-radius: var(--dsw-radius-md); background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, var(--dsw-alias-bg-layer-1)); }
.dsh-output-checklist-step { position: relative; padding-left: 30px; gap: 8px; }
.dsh-output-checklist-step .dsh-output-reasoning { padding-left: 0; border: 0; }
.dsh-output-checklist-step .dsh-output-reasoning > .dsh-output-label { display: none; }
.dsh-output-step-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; font-size: var(--output-size); font-weight: 500; line-height: 1.5; }
.dsh-output-step-mark { position: absolute; top: 2px; left: 0; display: grid; place-items: center; width: 18px; height: 18px; border-radius: var(--dsw-radius-xs); font-size: 12px; line-height: 1; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.dsh-output-step-state { color: var(--dsw-alias-label-secondary); font-size: var(--dsh-content-font-size-secondary, 13px); font-weight: 400; }
.dsh-output-step-heading[data-output-step-status="running"] .dsh-output-step-mark { color: var(--dsw-alias-link); }
.dsh-output-step-heading[data-output-step-status="interrupted"] .dsh-output-step-mark { color: var(--dsw-alias-label-secondary); }

/* Version-pinned Chat seats retain their identities, scroll anchors and tool handlers. */
html[data-dsh-output-renderer] [data-chat-node-key][data-turn-process-hidden],
html[data-dsh-output-renderer] [data-chat-group-key][hidden] { display: block !important; content-visibility: visible !important; }
html[data-dsh-output-renderer] [data-chat-flow-kind="turn-process"] { display: none !important; }
html[data-dsh-output-renderer] [data-chat-group-key]:has(.dsh-output-reasoning) > div:first-child { display: none; }
html[data-dsh-output-renderer] [data-chat-group-key]:has(.dsh-output-reasoning) > [data-step-process-body] { display: block !important; content-visibility: visible !important; max-height: none; overflow: visible; mask-image: none; scrollbar-gutter: auto; }
html[data-dsh-output-renderer="cards"] [data-chat-group-key]:has(.dsh-output-reasoning) { padding: 16px 18px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, var(--dsw-alias-bg-layer-1)); }
html[data-dsh-output-renderer="cards"] [data-chat-group-key] .dsh-output-reasoning { border: 0; padding: 0; background: none; }
html[data-dsh-output-renderer="process"] [data-chat-group-key]:has(.dsh-output-reasoning),
.dsh-output-preview-process[data-output-layout="process"] { padding-left: 16px; border-left: 2px solid var(--dsw-alias-border-l2); }
html[data-dsh-output-renderer="process"] [data-chat-group-key] .dsh-output-reasoning,
.dsh-output-preview-process[data-output-layout="process"] .dsh-output-reasoning { border: 0; padding-left: 0; }
html[data-dsh-output-renderer="checklist"] [data-chat-group-key] [data-chat-flow-kind="tool-call"],
.dsh-output-preview-process[data-output-layout="checklist"] .dsh-output-preview-tools { margin-left: 30px; padding: 8px 12px; border-radius: var(--dsw-radius-sm); background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, var(--dsw-alias-bg-layer-1)); }

.dsh-output-settings { color: var(--dsw-alias-label-primary); min-width: 0; padding: 0 2px 24px; container-type: inline-size; }
.dsh-output-settings-header { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 6px; }
.dsh-output-settings h2 { font-size: 18px; font-weight: 500; margin: 0; }
.dsh-output-intro { font-size: 13px; line-height: 1.7; margin: 0 0 20px; color: var(--dsw-alias-label-secondary); }
.dsh-output-settings fieldset { min-width: 0; padding: 0; border: 0; margin: 0 0 20px; }
.dsh-output-settings legend { margin-bottom: 12px; font-size: 13px; line-height: 1.5; font-weight: 500; }
.dsh-output-options { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); grid-auto-rows: 1fr; gap: 12px; }
.dsh-output-settings .dsh-output-choice { min-width: 0; height: auto; align-items: stretch; justify-content: flex-start; display: flex; flex-direction: column; gap: 6px; padding: 14px; text-align: left; white-space: normal; }
.dsh-output-options .dsh-output-choice { display: grid; grid-template-columns: 48px minmax(0,1fr); align-items: center; gap: 14px; min-height: 96px; }
.dsh-output-choice-copy { min-width: 0; display: grid; gap: 4px; }
.dsh-output-choice-copy .dsh-output-description { text-wrap: balance; }
.dsh-output-settings button[aria-pressed="true"] { border-color: var(--dsw-alias-link); background: color-mix(in srgb, var(--dsw-alias-link) 6%, var(--dsw-alias-bg-layer-1)); }
.dsh-output-settings button:focus-visible { outline: 2px solid var(--dsw-alias-link); outline-offset: 3px; }
.dsh-output-choice-name { font-size: 13px; line-height: 1.5; font-weight: 500; }
.dsh-output-description { font-size: 13px; color: var(--dsw-alias-label-secondary); line-height: 1.7; }
.dsh-output-motions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.dsh-output-mini { box-sizing: border-box; min-height: 32px; display: grid; align-content: center; gap: 6px; width: 100%; padding: 4px 0; }
.dsh-output-mini i { display: block; height: 3px; width: 88%; border-radius: var(--dsw-radius-xs); background: var(--dsw-alias-border-l2); }
.dsh-output-mini i:first-child { width: 55%; }
.dsh-output-mini i:last-child { width: 72%; }
[data-choice="cards"] .dsh-output-mini { gap: 3px; }
[data-choice="cards"] .dsh-output-mini i { height: 6px; background: var(--dsw-alias-interactive-bg-active); }
[data-choice="process"] .dsh-output-mini { padding-left: 8px; border-left: 2px solid var(--dsw-alias-border-l2); }
[data-choice="process"] .dsh-output-mini i:last-child { width: 45%; background: var(--dsw-alias-label-secondary); }
[data-choice="checklist"] .dsh-output-mini { padding-left: 12px; }
[data-choice="checklist"] .dsh-output-mini i { position: relative; }
[data-choice="checklist"] .dsh-output-mini i::before { content: ''; position: absolute; left: -12px; top: -1px; width: 5px; height: 5px; border-radius: 1px; background: var(--dsw-alias-border-l2); }
.dsh-output-fields { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); padding: 0 16px; margin-bottom: 20px; }
.dsh-output-fields .dsh-output-field { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; border: 0; margin: 0; padding: 12px 0; font-size: 13px; line-height: 1.5; }
.dsh-output-fields .dsh-output-field + .dsh-output-field { border-top: 0.5px solid var(--dsw-alias-border-l3); }
.dsh-output-field > div:first-child { flex: 1; min-width: min(180px,100%); }
.dsh-output-field > * { max-width: 100%; }
.dsh-output-field .dsh-output-description { margin: 4px 0 0; }
.dsh-output-fields legend { float: left; margin: 0; font-weight: 400; padding: 5px 0; }
.dsh-output-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.dsh-output-settings-status { font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-secondary); }
.dsh-output-settings-status[data-error] { color: var(--dsw-alias-state-error-primary); }
.dsh-output-preview { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); padding: 16px; margin: 4px 0 12px; }
.dsh-output-preview-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; font-size: 13px; }
.dsh-output-preview .dsh-output-reasoning > p { margin: 0; font-size: calc(var(--output-size) - 1px); }
.dsh-output-preview-process { display: grid; gap: 20px; margin-bottom: 24px; }
.dsh-output-preview-tools { margin-top: 10px; font-size: 13px; line-height: 1.7; color: var(--dsw-alias-label-secondary); }
.dsh-output-preview-tools summary { cursor: pointer; }
.dsh-output-preview-tools p { margin: 8px 0 0; }
@container (max-width: 460px) { .dsh-output-options, .dsh-output-motions { grid-template-columns: minmax(0,1fr); } }
@container (max-width: 320px) {
  .dsh-output-fields { padding-inline: 12px; }
  .dsh-output-fields .dsh-output-field { align-items: flex-start; }
  .dsh-output-field > div:first-child { flex-basis: 100%; min-width: 0; }
  .dsh-output-controls { flex-basis: 100%; margin-left: 0; }
  .dsh-output-options .dsh-output-choice { grid-template-columns: 36px minmax(0,1fr); gap: 10px; padding: 12px; }
  .dsh-output-preview { padding: 12px; }
  .dsh-output-preview-header { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { .dsh-output-fade-layer { display: none; } }
`;

// src/client/index.ts
var inject = ["slots", "locale", "configForms"];
function apply(ctx) {
  const controller = createPreferences(ctx.configForms.get(ENTRY_ID));
  ctx.effect(() => () => controller.dispose());
  ctx.effect(() => ctx.locale.register(NS, { en, zh }));
  const outputText = ctx.locale.bind(NS);
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = PACKAGE_ID;
    style.dataset.pluginCss = "output-renderer";
    style.textContent = styles_default;
    document.head.append(style);
    const root = document.documentElement;
    const previous = root.getAttribute("data-dsh-output-renderer");
    let installed = "";
    const update = () => {
      installed = controller.store.getSnapshot().value.layout;
      root.setAttribute("data-dsh-output-renderer", installed);
    };
    update();
    const stop = controller.store.subscribe(update);
    return () => {
      stop();
      style.remove();
      if (root.getAttribute("data-dsh-output-renderer") === installed) {
        if (previous === null) root.removeAttribute("data-dsh-output-renderer");
        else root.setAttribute("data-dsh-output-renderer", previous);
      }
    };
  });
  const injectOutput = () => ({ hooks: { outputPreferences: controller.store }, outputText });
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "assistant-step",
    priority: -10,
    locale: "chat",
    inject: injectOutput
  }, Assistant));
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: ENTRY_ID,
    order: 14,
    label: () => outputText("section"),
    locale: NS,
    inject: () => ({ ...injectOutput(), setPreference: controller.set })
  }, Settings));
}
return module.exports;}});
