#!/usr/bin/env python3
"""APUS AI Inference — Streaming Demo."""

from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://hb.apus.network/~inference@1.0",
)

MODEL = "google/gemma-3-27b-it"


def stream_chat():
    print("=== Streaming Chat ===")
    stream = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Explain blockchain in 3 sentences."}],
        stream=True,
    )
    for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            print(content, end="", flush=True)
    print("\n")


if __name__ == "__main__":
    stream_chat()
