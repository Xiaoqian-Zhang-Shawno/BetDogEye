#!/usr/bin/env python3
"""Static app server plus a local OpenAI-compatible model proxy.

The browser never receives model API keys. Keys are read from the process
environment or from .env.local in this workspace.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse


ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env.local"
DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_PROVIDER = "DeepSeek"
NEWS_TIMEOUT_SECONDS = 8
MAX_NEWS_ITEMS = 12


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
        "provider": local.get("LLM_PROVIDER")
        or os.environ.get("LLM_PROVIDER")
        or local.get("DEEPSEEK_PROVIDER")
        or os.environ.get("DEEPSEEK_PROVIDER")
        or DEFAULT_PROVIDER,
        "api_key": local.get("LLM_API_KEY")
        or os.environ.get("LLM_API_KEY", "")
        or local.get("DEEPSEEK_API_KEY")
        or os.environ.get("DEEPSEEK_API_KEY", ""),
        "base_url": local.get("LLM_BASE_URL")
        or os.environ.get("LLM_BASE_URL")
        or local.get("DEEPSEEK_BASE_URL")
        or os.environ.get("DEEPSEEK_BASE_URL")
        or DEFAULT_BASE_URL,
        "model": local.get("LLM_MODEL")
        or os.environ.get("LLM_MODEL")
        or local.get("DEEPSEEK_MODEL")
        or os.environ.get("DEEPSEEK_MODEL")
        or DEFAULT_MODEL,
    }


def save_config(api_key: str, base_url: str, model: str, provider: str) -> None:
    existing = read_local_env()
    existing["LLM_PROVIDER"] = provider or DEFAULT_PROVIDER
    existing["LLM_API_KEY"] = api_key
    existing["LLM_BASE_URL"] = base_url or DEFAULT_BASE_URL
    existing["LLM_MODEL"] = model or DEFAULT_MODEL
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
        raise ValueError("Model base URL must be an HTTPS URL")
    return base_url.rstrip("/")


def request_model_json(messages: list[dict[str, str]], temperature: float = 0.2) -> dict[str, Any]:
    config = get_config()
    api_key = config["api_key"].strip()
    if not api_key:
        raise PermissionError("Model API key is not configured")

    base_url = normalize_base_url(config["base_url"])
    endpoint = f"{base_url}/chat/completions"
    request_body = json.dumps(
        {
            "model": config["model"] or DEFAULT_MODEL,
            "messages": messages,
            "temperature": temperature,
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
        "provider": config["provider"],
    }
    return parsed


def call_model_risk(payload: dict[str, Any]) -> dict[str, Any]:
    return request_model_json(build_messages(payload), temperature=0.2)


def call_model_intel_refresh(payload: dict[str, Any], news_items: list[dict[str, str]]) -> dict[str, Any]:
    match_name = str(payload.get("matchName") or "未指定比赛")
    pick_name = str(payload.get("pickName") or "未指定投注方向")
    search_query = str(payload.get("query") or "").strip()
    system = (
        "你是一个赛前情报整理助手。你只能基于提供的新闻搜索结果归纳，"
        "不要编造未在搜索结果中出现的信息。不要预测具体比分。必须输出严格 JSON。"
    )
    user = {
        "任务": "根据新闻搜索结果生成一段可用于后续投注风险分析的情报文本。",
        "比赛": match_name,
        "投注方向": pick_name,
        "用户补充查询": search_query,
        "新闻搜索结果": news_items,
        "输出格式": {
            "intelText": "180到350字中文情报文本，覆盖伤停、阵容、赛程、士气、市场异常等已出现信号；没有证据就写暂无明确公开信号",
            "summary": "60字以内摘要",
            "searchQuery": "你认为最有效的查询词",
            "sources": [
                {
                    "title": "来源标题",
                    "url": "来源链接",
                    "source": "媒体或搜索源",
                    "publishedAt": "发布时间，未知则为空",
                    "relevance": "0到100数字",
                }
            ],
            "nextSteps": ["建议用户继续核实的事项，每条不超过30字"],
        },
    }
    parsed = request_model_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
        temperature=0.15,
    )
    parsed["rawSources"] = news_items
    return parsed


def call_model_portfolio_refresh(payload: dict[str, Any], news_items: list[dict[str, str]]) -> dict[str, Any]:
    open_bets = payload.get("openBets") or []
    system = (
        "你是一个投注组合赛前情报分析助手。你只能基于提供的新闻搜索结果归纳，"
        "必须严格围绕用户已下注且未结算的球队、国家或比赛，不要输出无关球队、无关赛事或泛泛新闻。"
        "关注伤停、阵容、政治/地缘事件、金融/赞助/足协财政、花边舆情、更衣室、纪律和市场异常。"
        "不要预测具体比分，不要承诺盈利。必须输出严格 JSON。"
    )
    user = {
        "任务": "从公开搜索结果中生成未结算投注组合的最新风险情报。",
        "未结算下注记录": open_bets,
        "新闻搜索结果": news_items,
        "过滤要求": [
            "只保留与未结算下注记录中的球队、国家、比赛双方明确相关的信息",
            "删除无关球队、历史复盘、泛体育新闻和无法关联到当前下注记录的内容",
            "政治、金融、花边新闻只有在会影响士气、出场、管理层、舆论压力或赛事环境时才保留",
        ],
        "输出格式": {
            "intelText": "250到500字中文情报文本，按比赛或球队归纳，明确写出风险来源；无证据则写暂无明确公开信号",
            "summary": "80字以内组合摘要",
            "searchQuery": "最有效的查询词总结",
            "sources": [
                {
                    "title": "来源标题",
                    "url": "来源链接",
                    "source": "媒体或搜索源",
                    "publishedAt": "发布时间，未知则为空",
                    "relevance": "0到100数字",
                }
            ],
            "nextSteps": ["建议用户继续核实的事项，每条不超过30字"],
            "coveredBets": ["被覆盖的未结算比赛或球队"],
        },
    }
    parsed = request_model_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
        temperature=0.12,
    )
    parsed["rawSources"] = news_items
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


def refresh_news_items(payload: dict[str, Any]) -> list[dict[str, str]]:
    match_name = str(payload.get("matchName") or "").strip()
    pick_name = str(payload.get("pickName") or "").strip()
    custom_query = str(payload.get("query") or "").strip()
    base = custom_query or " ".join(part for part in [match_name, pick_name] if part)
    if not base:
        raise ValueError("matchName or query is required")

    queries = [
        base,
        f"{base} 伤病 停赛 阵容",
        f"{base} 更衣室 内讧 士气",
        f"{base} 赔率 爆冷 盘口",
    ]
    seen: set[str] = set()
    items: list[dict[str, str]] = []
    for query in queries:
        for feed_name, url in build_news_feed_urls(query):
            for item in fetch_rss_items(feed_name, url, query):
                if not is_relevant_news_item(item, extract_terms_from_text(f"{match_name} {pick_name} {custom_query}")):
                    continue
                fingerprint = (item["title"].lower(), item["url"].split("?")[0])
                key = "|".join(fingerprint)
                if key in seen:
                    continue
                seen.add(key)
                items.append(item)
                if len(items) >= MAX_NEWS_ITEMS:
                    return items
    return items


def refresh_portfolio_news_items(payload: dict[str, Any]) -> list[dict[str, str]]:
    open_bets = [bet for bet in payload.get("openBets") or [] if isinstance(bet, dict)]
    if not open_bets:
        raise ValueError("openBets is required")

    seen: set[str] = set()
    items: list[dict[str, str]] = []
    fallback_items: list[dict[str, str]] = []
    for bet in open_bets[:10]:
        terms = extract_terms_from_bet(bet)
        if not terms:
            continue
        for query in build_portfolio_queries(bet, terms):
            for feed_name, url in build_news_feed_urls(query):
                for item in fetch_rss_items(feed_name, url, query):
                    fingerprint = (item["title"].lower(), item["url"].split("?")[0])
                    key = "|".join(fingerprint)
                    if key in seen:
                        continue
                    seen.add(key)
                    item["matchedBet"] = str(bet.get("matchName") or "")
                    item["terms"] = ", ".join(terms[:8])
                    if not is_relevant_news_item(item, terms):
                        fallback_items.append(item)
                        continue
                    items.append(item)
                    if len(items) >= MAX_NEWS_ITEMS * 2:
                        return items
    return items or fallback_items[:MAX_NEWS_ITEMS]


def extract_terms_from_bet(bet: dict[str, Any]) -> list[str]:
    parts = [
        str(bet.get(key) or "")
        for key in ("matchName", "pickName", "marketType", "correlationGroup", "betType")
    ]
    for leg in bet.get("parlayLegs") or []:
        if not isinstance(leg, dict):
            continue
        parts.extend(str(leg.get(key) or "") for key in ("matchName", "pickName", "marketType"))
    text = " ".join(parts)
    return extract_terms_from_text(text)


def extract_terms_from_text(text: str) -> list[str]:
    cleaned = re.sub(
        r"\b(vs|v|versus|win|draw|loss|winner|handicap|over|under)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\b(parlay|single)\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\d+\s*串\s*\d+", " ", cleaned)
    cleaned = re.sub(r"(混合过关|过关|串关|单关)", " ", cleaned)
    cleaned = re.sub(r"[胜负平让球主客不败单关串关玩法投注选择]+", " ", cleaned)
    parts = re.split(r"\s+|/|,|，|、|\||-|—|:|：|vs\.?|VS|对|与", cleaned)
    terms: list[str] = []
    for part in parts:
        term = part.strip("()（）[]【】「」'\" ")
        if len(term) < 2:
            continue
        if term.lower() in {"team", "match", "market", "home", "away"}:
            continue
        if term not in terms:
            terms.append(term)
    return terms[:12]


def build_portfolio_queries(bet: dict[str, Any], terms: list[str]) -> list[str]:
    primary_terms = terms[:4]
    target = " ".join(primary_terms)
    match_name = str(bet.get("matchName") or "").strip()
    queries = [
        f"{target} injury suspension lineup team news",
        f"{target} politics government federation visa travel football",
        f"{target} finance sponsor federation salary bonus football",
        f"{target} scandal gossip locker room discipline football",
        f"{match_name or target} 伤病 停赛 阵容",
        f"{match_name or target} 政治 足协 签证 旅行",
        f"{match_name or target} 财政 赞助 奖金 工资",
        f"{match_name or target} 花边 更衣室 纪律 舆论",
    ]
    for term in primary_terms:
        queries.extend(
            [
                f"{term} football team news injury",
                f"{term} football politics finance scandal",
                f"{term} 足球 伤病 阵容",
                f"{term} 足球 政治 金融 花边",
            ]
        )
    return queries


def is_relevant_news_item(item: dict[str, str], terms: list[str]) -> bool:
    if not terms:
        return True
    haystack = " ".join([item.get("title", ""), item.get("snippet", ""), item.get("source", "")]).lower()
    normalized_terms = [term.lower() for term in terms if len(term) >= 2]
    return any(term in haystack for term in normalized_terms)


def build_news_feed_urls(query: str) -> list[tuple[str, str]]:
    encoded = quote(query)
    return [
        ("Bing News", f"https://www.bing.com/news/search?q={encoded}&format=rss&mkt=zh-CN"),
        (
            "Google News",
            f"https://news.google.com/rss/search?q={encoded}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
        ),
    ]


def fetch_rss_items(feed_name: str, url: str, query: str) -> list[dict[str, str]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "BetDogEye/1.0 (+https://github.com/Xiaoqian-Zhang-Shawno/BetDogEye)",
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=NEWS_TIMEOUT_SECONDS) as response:
            raw = response.read()
    except Exception:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []

    results: list[dict[str, str]] = []
    for item in root.findall(".//item"):
        title = clean_text(item.findtext("title"))
        link = clean_text(item.findtext("link"))
        description = clean_text(item.findtext("description"))
        published_at = clean_text(item.findtext("pubDate"))
        source = clean_text(item.findtext("source")) or feed_name
        if not title or not link:
            continue
        results.append(
            {
                "title": title[:220],
                "url": link,
                "snippet": description[:420],
                "publishedAt": published_at,
                "source": source,
                "query": query,
            }
        )
    return results


def clean_text(value: str | None) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


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
        if parsed.path in {"/api/llm/status", "/api/deepseek/status"}:
            config = get_config()
            self.send_json(
                {
                    "configured": bool(config["api_key"]),
                    "provider": config["provider"],
                    "baseUrl": config["base_url"],
                    "model": config["model"],
                }
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path in {"/api/config/llm", "/api/config/deepseek"}:
                data = parse_json_body(self)
                api_key = str(data.get("apiKey") or "").strip()
                base_url = normalize_base_url(str(data.get("baseUrl") or DEFAULT_BASE_URL))
                model = str(data.get("model") or DEFAULT_MODEL).strip()
                provider = str(data.get("provider") or DEFAULT_PROVIDER).strip()
                if len(api_key) < 8:
                    self.send_json({"error": "API key is too short"}, HTTPStatus.BAD_REQUEST)
                    return
                save_config(api_key, base_url, model, provider)
                self.send_json({"configured": True, "provider": provider, "baseUrl": base_url, "model": model})
                return

            if parsed.path in {"/api/llm/risk", "/api/deepseek/risk"}:
                data = parse_json_body(self)
                if not str(data.get("text") or "").strip():
                    self.send_json({"error": "text is required"}, HTTPStatus.BAD_REQUEST)
                    return
                self.send_json(call_model_risk(data))
                return

            if parsed.path == "/api/intel/refresh":
                data = parse_json_body(self)
                news_items = refresh_news_items(data)
                if not news_items:
                    self.send_json(
                        {
                            "error": "No recent news results found",
                            "hint": "Try adding team names in Chinese and English, or paste manual intel text.",
                        },
                        HTTPStatus.NOT_FOUND,
                    )
                    return
                self.send_json(call_model_intel_refresh(data, news_items))
                return

            if parsed.path == "/api/intel/portfolio-refresh":
                data = parse_json_body(self)
                news_items = refresh_portfolio_news_items(data)
                if not news_items:
                    self.send_json(
                        {
                            "error": "No relevant recent news found for open bets",
                            "hint": "Check team/country names in open betting records or add Chinese and English aliases.",
                        },
                        HTTPStatus.NOT_FOUND,
                    )
                    return
                self.send_json(call_model_portfolio_refresh(data, news_items))
                return

            self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        except PermissionError as error:
            self.send_json({"error": str(error)}, HTTPStatus.UNAUTHORIZED)
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")[:500]
            self.send_json(
                {"error": "Model API request failed", "status": error.code, "detail": body},
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
    parser = argparse.ArgumentParser(description="Run BetDogEye with a local OpenAI-compatible model proxy.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    os.chdir(ROOT)
    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"BetDogEye running at http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
