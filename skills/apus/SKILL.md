---
name: apus
description: AI inference via APUS on AO Network - deterministic, confidential, verifiable chat completions with TEE attestation. Use when the user wants to run AI inference through APUS, chat with AI models on AO, verify TEE attestation, or stream AI responses.
compatibility: Requires Python 3.8+ with openai SDK, or Node.js 18+ with openai package
metadata:
  author: apus-network
  version: "0.0.1"
---

# APUS AI Inference Skill

Run deterministic, confidential, and verifiable AI inference on AO Network via APUS. All inference runs inside a Trusted Execution Environment (TEE), producing attestation proofs that can be independently verified. The API is fully OpenAI-compatible, so existing code using the OpenAI SDK works with minimal changes.

## Phrase Mappings

| User Request | Action |
|--------------|--------|
| "use apus to chat" | Send a chat completion request |
| "use apus to ask" | Send a single-turn question |
| "use apus to stream" | Stream a chat completion response |
| "use apus to verify" | Verify TEE attestation of a response |
| "use apus to check health" | Check API health status |

## Prerequisites

Install the OpenAI SDK for your language of choice. No API key is required during the current test phase.

**Python:**

```bash
pip install openai
```

**Node.js:**

```bash
npm install openai
```

## API Reference

| Property | Value |
|----------|-------|
| Base URL | `https://hb.apus.network/~inference@1.0` |
| Model | `google/gemma-3-27b-it` |
| Auth | None required (test phase) |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat completions (single-turn, multi-turn, streaming) |
| POST | `/v1/completions` | Text completions |
| GET | `/health` | Health check |

## Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | — | Model ID. Use `google/gemma-3-27b-it` |
| `messages` | array | — | Array of message objects with `role` and `content` |
| `temperature` | float | 1.0 | Sampling temperature (0.0 - 2.0) |
| `max_tokens` | int | — | Maximum tokens to generate |
| `stream` | bool | false | Enable streaming response |
| `top_p` | float | 1.0 | Nucleus sampling threshold |
| `frequency_penalty` | float | 0.0 | Penalize repeated tokens (-2.0 to 2.0) |
| `presence_penalty` | float | 0.0 | Penalize tokens already present (-2.0 to 2.0) |
| `tee` | bool | false | Return TEE attestation with the response (APUS-specific) |

## Usage Guide

### Initialize Client

**Python:**

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://hb.apus.network/~inference@1.0/v1",
    api_key="unused",  # No key required during test phase
)
```

**Node.js:**

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://hb.apus.network/~inference@1.0/v1",
  apiKey: "unused", // No key required during test phase
});
```

### Single-Turn Chat

**Python:**

```python
response = client.chat.completions.create(
    model="google/gemma-3-27b-it",
    messages=[
        {"role": "user", "content": "What is AO Network?"}
    ],
    temperature=0.7,
    max_tokens=512,
)

print(response.choices[0].message.content)
```

**Node.js:**

```javascript
const response = await client.chat.completions.create({
  model: "google/gemma-3-27b-it",
  messages: [
    { role: "user", content: "What is AO Network?" }
  ],
  temperature: 0.7,
  max_tokens: 512,
});

console.log(response.choices[0].message.content);
```

### Multi-Turn Conversation

**Python:**

```python
messages = [
    {"role": "system", "content": "You are a helpful assistant knowledgeable about AO Network."},
    {"role": "user", "content": "What is AO Network?"},
]

response = client.chat.completions.create(
    model="google/gemma-3-27b-it",
    messages=messages,
    temperature=0.7,
    max_tokens=512,
)

# Append assistant reply and continue
assistant_reply = response.choices[0].message.content
messages.append({"role": "assistant", "content": assistant_reply})
messages.append({"role": "user", "content": "How does it relate to Arweave?"})

response = client.chat.completions.create(
    model="google/gemma-3-27b-it",
    messages=messages,
    temperature=0.7,
    max_tokens=512,
)

print(response.choices[0].message.content)
```

### Streaming

**Python:**

```python
stream = client.chat.completions.create(
    model="google/gemma-3-27b-it",
    messages=[
        {"role": "user", "content": "Explain TEE attestation in simple terms."}
    ],
    stream=True,
    max_tokens=512,
)

for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
print()
```

**Node.js:**

```javascript
const stream = await client.chat.completions.create({
  model: "google/gemma-3-27b-it",
  messages: [
    { role: "user", content: "Explain TEE attestation in simple terms." }
  ],
  stream: true,
  max_tokens: 512,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
console.log();
```

### TEE Attestation

Request a TEE attestation proof alongside the inference result by setting `tee: true` via `extra_body`.

**Python:**

```python
response = client.chat.completions.create(
    model="google/gemma-3-27b-it",
    messages=[
        {"role": "user", "content": "What is verifiable inference?"}
    ],
    max_tokens=256,
    extra_body={"tee": True},
)

print("Response:", response.choices[0].message.content)
print("Attestation:", response.tee)
```

### Attestation Response Structure

When `tee` is enabled, the response includes an attestation object:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Verifiable inference means ..."
      },
      "finish_reason": "stop"
    }
  ],
  "tee": {
    "tee_type": "SEV-SNP",
    "token": "<attestation-token>",
    "input_hash": "<sha256-hash-of-input>",
    "output_hash": "<sha256-hash-of-output>"
  }
}
```

### Verify Attestation

#### Method 1: APUS Verifier Service

Submit the attestation token to the APUS verification endpoint:

```bash
curl -X POST https://hb.apus.network/~sev_gpu@1.0/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<attestation-token>"
  }'
```

A successful response indicates the attestation is valid:

```json
{
  "valid": true,
  "tee_type": "SEV-SNP",
  "details": {
    "measurement": "...",
    "report_data": "..."
  }
}
```

#### Method 2: NVIDIA SDK

For independent local verification using the NVIDIA Attestation SDK:

```bash
pip install nv-attestation-sdk
```

```python
import hashlib
from nv_attestation_sdk import attestation

# 1. Verify the attestation token signature and claims
verifier = attestation.Verifier()
result = verifier.verify_token(attestation_token)
print("Token valid:", result.valid)

# 2. Verify input/output hash integrity
input_data = '{"messages": [{"role": "user", "content": "What is verifiable inference?"}]}'
computed_hash = hashlib.sha256(input_data.encode()).hexdigest()
assert computed_hash == response_tee["input_hash"], "Input hash mismatch"
print("Input hash verified")
```

### Health Check

```bash
curl https://hb.apus.network/~inference@1.0/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Demo Scripts

| Script | Description | Run Command |
|--------|-------------|-------------|
| `examples/chat.py` | Single-turn chat (Python) | `python skills/apus/examples/chat.py` |
| `examples/stream.py` | Streaming response (Python) | `python skills/apus/examples/stream.py` |
| `examples/verify.py` | TEE attestation + verification (Python) | `python skills/apus/examples/verify.py` |
| `examples/chat.mjs` | Single-turn chat (Node.js) | `node skills/apus/examples/chat.mjs` |
| `examples/verify.mjs` | TEE attestation + verification (Node.js) | `node skills/apus/examples/verify.mjs` |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Connection refused` | APUS inference service is unreachable | Check network connectivity; verify the base URL; retry after a short wait |
| `Model not found` | Invalid or unsupported model ID | Use `google/gemma-3-27b-it` as the model parameter |
| `Attestation verification failed` | TEE attestation token is invalid or tampered | Re-request with `tee: true`; verify you are using the correct token; try the APUS verifier service |

## Notes

- **No API key required** during the current test phase. Set `api_key` to any non-empty string (e.g. `"unused"`).
- **OpenAI-compatible API** -- any code written for the OpenAI SDK works by changing only `base_url` and `api_key`.
- **`tee` is APUS-specific** -- this parameter is not part of the OpenAI spec. Pass it via `extra_body` in Python or as an additional body field in Node.js.

## See Also

- [APUS Network Documentation](https://docs.apus.network)
- [APUS Network GitHub](https://github.com/apuslabs)
- [AO Network](https://ao.arweave.dev)
- [OpenAI Python SDK](https://github.com/openai/openai-python)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
