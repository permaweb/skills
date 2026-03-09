#!/usr/bin/env python3
"""APUS AI Inference — Chat Demo (single-turn + multi-turn)."""

from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://hb.apus.network/~inference@1.0",
)

MODEL = "google/gemma-3-27b-it"


def single_turn():
    print("=== Single-Turn Chat ===")
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "What is 2 + 2?"}],
    )
    print("Assistant:", resp.choices[0].message.content)
    print()


def multi_turn():
    print("=== Multi-Turn Chat ===")
    messages = [
        {"role": "system", "content": "You are a math assistant."},
        {"role": "user", "content": "What is 10 * 10?"},
    ]

    resp = client.chat.completions.create(model=MODEL, messages=messages)
    print("Assistant:", resp.choices[0].message.content)

    messages.append({"role": "assistant", "content": resp.choices[0].message.content})
    messages.append({"role": "user", "content": "And what is 100 / 5?"})

    resp2 = client.chat.completions.create(model=MODEL, messages=messages)
    print("Assistant:", resp2.choices[0].message.content)
    print()


if __name__ == "__main__":
    single_turn()
    multi_turn()
