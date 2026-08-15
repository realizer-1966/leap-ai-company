# 인사이틱스 — DeepSeek Harness HTTP 브리지 (LeapChat 연결)

## 개요

DeepSeek Harness(dsh) 에이전트를 **HTTP 서버로 래핑**해서, LeapChat의 HTTP 도구가 GET으로 호출할 수 있게 합니다.

- **에이전트**: DeepSeek Harness Python SDK (arm64 단일 실행파일)
- **모델**: deepseek-v4-flash:0731 (ollama-cloud, OpenAI 호환)
- **서버**: FastAPI, 포트 9001

## 실행 방법

### 1) venv + 의존성 (최초 1회)
```bash
cd /root/workspace
python3 -m venv dsh-venv
source dsh-venv/bin/activate
pip install "deepseek-harness-sdk==0.1.0rc6" fastapi uvicorn
```

### 2) 서버 실행
```bash
cd /root/workspace/leap-ai-company/mcp
source /root/workspace/dsh-venv/bin/activate
python dsh_bridge_server.py
```
- 포트: **9001**
- API 키: `~/.hermes/.env`의 `OLLAMA_API_KEY` 자동 로드

### 3) 동작 확인
```bash
# health
curl http://127.0.0.1:9001/health
# 질문
curl "http://127.0.0.1:9001/ask?q=What%20is%202%2B2%3F"
# → {"result":"4","finish_reason":"completed"}
```

## LeapChat 연결 설정

LeapChat **연결하기 → HTTP API 도구 → + 추가**:

- **이름**: `dsh_agent`
- **설명**: `Ask DeepSeek Harness agent`
- **URL 템플릿**: `http://127.0.0.1:9001/ask?q={q}`
- **파라미터**: `q:string:질문`

> ⚠️ **중요**: LeapChat은 Android 기기에서 실행되므로, dsh 브리지 서버가 **같은 기기**에서 돌고 있어야 `127.0.0.1:9001`로 접근 가능합니다.
> (proot에서 실행 중인 서버는 Android 앱과 네트워크 네임스페이스가 달라 접근이 안 될 수 있음 — 실제 기기 테스트 필요)

## 파일 위치

- 브리지 서버: `/root/workspace/leap-ai-company/mcp/dsh_bridge_server.py`
- venv: `/root/workspace/dsh-venv`
- 테스트 스크립트: `/root/workspace/dsh-test.py`

## 참고

- dsh Python SDK: `deepseek-harness-sdk` (PyPI, arm64 런타임 포함)
- 모델: ollama-cloud의 deepseek-v4-flash:0731 (Hermes와 동일)
- 이 기기(proot)에서 실제 실행 검증 완료
