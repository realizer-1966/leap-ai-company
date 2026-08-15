#!/bin/bash
# 인사이틱스 dsh 브리지 서버 — Termux 설치/실행 스크립트
# Termux에서 이 파일을 실행하면 dsh 서버가 0.0.0.0:9001에서 실행됩니다.

set -e

echo "=== 1. Termux 패키지 업데이트 + Python 설치 ==="
pkg update -y
pkg install -y python

echo "=== 2. venv 생성 + dsh SDK 설치 ==="
cd ~
python -m venv dsh-venv
source dsh-venv/bin/activate
pip install "deepseek-harness-sdk==0.1.0rc6" fastapi uvicorn

echo "=== 3. API 키 설정 ==="
# 여기에 OLLAMA_API_KEY 값을 넣으세요 (Hermes ~/.hermes/.env에서 확인)
export OLLAMA_API_KEY="YOUR_OLLAMA_API_KEY_HERE"

echo "=== 4. dsh 브리지 서버 코드 저장 ==="
cat > ~/dsh_bridge_server.py << 'PYEOF'
import os
import threading
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from deepseek_harness import DeepSeekHarness

API_KEY = os.environ.get("OLLAMA_API_KEY", "")
BASE_URL = "https://ollama.com/v1"
MODEL = "deepseek-v4-flash:0731"

app = FastAPI(title="Insytics dsh Bridge")
_harness = None
_harness_lock = threading.Lock()

def get_harness() -> DeepSeekHarness:
    global _harness
    with _harness_lock:
        if _harness is None:
            _harness = DeepSeekHarness(
                provider="deepseek-official",
                model=MODEL,
                max_tokens=1024,
                base_url=BASE_URL,
                api_key=API_KEY,
            )
        return _harness

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}

@app.get("/ask")
def ask(q: str = Query(..., description="질문")):
    if not q.strip():
        return JSONResponse({"error": "Missing 'q' parameter"}, status_code=400)
    try:
        harness = get_harness()
        result = harness.run(q)
        if result.finish_reason == "error":
            return JSONResponse({"error": "Agent error", "detail": result.final_response}, status_code=500)
        return {"result": result.final_response, "finish_reason": result.finish_reason}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    print(f"인사이틱스 dsh 브리지 서버 시작 (port 9001, model {MODEL})")
    uvicorn.run(app, host="0.0.0.0", port=9001)
PYEOF

echo "=== 5. 서버 실행 ==="
python ~/dsh_bridge_server.py
