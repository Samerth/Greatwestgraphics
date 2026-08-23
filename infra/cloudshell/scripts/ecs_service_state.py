#!/usr/bin/env python3
"""Classify ECS describe-services JSON for staging rolls.

Kinds (worst wins): stuck > rolling > stable
"""
from __future__ import annotations

import json
import sys
from typing import Any, Iterable


def classify_service(svc: dict[str, Any] | None, name: str) -> tuple[str, str]:
    if not svc:
        return "stuck", "missing"
    running = int(svc.get("runningCount") or 0)
    desired = int(svc.get("desiredCount") or 0)
    pending = int(svc.get("pendingCount") or 0)
    deployments = svc.get("deployments") or []
    states: list[str] = []
    failed = False
    in_progress = False
    for dep in deployments:
        roll = dep.get("rolloutState") or ""
        status = dep.get("status") or ""
        states.append(f"{status}:{roll or 'n/a'}")
        if roll == "FAILED" or status == "FAILED":
            failed = True
        if roll == "IN_PROGRESS":
            in_progress = True
    if pending > 0 or len(deployments) > 1:
        in_progress = True
    detail = (
        f"running={running} desired={desired} pending={pending} "
        f"deployments={len(deployments)} ({', '.join(states) or 'none'})"
    )
    if failed:
        return "stuck", detail
    if in_progress:
        return "rolling", detail
    if desired < 1 or running != desired:
        return "stuck", detail
    return "stable", detail


def classify_payload(data: dict[str, Any], wanted: Iterable[str]) -> list[tuple[str, str, str]]:
    by_name = {s.get("serviceName"): s for s in data.get("services") or []}
    rows = []
    for name in wanted:
        kind, detail = classify_service(by_name.get(name), name)
        rows.append((name, kind, detail))
    return rows


def worst_kind(kinds: Iterable[str]) -> str:
    order = {"stuck": 2, "rolling": 1, "stable": 0}
    worst = "stable"
    for kind in kinds:
        if order.get(kind, 2) > order[worst]:
            worst = kind if kind in order else "stuck"
    return worst


def dump_services(data: dict[str, Any], wanted: Iterable[str]) -> str:
    by_name = {s.get("serviceName"): s for s in data.get("services") or []}
    lines: list[str] = []
    for name in wanted:
        svc = by_name.get(name)
        lines.append(f"--- {name} ---")
        if not svc:
            lines.append("service not returned by DescribeServices")
            continue
        lines.append(
            f"running={svc.get('runningCount')} desired={svc.get('desiredCount')} "
            f"pending={svc.get('pendingCount')}"
        )
        for dep in svc.get("deployments") or []:
            lines.append(
                f"deployment {dep.get('status')} rollout={dep.get('rolloutState')} "
                f"failed={dep.get('failedTasks')} running={dep.get('runningCount')} "
                f"td={dep.get('taskDefinition')}"
            )
        for ev in (svc.get("events") or [])[:8]:
            msg = (ev.get("message") or "").replace("\n", " ")
            lines.append(f"{ev.get('createdAt')} {msg}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("usage: ecs_service_state.py summarize|kind|dump NAME [NAME...]", file=sys.stderr)
        return 2
    mode, wanted = argv[1], argv[2:]
    data = json.load(sys.stdin)
    rows = classify_payload(data, wanted)
    if mode == "summarize":
        for name, kind, detail in rows:
            print(f"{name}\t{kind}\t{detail}")
        return 0
    if mode == "kind":
        print(worst_kind(kind for _, kind, _ in rows))
        return 0
    if mode == "dump":
        print(dump_services(data, wanted))
        return 0
    print(f"unknown mode {mode}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
