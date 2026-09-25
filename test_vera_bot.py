#!/usr/bin/env python3
"""
Vera Bot Test Harness — magicpin AI Challenge
==============================================
Exercises YOUR bot exactly the way the real judge harness does:
- Pushes all categories, merchants, customers, triggers via /v1/context
- Calls /v1/tick across a diverse slice of (merchant, trigger) pairs
  covering all 5 categories + both merchant- and customer-facing triggers
- Runs the 4 key behavioral probes via /v1/reply:
    1) Auto-reply detection (same canned reply 3x)
    2) Intent-handoff (merchant says "let's do it")
    3) Hostile handling ("stop messaging me")
    4) Curveball question mid-flow
- Times every call, checks schema shape, and dumps everything to
  vera_test_report.json so it can be scored against the rubric.

USAGE:
    Place this file in the SAME folder as your extracted challenge zip
    (so ./dataset/ is a sibling directory), then:

        export BOT_URL=https://vera-bot-r8yd.onrender.com
        python3 test_vera_bot.py

    It writes vera_test_report.json next to this script.
    Send that file back for scoring, or read the printed summary.

No third-party dependencies — stdlib only.
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from urllib import request as urlrequest, error as urlerror

# Configure UTF-8 for Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BOT_URL = os.environ.get("BOT_URL", "https://vera-bot-r8yd.onrender.com").rstrip("/")
DATASET_DIR = Path(__file__).parent / "dataset"
REPORT_PATH = Path(__file__).parent / "vera_test_report.json"

# A diverse slice: covers all 5 categories, merchant + customer scope,
# a range of trigger kinds (research, compliance, perf_dip, festival,
# winback, milestone, seasonal, supply_alert, competitor, dormancy).
TICK_TRIGGER_IDS = [
    "trg_001_research_digest_dentists",
    "trg_002_compliance_dci_radiograph",
    "trg_003_recall_due_priya",          # customer-facing
    "trg_004_perf_dip_bharat",
    "trg_006_festival_diwali",
    "trg_007_bridal_followup_kavya",     # customer-facing
    "trg_009_winback_glamour",
    "trg_010_ipl_match_delhi",
    "trg_011_review_theme_late_delivery",
    "trg_012_milestone_mylari",
    "trg_014_seasonal_acquisition_dip_powerhouse",
    "trg_015_winback_rashmi",            # customer-facing
    "trg_018_supply_atorvastatin_recall",
    "trg_019_chronic_refill_grandfather",# customer-facing
    "trg_021_unverified_gbp_sunrise",
    "trg_023_competitor_opened_dentist",
    "trg_025_dormancy_glamour",
]


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def http(method, path, body_dict=None, timeout=30):
    url = f"{BOT_URL}{path}"
    body = json.dumps(body_dict).encode("utf-8") if body_dict is not None else None
    req = urlrequest.Request(url, data=body, method=method,
                              headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        resp = urlrequest.urlopen(req, timeout=timeout)
        latency_ms = (time.time() - t0) * 1000
        raw = resp.read().decode("utf-8")
        try:
            return json.loads(raw), None, latency_ms, resp.status
        except json.JSONDecodeError:
            return None, f"non-JSON response: {raw[:200]}", latency_ms, resp.status
    except urlerror.HTTPError as e:
        latency_ms = (time.time() - t0) * 1000
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return json.loads(raw), None, latency_ms, e.code
        except Exception:
            return None, f"HTTP {e.code}: {raw[:200]}", latency_ms, e.code
    except Exception as e:
        return None, str(e), (time.time() - t0) * 1000, None


def load_dataset():
    cats = {}
    for f in (DATASET_DIR / "categories").glob("*.json"):
        d = json.load(open(f, encoding="utf-8"))
        cats[d.get("slug", f.stem)] = d

    merchants = {m["merchant_id"]: m for m in
                 json.load(open(DATASET_DIR / "merchants_seed.json", encoding="utf-8"))["merchants"]}
    customers = {c["customer_id"]: c for c in
                 json.load(open(DATASET_DIR / "customers_seed.json", encoding="utf-8"))["customers"]}
    triggers = {t["id"]: t for t in
                json.load(open(DATASET_DIR / "triggers_seed.json", encoding="utf-8"))["triggers"]}
    return cats, merchants, customers, triggers


def main():
    report = {
        "bot_url": BOT_URL, "started_at": now_iso(),
        "healthz": None, "metadata": None,
        "context_pushes": [], "tick_actions": [], "reply_probes": [],
        "issues": [],
    }

    print(f"== Testing bot at {BOT_URL} ==\n")

    print("[1/5] Loading dataset...")
    cats, merchants, customers, triggers = load_dataset()
    print(f"  {len(cats)} categories, {len(merchants)} merchants, "
          f"{len(customers)} customers, {len(triggers)} triggers loaded.\n")

    # Reset previous test run suppression so multiple runs don't suppress merchants
    http("POST", "/v1/teardown", {})

    print("[2/5] Checking /v1/healthz and /v1/metadata...")
    data, err, lat, code = http("GET", "/v1/healthz")
    report["healthz"] = {"data": data, "error": err, "latency_ms": lat, "code": code}
    print(f"  healthz -> {code} in {lat:.0f}ms" + (f"  ERROR: {err}" if err else ""))
    if err:
        report["issues"].append("healthz failed — bot may be asleep (Render free-tier cold start?) "
                                 "or endpoint missing/misnamed.")

    data, err, lat, code = http("GET", "/v1/metadata")
    report["metadata"] = {"data": data, "error": err, "latency_ms": lat, "code": code}
    print(f"  metadata -> {code} in {lat:.0f}ms" + (f"  ERROR: {err}" if err else ""))
    if not err and isinstance(data, dict):
        for k in ("team_name", "model", "approach"):
            if k not in data:
                report["issues"].append(f"/v1/metadata missing expected key '{k}'")

    print("\n[3/5] Pushing all contexts (category, merchant, customer, trigger)...")
    push_count = 0
    for slug, payload in cats.items():
        data, err, lat, code = http("POST", "/v1/context", {
            "scope": "category", "context_id": slug, "version": 1,
            "payload": payload, "delivered_at": now_iso()})
        report["context_pushes"].append({"scope": "category", "id": slug, "code": code,
                                          "error": err, "latency_ms": lat})
        push_count += 1
    for mid, payload in merchants.items():
        data, err, lat, code = http("POST", "/v1/context", {
            "scope": "merchant", "context_id": mid, "version": 1,
            "payload": payload, "delivered_at": now_iso()})
        report["context_pushes"].append({"scope": "merchant", "id": mid, "code": code,
                                          "error": err, "latency_ms": lat})
        push_count += 1
    for cid, payload in customers.items():
        data, err, lat, code = http("POST", "/v1/context", {
            "scope": "customer", "context_id": cid, "version": 1,
            "payload": payload, "delivered_at": now_iso()})
        report["context_pushes"].append({"scope": "customer", "id": cid, "code": code,
                                          "error": err, "latency_ms": lat})
        push_count += 1
    for tid, payload in triggers.items():
        data, err, lat, code = http("POST", "/v1/context", {
            "scope": "trigger", "context_id": tid, "version": 1,
            "payload": payload, "delivered_at": now_iso()})
        report["context_pushes"].append({"scope": "trigger", "id": tid, "code": code,
                                          "error": err, "latency_ms": lat})
        push_count += 1
    failed_pushes = [p for p in report["context_pushes"] if p["error"] or p["code"] not in (200,)]
    print(f"  Pushed {push_count} contexts. {len(failed_pushes)} failed/non-200.")
    if failed_pushes:
        report["issues"].append(f"{len(failed_pushes)} context pushes did not return 200 — "
                                 "check /v1/context handling.")

    print("\n[4/5] Calling /v1/tick with a diverse trigger slice...")
    conv_ids_by_merchant = {}
    data, err, lat, code = http("POST", "/v1/tick",
                                 {"now": now_iso(), "available_triggers": TICK_TRIGGER_IDS},
                                 timeout=30)
    if err or code != 200:
        print(f"  TICK FAILED: {err} (code {code})")
        report["issues"].append(f"/v1/tick failed outright: {err} (code {code})")
    else:
        actions = data.get("actions", [])
        print(f"  Bot returned {len(actions)} actions for {len(TICK_TRIGGER_IDS)} triggers offered.")
        for a in actions:
            trig = triggers.get(a.get("trigger_id", ""), {})
            merch = merchants.get(a.get("merchant_id", ""), {})
            cust = customers.get(a.get("customer_id")) if a.get("customer_id") else None
            enriched = {
                "action": a,
                "trigger_kind": trig.get("kind"),
                "trigger_scope": trig.get("scope"),
                "merchant_name": merch.get("identity", {}).get("name"),
                "category": merch.get("category_slug"),
                "customer_name": (cust or {}).get("identity", {}).get("name"),
                "latency_ms": lat,
            }
            report["tick_actions"].append(enriched)
            conv_ids_by_merchant[a.get("merchant_id")] = a.get("conversation_id")
        missing = set(TICK_TRIGGER_IDS) - {a.get("trigger_id") for a in actions}
        if missing:
            print(f"  (No action produced for {len(missing)} triggers — may be intentional restraint,"
                  f" or may indicate a routing gap: {sorted(missing)})")
        report["tick_latency_ms"] = lat

    print("\n[5/5] Running behavioral probes via /v1/reply...")

    probe_merchant = "m_001_drmeera_dentist_delhi"
    conv = conv_ids_by_merchant.get(probe_merchant, "conv_probe_autoreply")

    # Probe A: auto-reply detection (same canned line 3x)
    canned = "Thank you for contacting us. Our team will get back to you shortly."
    for i in range(1, 4):
        data, err, lat, code = http("POST", "/v1/reply", {
            "conversation_id": conv, "merchant_id": probe_merchant, "customer_id": None,
            "from_role": "merchant", "message": canned,
            "received_at": now_iso(), "turn_number": i + 1})
        report["reply_probes"].append({"probe": "auto_reply", "turn": i, "sent": canned,
                                        "response": data, "error": err, "latency_ms": lat, "code": code})
        print(f"  [auto-reply turn {i}] -> action={((data or {}).get('action'))}")

    # Probe B: intent-handoff ("let's do it" after a pitch)
    conv2 = "conv_probe_intent"
    data, err, lat, code = http("POST", "/v1/reply", {
        "conversation_id": conv2, "merchant_id": probe_merchant, "customer_id": None,
        "from_role": "merchant", "message": "Haan theek hai, chalo karte hain, sign me up",
        "received_at": now_iso(), "turn_number": 2})
    report["reply_probes"].append({"probe": "intent_handoff", "sent": "Haan theek hai, chalo karte hain, sign me up",
                                    "response": data, "error": err, "latency_ms": lat, "code": code})
    print(f"  [intent-handoff] -> action={((data or {}).get('action'))}, "
          f"body starts: {str((data or {}).get('body',''))[:80]!r}")

    # Probe C: hostile
    conv3 = "conv_probe_hostile"
    data, err, lat, code = http("POST", "/v1/reply", {
        "conversation_id": conv3, "merchant_id": probe_merchant, "customer_id": None,
        "from_role": "merchant", "message": "Stop messaging me. This is spam.",
        "received_at": now_iso(), "turn_number": 2})
    report["reply_probes"].append({"probe": "hostile", "sent": "Stop messaging me. This is spam.",
                                    "response": data, "error": err, "latency_ms": lat, "code": code})
    print(f"  [hostile] -> action={((data or {}).get('action'))}")

    # Probe D: curveball question
    conv4 = "conv_probe_curveball"
    data, err, lat, code = http("POST", "/v1/reply", {
        "conversation_id": conv4, "merchant_id": probe_merchant, "customer_id": None,
        "from_role": "merchant", "message": "Wait, who are you and how did you get this number?",
        "received_at": now_iso(), "turn_number": 2})
    report["reply_probes"].append({"probe": "curveball", "sent": "Wait, who are you and how did you get this number?",
                                    "response": data, "error": err, "latency_ms": lat, "code": code})
    print(f"  [curveball] -> action={((data or {}).get('action'))}")

    report["finished_at"] = now_iso()
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDone. Full report written to: {REPORT_PATH}")
    print("Send this file back (or paste its contents) to get it scored against the rubric.")

    if report["issues"]:
        print("\n== ISSUES FLAGGED ==")
        for i in report["issues"]:
            print(f"  - {i}")


if __name__ == "__main__":
    main()
