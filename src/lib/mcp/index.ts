import { defineMcp } from "@lovable.dev/mcp-js";
import askBot from "./tools/ask-bot";
import listBots from "./tools/list-bots";

export default defineMcp({
  name: "termux-copilot-mcp",
  title: "Termux Copilot",
  version: "0.1.0",
  instructions:
    "Termux Copilot exposes specialized bots that produce real, copy-pasteable Termux commands and bash scripts for Android. Use list_termux_bots to discover bots, then ask_termux_bot with the chosen bot id and your task.",
  tools: [listBots, askBot],
});
