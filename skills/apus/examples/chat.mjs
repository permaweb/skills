#!/usr/bin/env node
/**
 * APUS AI Inference — Chat Demo (single-turn + multi-turn)
 *
 * Usage: node skills/apus/examples/chat.mjs
 * Requires: npm install openai
 */

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "",
  baseURL: "https://hb.apus.network/~inference@1.0",
});

const MODEL = "google/gemma-3-27b-it";

async function singleTurn() {
  console.log("=== Single-Turn Chat ===");
  const resp = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "What is 2 + 2?" }],
  });
  console.log("Assistant:", resp.choices[0].message.content);
  console.log();
}

async function multiTurn() {
  console.log("=== Multi-Turn Chat ===");
  const messages = [
    { role: "system", content: "You are a math assistant." },
    { role: "user", content: "What is 10 * 10?" },
  ];

  const resp = await client.chat.completions.create({ model: MODEL, messages });
  console.log("Assistant:", resp.choices[0].message.content);

  messages.push({ role: "assistant", content: resp.choices[0].message.content });
  messages.push({ role: "user", content: "And what is 100 / 5?" });

  const resp2 = await client.chat.completions.create({ model: MODEL, messages });
  console.log("Assistant:", resp2.choices[0].message.content);
  console.log();
}

await singleTurn();
await multiTurn();
