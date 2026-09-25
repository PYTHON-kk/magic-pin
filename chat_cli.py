#!/usr/bin/env python3
"""
Interactive CLI to chat live with your deployed Vera Bot.

Usage:
  python chat_cli.py <your-render-url>
  python chat_cli.py https://vera-bot-xxxx.onrender.com
"""

import sys
import json
import uuid
from datetime import datetime, timezone
from urllib import request as urlrequest, error as urlerror

# Configure UTF-8 for Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urlrequest.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "VeraCLI/1.0"},
    )
    with urlrequest.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(url: str) -> dict:
    req = urlrequest.Request(
        url,
        headers={"User-Agent": "VeraCLI/1.0"},
    )
    with urlrequest.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    print("\n" + "=" * 60)
    print("      💬 Vera AI — Interactive Merchant Chat CLI")
    print("=" * 60 + "\n")

    # Get URL
    if len(sys.argv) > 1:
        base_url = sys.argv[1].rstrip("/")
    else:
        base_url = input("Enter your deployed URL (e.g. https://vera-bot-xxxx.onrender.com): ").strip().rstrip("/")

    if not base_url:
        base_url = "http://localhost:8080"

    print(f"\n[Connecting to {base_url} ...]")

    # Check healthz
    try:
        health = get_json(f"{base_url}/v1/healthz")
        print(f"✅ Connected! Status: {health.get('status', 'ok')} (Uptime: {health.get('uptime_seconds', 0)}s)")
    except Exception as e:
        print(f"❌ Connection error: {e}")
        print("Please check your URL and make sure the service is Live on Render.")
        sys.exit(1)

    # Initialize a sample merchant context so Vera knows who she is talking to
    print("\n[Loading sample merchant context (Dr. Meera Dental Clinic) ...]")
    try:
        post_json(f"{base_url}/v1/context", {
            "scope": "category",
            "context_id": "dentists",
            "version": 1,
            "payload": {
                "slug": "dentists",
                "voice": {
                    "tone": "peer_clinical",
                    "vocab_preferred": ["patient footfall", "chair time", "OPD", "recall"],
                    "vocab_taboo": ["customers", "discounting", "cheap", "sale", "mega deal"],
                },
            },
            "delivered_at": datetime.now(timezone.utc).isoformat(),
        })

        post_json(f"{base_url}/v1/context", {
            "scope": "merchant",
            "context_id": "m_001_drmeera",
            "version": 1,
            "payload": {
                "identity": {
                    "id": "m_001_drmeera",
                    "name": "Dr. Meera's Dental Clinic",
                    "owner_first_name": "Meera",
                    "locality": "Indiranagar, Bangalore",
                    "languages": ["en", "hi"],
                },
                "category_slug": "dentists",
                "performance": {"views": 1420, "calls": 38, "ctr": 0.042},
            },
            "delivered_at": datetime.now(timezone.utc).isoformat(),
        })
        print("✅ Context loaded successfully!\n")
    except Exception as e:
        print(f"⚠️ Context setup warning: {e}\n")

    conv_id = f"cli_{uuid.uuid4().hex[:8]}"
    turn = 1

    print("-" * 60)
    print("Role: You are Dr. Meera (Dentist in Indiranagar)")
    print("Type your message to Vera and press Enter.")
    print("Type 'exit' or 'quit' to end.")
    print("-" * 60 + "\n")

    while True:
        try:
            user_msg = input("\nDr. Meera 👤: ").strip()
            if not user_msg:
                continue
            if user_msg.lower() in ("exit", "quit"):
                print("\nGoodbye!")
                break

            print("Vera is typing ...")

            resp = post_json(f"{base_url}/v1/reply", {
                "conversation_id": conv_id,
                "merchant_id": "m_001_drmeera",
                "from_role": "merchant",
                "message": user_msg,
                "turn_number": turn,
                "received_at": datetime.now(timezone.utc).isoformat(),
            })

            action = resp.get("action", "send")
            body = resp.get("body", "")
            cta = resp.get("cta", "none")
            rationale = resp.get("rationale", "")

            print(f"\n🤖 Vera [{action.upper()}]:")
            if body:
                print(f'"{body}"')
            if cta and cta != "none":
                print(f"👉 CTA: {cta}")
            if rationale:
                print(f"💡 Rationale: {rationale}")

            turn += 1

            if action == "end":
                print("\n[Conversation closed by Vera]")
                break

        except KeyboardInterrupt:
            print("\nExiting chat...")
            break
        except Exception as e:
            print(f"\n❌ Error during reply: {e}")


if __name__ == "__main__":
    main()
