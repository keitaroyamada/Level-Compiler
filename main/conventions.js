"use strict";

// Naming rules for the staged main-process refactor.
// This file is intentionally side-effect free so it can be introduced
// before any runtime wiring changes.

const WINDOW_TYPES = Object.freeze({
  MAIN: "main",
  FINDER: "finder",
  DIVIDER: "divider",
  CONVERTER: "converter",
  LABELER: "labeler",
  SETTINGS: "settings",
  IMAGE_VIEWER: "image_viewer",
  PLOTTER: "plotter",
  PROGRESS: "progress",
  ABOUT: "about",
});

const IPC_CHANNEL_RULES = Object.freeze({
  separator: "camelCase",
  format: "<scope><Action>",
  examples: [
    "finderOpen",
    "finderClose",
    "workspaceChange",
    "settingsSend",
  ],
});

const IPC_PAYLOAD_RULES = Object.freeze({
  preferredArgumentShape: "single_payload_object",
  compatibilityStrategy: "handler_accepts_legacy_args_during_migration",
});

function buildChannelName(scope, action) {
  return `${scope}${action.charAt(0).toUpperCase()}${action.slice(1)}`;
}

module.exports = {
  WINDOW_TYPES,
  IPC_CHANNEL_RULES,
  IPC_PAYLOAD_RULES,
  buildChannelName,
};
