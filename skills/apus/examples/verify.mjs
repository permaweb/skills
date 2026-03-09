#!/usr/bin/env node
/**
 * APUS AI Inference — TEE Attestation Verification Demo
 *
 * Usage: node skills/apus/examples/verify.mjs
 * Requires: npm install openai
 */

import { createHash } from "node:crypto";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "",
  baseURL: "https://hb.apus.network/~inference@1.0",
});

const MODEL = "google/gemma-3-27b-it";
const VERIFY_URL = "https://hb.apus.network/~sev_gpu@1.0/verify";

async function chatWithAttestation() {
  console.log("=== Chat with TEE Attestation ===");

  const resp = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "What is AO?" }],
    tee: true,
  });

  console.log("Assistant:", resp.choices[0].message.content);
  console.log();

  // Extract attestation
  const attestation = resp.attestation;
  if (!attestation) {
    console.log("No attestation in response (tee may not be supported yet).");
    return;
  }

  console.log("=== Attestation Received ===");
  console.log("Nonce:", attestation.nonce ?? "N/A");
  console.log("Token length:", (attestation.token ?? "").length, "chars");
  console.log();

  // Verify binding: SHA-256(raw) === nonce
  const raw = attestation.raw ?? "";
  const nonce = attestation.nonce ?? "";
  const calculated = createHash("sha256").update(raw, "utf-8").digest("hex");

  if (calculated === nonce) {
    console.log("Binding check PASSED: SHA-256(raw) matches nonce");
  } else {
    console.log("Binding check FAILED: nonce mismatch");
    return;
  }

  // Verify via APUS Verifier Service
  console.log();
  console.log("=== Verifying via APUS Service ===");
  try {
    const verifyResp = await fetch(VERIFY_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      body: attestation.token,
    });
    const result = await verifyResp.text();
    console.log("Verification result:", result);
  } catch (err) {
    console.log(`Verification request failed: ${err.message}`);
  }
}

await chatWithAttestation();
