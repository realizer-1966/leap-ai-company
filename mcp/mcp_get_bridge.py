"""
인사이틱스(Insytics) — MCP GET 브리지 (LeapChat 연결용)

Termux에서 실행 중인 MCP 서버(0.0.0.0:9000) 앞에 두는 GET 브리지.
LeapChat의 HTTP 도구(GET)가 호출하면, MCP 도구를 실행해 결과를 반환.

MCP streamable HTTP 프로토콜 처리:
1. initialize 호출 → 응답 헤더에서 mcp-session-id 획득
2. 세션 ID로 tools/list, tools/call 호출

실행:
    source ~/mcp-venv/bin/activate
    python ~/insytics/mcp_get_bridge.py

기본 포트: 9001 (0.0.0.0 바인딩)
"""
import json
import urllib.request

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

# Termux에서 실행 중인 MCP 서버 주소
MCP_URL = "http://127.0.0.1:9000/mcp"

app = FastAPI(title="Insytics MCP GET Bridge")

# 세션 ID 캐시 (재사용)
_session_id = None


def mcp_initialize() -> str:
    """MCP initialize 호출 → 세션 ID 반환."""
    global _session_id
    if _session_id:
        return _session_id

    body = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "insytics-bridge", "version": "1.0"},
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        MCP_URL,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        # 응답 헤더에서 세션 ID 추출
        sid = resp.headers.get("mcp-session-id")
        if sid:
            _session_id = sid
            return sid
        # 헤더에 없으면 본문에서 시도
        raw = resp.read().decode("utf-8")
        for line in raw.splitlines():
            if line.startswith("data: "):
                data = json.loads(line[6:])
                if "result" in data:
                    # 세션 ID가 본문에 없으면 새로 initialize 재시도 불가 → 에러
                    raise RuntimeError("No mcp-session-id in response headers")
    raise RuntimeError("Failed to initialize MCP session")


def mcp_call(method: str, params: dict) -> dict:
    """세션 ID로 MCP JSON-RPC 요청을 보내고 결과를 반환."""
    sid = mcp_initialize()

    body = json.dumps({
        "jsonrpc": "2.0",
        "id": 2,
        "method": method,
        "params": params,
    }).encode("utf-8")

    req = urllib.request.Request(
        MCP_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "mcp-session-id": sid,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    for line in raw.splitlines():
        if line.startswith("data: "):
            return json.loads(line[6:])
    return {"error": "No data in MCP response"}


@app.get("/health")
def health():
    return {"status": "ok", "mcp": MCP_URL}


@app.get("/tools")
def tools():
    """사용 가능한 MCP 도구 목록."""
    try:
        resp = mcp_call("tools/list", {})
        tools_list = resp.get("result", {}).get("tools", [])
        return {"tools": [t["name"] for t in tools_list]}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/call")
def call(
    tool: str = Query(..., description="MCP 도구 이름"),
    args: str = Query("{}", description="도구 인자 (JSON 문자열)"),
):
    """MCP 도구 호출. GET /call?tool=<이름>&args=<JSON>"""
    try:
        params = json.loads(args) if args else {}
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid args JSON"}, status_code=400)

    try:
        resp = mcp_call("tools/call", {"name": tool, "arguments": params})
        result = resp.get("result", {})
        content = result.get("content", [])
        text = " ".join(c.get("text", "") for c in content if c.get("type") == "text")
        return {"tool": tool, "result": text}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/fetch")
def fetch(
    url: str = Query(..., description="가져올 URL (그대로 입력)"),
):
    """URL을 그대로 받아 http_get 도구를 호출. 인코딩 불필요.
    GET /fetch?url=https://example.com
    """
    if not url.strip():
        return JSONResponse({"error": "Missing 'url' parameter"}, status_code=400)
    try:
        resp = mcp_call("tools/call", {"name": "http_get", "arguments": {"url": url}})
        result = resp.get("result", {})
        content = result.get("content", [])
        text = " ".join(c.get("text", "") for c in content if c.get("type") == "text")
        return {"url": url, "result": text}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    print("인사이틱스 MCP GET 브리지 시작 (port 9001)")
    uvicorn.run(app, host="0.0.0.0", port=9001)
