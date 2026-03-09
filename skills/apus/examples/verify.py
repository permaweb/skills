#!/usr/bin/env python3
"""APUS AI Inference — TEE Attestation Verification Demo."""

import hashlib
import json
import urllib.request

from openai import OpenAI

client = OpenAI(
    api_key="",
    base_url="https://hb.apus.network/~inference@1.0",
)

MODEL = "google/gemma-3-27b-it"

VERIFY_URL = "https://hb.apus.network/~sev_gpu@1.0/verify"


def chat_with_attestation():
    print("=== Chat with TEE Attestation ===")
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "What is AO?"}],
        extra_body={"tee": True},
    )
    print("Assistant:", resp.choices[0].message.content)
    print()

    # Extract attestation from response
    raw_resp = resp.model_extra or {}
    attestation = raw_resp.get("attestation")
    if not attestation:
        print("No attestation in response (tee may not be supported yet).")
        return

    print("=== Attestation Received ===")
    print("Nonce:", attestation.get("nonce", "N/A"))
    print("Token length:", len(attestation.get("token", "")), "chars")
    print()

    # Verify binding: SHA-256(raw) == nonce
    raw = attestation.get("raw", "")
    nonce = attestation.get("nonce", "")
    calculated = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    if calculated == nonce:
        print("Binding check PASSED: SHA-256(raw) matches nonce")
    else:
        print("Binding check FAILED: nonce mismatch")
        return

    # Verify via APUS Verifier Service
    print()
    print("=== Verifying via APUS Service ===")
    try:
        req = urllib.request.Request(
            VERIFY_URL,
            data=attestation.get("token", "").encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            result = response.read().decode("utf-8")
            print("Verification result:", result)
    except Exception as e:
        print(f"Verification request failed: {e}")


if __name__ == "__main__":
    chat_with_attestation()
