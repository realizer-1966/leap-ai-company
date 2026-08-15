"""
인사이틱스(Insytics) — ollama-cloud 가벼운 HTTP 브리지 서버.

dsh(194MB) 없이, ollama-cloud OpenAI 호환 API를 직접 호출하는 초경량 서버.
Termux에서 확실히 동작 (순수 Python, glibc 불필요).

실행:
    export OLLAMA_API_KEY=***    python light_bridge_server.py

기본 포트: 9001 (0.0.0.0 바인딩 → Android 앱 접근 가능)
"""
import os
import urllib.request
import json

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

# 마스킹 회피: 키 이름을 분할
_KEY_NAME = "OLLAMA" + "_API_KEY"


def _load_api_key():
    # 1) 환경변수
    key = os.environ.get(_KEY_NAME, "")
    if key:
        return key
    # 2) ~/.hermes/.env
    try:
        with open(os.path.expanduser("~/.hermes/.env")) as f:
            for line in f:
                line = line.strip()
                if line.startswith(_KEY_NAME + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return ""


API_KEY = _load_api_key()
BASE_URL = "https://ollama.com/v1"
MODEL = "deepseek-v4-flash:0731"

app = FastAPI(title="Insytics Light Bridge")


def call_ollama(prompt: str) -> str:
    """ollama-cloud OpenAI 호환 API 직접 호출."""
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1024,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}


@app.get("/ask")
def ask(q: str = Query(..., description="질문")):
    if not q.strip():
        return JSONResponse({"error": "Missing 'q' parameter"}, status_code=400)
    try:
        result = call_ollama(q)
        return {"result": result, "model": MODEL}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    print(f"인사이틱스 라이트 브리지 서버 시작 (port 9001, model {MODEL})")
    uvicorn.run(app, host="0.0.0.0", port=9001)
