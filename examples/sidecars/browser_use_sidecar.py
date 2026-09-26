#!/usr/bin/env python3
"""Buyer Arena reference sidecar for Browser Use (https://github.com/browser-use/browser-use, MIT).

Contract (src/engines/external.ts, docs/INTEGRATIONS.md):
  stdin  -> {"brief": {...}, "task": {"success": {...}}, "max_steps": n, "timeout_ms": n}
  stdout <- {"status": "...", "final_url": "...", "abandon_reason"?: "...", "events": [...]}

Usage:
  pip install "browser-use>=0.13,<0.14"            # Python >= 3.11
  buyer-arena run --url http://localhost:3000 --success-text "welcome" \
      --engine-cmd "python examples/sidecars/browser_use_sidecar.py"

Model (env BA_BU_LLM, default "ollama:llama3.1" so it can run fully offline):
  ollama:<model> | openai:<model> | anthropic:<model> | scripted
  "scripted" is a deterministic stand-in (no LLM, no key) used by Buyer Arena's own tests to
  prove the Browser Use path end to end: it opens the page, visits one same-origin link whose
  text mentions pricing if there is one, then stops.
Keys stay in THIS process's environment (OPENAI_API_KEY, ANTHROPIC_API_KEY); Buyer Arena never
passes its own. Under network policy OFFLINE Buyer Arena only starts this sidecar when
BUYER_ARENA_ENGINE_OFFLINE_SAFE=1, i.e. with a local model.

Containers: set BA_BU_NO_SANDBOX=1 when Chrome runs as root (it cannot sandbox there).

Safety:
  - allowed_domains is restricted to the start origin; public targets also get
    block_ip_addresses=True (not for localhost targets, which it would block).
  - Browser Use telemetry and cloud sync are switched off before import.
  - The agent is told to use only synthetic data. Success is NOT taken from the agent's own
    claim: it counts only if the task's success pattern matches what was observed.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
from typing import Any
from urllib.parse import urlparse

os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
os.environ.setdefault("BROWSER_USE_CLOUD_SYNC", "false")


def emit(result: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(result))
    sys.stdout.flush()


def fail(url: str, message: str) -> None:
    emit(
        {
            "status": "error",
            "final_url": url,
            "abandon_reason": message[:300],
            "events": [{"type": "error", "url": url, "step": 0, "detail": message[:300]}],
        }
    )


def build_task(req: dict[str, Any]) -> str:
    brief = req["brief"]
    persona = json.dumps(brief.get("persona", {}), ensure_ascii=False)
    return "\n".join(
        [
            "You are role-playing a prospective customer using a website. Stay in character.",
            f"PERSONA: {persona}",
            f"STORY: {brief.get('story', '')}",
            f"TASK: {brief.get('task', '')}",
            f"Start at {brief['start_url']} and stay on that website.",
            "Use only obviously synthetic data (email <id>@buyers.example.test, phone 555-0100).",
            "Give up (finish with success=false) if this person would give up.",
        ]
    )


def make_llm(spec: str, start_url: str) -> Any:
    kind, _, model = spec.partition(":")
    if kind == "scripted":
        return ScriptedLLM(start_url)
    import browser_use  # noqa: PLC0415 (import only when a real model is requested)

    if kind == "ollama":
        return browser_use.ChatOllama(model=model or "llama3.1")
    if kind == "openai":
        return browser_use.ChatOpenAI(model=model or "gpt-4.1-mini")
    if kind == "anthropic":
        return browser_use.ChatAnthropic(model=model or "claude-haiku-4-5")
    raise ValueError(f"unknown BA_BU_LLM {spec!r} (ollama:<m> | openai:<m> | anthropic:<m> | scripted)")


class ScriptedLLM:
    """Deterministic BaseChatModel stand-in: navigate to a pricing link if present, then done."""

    model = "scripted"
    _verified_api_keys = True

    def __init__(self, start_url: str) -> None:
        self.start_url = start_url
        self.calls = 0

    @property
    def provider(self) -> str:
        return "buyer-arena-scripted"

    @property
    def name(self) -> str:
        return "scripted"

    @property
    def model_name(self) -> str:
        return self.model

    async def ainvoke(self, messages: list[Any], output_format: Any = None, **kwargs: Any) -> Any:
        from browser_use.llm.views import ChatInvokeCompletion  # noqa: PLC0415

        self.calls += 1
        text = "\n".join(str(getattr(m, "text", "") or getattr(m, "content", "")) for m in messages)
        origin = "{0.scheme}://{0.netloc}".format(urlparse(self.start_url))
        if self.calls == 1 and re.search(r"pricing|prices|plans", text, re.I):
            action: dict[str, Any] = {"navigate": {"url": f"{origin}/pricing", "new_tab": False}}
            goal = "Check the prices."
        else:
            action = {"done": {"text": "I have seen enough for now.", "success": False}}
            goal = "Stop here."
        payload = {"evaluation_previous_goal": "ok", "memory": "", "next_goal": goal, "action": [action]}
        completion = output_format.model_validate(payload) if output_format else json.dumps(payload)
        return ChatInvokeCompletion(completion=completion, usage=None)


def map_history(history: Any, start_url: str) -> list[dict[str, Any]]:
    """AgentHistoryList -> Buyer Arena events (navigate / click / fill / scroll / back / decision)."""
    events: list[dict[str, Any]] = [{"type": "navigate", "url": start_url, "step": 0, "t": 0}]
    last_url = start_url
    kinds = {"click": "click", "input": "fill", "send_keys": "fill", "scroll": "scroll", "go_back": "back"}
    for step, item in enumerate(getattr(history, "history", []) or [], start=1):
        url = getattr(getattr(item, "state", None), "url", None) or last_url
        if url and url != last_url:
            events.append({"type": "navigate", "url": url, "step": step})
            last_url = url
        out = getattr(item, "model_output", None)
        goal = getattr(out, "next_goal", None) if out else None
        if goal:
            events.append({"type": "decision", "url": last_url, "step": step, "detail": str(goal)[:300]})
        for act in (getattr(out, "action", None) or []) if out else []:
            data = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else dict(act)
            for name, params in data.items():
                if name in kinds:
                    target = params.get("index") if isinstance(params, dict) else None
                    events.append({"type": kinds[name], "url": last_url, "step": step, "target": str(target) if target is not None else None})
        for res in getattr(item, "result", None) or []:
            err = getattr(res, "error", None)
            if err:
                events.append({"type": "error", "url": last_url, "step": step, "detail": str(err)[:300]})
    for e in events:
        if e.get("target") is None:
            e.pop("target", None)
    return events


def success_observed(task: dict[str, Any], final_url: str, texts: list[str]) -> bool:
    s = task.get("success", {}) if isinstance(task, dict) else {}
    if s.get("url_pattern") and re.search(s["url_pattern"], final_url, re.I):
        return True
    if s.get("text_pattern"):
        return any(re.search(s["text_pattern"], t or "", re.I) for t in texts)
    return False


async def main() -> None:
    req = json.loads(sys.stdin.read())
    start_url: str = req["brief"]["start_url"]
    started = time.time()
    try:
        from browser_use import Agent, BrowserProfile  # noqa: PLC0415
    except ImportError:
        fail(start_url, 'browser-use is not installed: pip install "browser-use>=0.13,<0.14" (Python >= 3.11)')
        return
    parsed = urlparse(start_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    local = parsed.hostname in ("localhost", "127.0.0.1", "::1") or (parsed.hostname or "").endswith(".localhost")
    profile = BrowserProfile(
        headless=True,
        allowed_domains=[origin],
        block_ip_addresses=not local,
        executable_path=os.environ.get("BUYER_ARENA_CHROMIUM_PATH") or None,
        user_data_dir=None,
        # Containers running as root cannot use Chrome's sandbox; opt out explicitly only there.
        chromium_sandbox=os.environ.get("BA_BU_NO_SANDBOX") != "1",
    )
    llm = make_llm(os.environ.get("BA_BU_LLM", "ollama:llama3.1"), start_url)
    agent = Agent(
        task=build_task(req),
        llm=llm,
        browser_profile=profile,
        use_vision=False,
        calculate_cost=True,
        # Open the start URL deterministically instead of letting the model guess it.
        initial_actions=[{"navigate": {"url": start_url, "new_tab": False}}],
    )
    try:
        history = await asyncio.wait_for(agent.run(max_steps=int(req.get("max_steps", 14))), timeout=req.get("timeout_ms", 60000) / 1000)
    except asyncio.TimeoutError:
        emit({"status": "timeout", "final_url": start_url, "events": [{"type": "timeout", "url": start_url, "step": 0}]})
        return
    except Exception as err:  # noqa: BLE001 — report, never crash the session
        fail(start_url, f"browser-use failed: {err}")
        return
    urls = [u for u in (history.urls() or []) if u]
    final_url = urls[-1] if urls else start_url
    texts = [str(x) for x in (history.extracted_content() or [])]
    events = map_history(history, start_url)
    claimed = bool(history.is_done() and history.is_successful())
    observed = success_observed(req.get("task", {}), final_url, texts)
    status = "completed" if observed else ("abandoned" if history.is_done() else "step_limit")
    result: dict[str, Any] = {"status": status, "final_url": final_url, "events": events}
    if status != "completed":
        result["abandon_reason"] = (
            "agent reported success, but the success criteria were not observed" if claimed else (history.final_result() or "stopped")[:300]
        )
        events.append({"type": "abandon", "url": final_url, "step": len(events), "detail": result["abandon_reason"][:300]})
    usage = getattr(history, "usage", None)
    if usage is not None:
        events.append(
            {
                "type": "provider_call",
                "url": final_url,
                "step": len(events),
                "detail": f"tokens={getattr(usage, 'total_tokens', 0)} cost={getattr(usage, 'total_cost', 0)} duration_s={round(time.time() - started, 1)}",
            }
        )
    emit(result)


if __name__ == "__main__":
    asyncio.run(main())
