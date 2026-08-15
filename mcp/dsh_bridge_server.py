import os
import threading
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from deepseek_harness import DeepSeekHarness

# API 키는 환경변수에서 읽음 (Termux에서 export)
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
