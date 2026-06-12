#!/usr/bin/env python3
"""Static app server plus a local DeepSeek proxy.

The browser never receives the DeepSeek API key. The key is read from the
process environment or from .env.local in this workspace.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env.local"
DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


def read_local_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if not ENV_FILE.exists():
        return values
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def get_config() -> dict[str, str]:
    local = read_local_env()
    return {
        "api_key": local.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY", ""),
        "base_url": local.get("DEEPSEEK_BASE_URL")
        or os.environ.get("DEEPSEEK_BASE_URL")
        or DEFAULT_BASE_URL,
        "model": local.get("DEEPSEEK_MODEL") or os.environ.get("DEEPSEEK_MODEL") or DEFAULT_MODEL,
    }


def save_config(api_key: str, base_url: str, model: str) -> None:
    existing = read_local_env()
    existing["DEEPSEEK_API_KEY"] = api_key
    existing["DEEPSEEK_BASE_URL"] = base_url or DEFAULT_BASE_URL
    existing["DEEPSEEK_MODEL"] = model or DEFAULT_MODEL
    lines = [f"{key}={value}" for key, value in existing.items()]
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_json_body(handler: SimpleHTTPRequestHandler, limit: int = 128_000) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or "0")
    if length <= 0:
        return {}
    if length > limit:
        raise ValueError("request body too large")
    payload = handler.rfile.read(length).decode("utf-8")
    data = json.loads(payload)
    if not isinstance(data, dict):
        raise ValueError("JSON body must be an object")
    return data


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            raise
        data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("model did not return a JSON object")
    return data


def normalize_base_url(base_url: str) -> str:
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("DeepSeek base URL must be an HTTPS URL")
    return base_url.rstrip("/")


def call_deepseek(payload: dict[str, Any]) -> dict[str, Any]:
    config = get_config()
    api_key = config["api_key"].strip()
    if not api_key:
        raise PermissionError("DeepSeek API key is not configured")

    base_url = normalize_base_url(config["base_url"])
    endpoint = f"{base_url}/chat/completions"
    request_body = json.dumps(
        {
            "model": config["model"] or DEFAULT_MODEL,
            "messages": build_messages(payload),
            "temperature": 0.2,
            "stream": False,
            "response_format": {"type": "json_object"},
        },
        ensure_ascii=False,
    ).encode("utf-8")

    request = urllib.request.Request(
        endpoint,
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read().decode("utf-8")
    result = json.loads(raw)
    content = result["choices"][0]["message"]["content"]
    parsed = extract_json_object(content)
    parsed["_meta"] = {
        "model": result.get("model") or config["model"],
        "baseUrl": base_url,
        "provider": "deepseek",
    }
    return parsed


def build_messages(payload: dict[str, Any]) -> list[dict[str, str]]:
    match_name = str(payload.get("matchName") or "未指定比赛")
    pick_name = str(payload.get("pickName") or "未指定投注方向")
    text = str(payload.get("text") or "")
    portfolio = payload.get("portfolio") or {}
    local_factors = payload.get("localFactors") or []

    system = (
        "你是一个面向体育彩票输赢盘的风险分析助手。只分析胜负方向和资金风险，"
        "不要预测具体比分，不要承诺盈利。你必须输出严格 JSON。"
    )
    user = {
        "任务": "从赛前情报中提取爆冷风险因子，并给出资金与对冲建议。",
        "比赛": match_name,
        "投注方向": pick_name,
        "情报文本": text,
        "组合摘要": portfolio,
        "本地规则已识别因子": local_factors,
        "输出格式": {
            "summary": "80字以内中文摘要",
            "upsetRiskScore": "0到100的数字，越高代表爆冷或投注方向失效风险越高",
            "probabilityAdjustment": "建议将主观胜率下调/上调的百分点，负数代表下调",
            "hedgeTrigger": "触发对冲的具体条件",
            "factors": [
                {
                    "label": "因子名称",
                    "severity": "0到100数字",
                    "confidence": "0到1数字",
                    "evidence": "来自情报文本的简短证据",
                    "action": "可执行处理建议",
                }
            ],
            "strategyNotes": ["资金或对冲建议，每条不超过40字"],
        },
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
    ]


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".webmanifest": "application/manifest+json; charset=utf-8",
    }

    def end_headers(self) -> None:
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/deepseek/status":
            config = get_config()
            self.send_json(
                {
                    "configured": bool(config["api_key"]),
                    "baseUrl": config["base_url"],
                    "model": config["model"],
                }
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/config/deepseek":
                data = parse_json_body(self)
                api_key = str(data.get("apiKey") or "").strip()
                base_url = normalize_base_url(str(data.get("baseUrl") or DEFAULT_BASE_URL))
                model = str(data.get("model") or DEFAULT_MODEL).strip()
                if not api_key.startswith("sk-"):
                    self.send_json({"error": "API key format is invalid"}, HTTPStatus.BAD_REQUEST)
                    return
                save_config(api_key, base_url, model)
                self.send_json({"configured": True, "baseUrl": base_url, "model": model})
                return

            if parsed.path == "/api/deepseek/risk":
                data = parse_json_body(self)
                if not str(data.get("text") or "").strip():
                    self.send_json({"error": "text is required"}, HTTPStatus.BAD_REQUEST)
                    return
                self.send_json(call_deepseek(data))
                return

            self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        except PermissionError as error:
            self.send_json({"error": str(error)}, HTTPStatus.UNAUTHORIZED)
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")[:500]
            self.send_json(
                {"error": "DeepSeek API request failed", "status": error.code, "detail": body},
                HTTPStatus.BAD_GATEWAY,
            )
        except Exception as error:  # noqa: BLE001 - return a safe local API error.
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def send_json(self, data: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run BetDogEye with a local DeepSeek proxy.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    os.chdir(ROOT)
    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"BetDogEye running at http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
