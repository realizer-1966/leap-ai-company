#!/bin/bash
# 인사이틱스 MCP 서버 — Termux 설치/실행 스크립트
# Termux에서 이 파일을 실행하면 MCP 서버가 0.0.0.0:9000에서 실행됩니다.

set -e

echo "=== 1. Termux 패키지 업데이트 + Python 설치 ==="
pkg update -y
pkg install -y python

echo "=== 2. venv 생성 + mcp SDK 설치 ==="
cd ~
python -m venv mcp-venv
source mcp-venv/bin/activate
pip install "mcp>=1.0,<2"

echo "=== 3. MCP 서버 코드 저장 ==="
mkdir -p ~/insytics
cat > ~/insytics/mcp_server.py << 'PYEOF'
"""
인사이틱스(Insytics) MCP 도구 서버.
LeapChat의 HTTP API 도구로 연결할 수 있는 MCP 서버.
Streamable HTTP 전송, 0.0.0.0:9000 바인딩.
"""
import random
from datetime import datetime

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("insytics-mcp", host="0.0.0.0", port=9000)


@mcp.tool()
def get_current_time() -> str:
    """현재 로컬 시간을 반환합니다."""
    return f"Current local time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"


@mcp.tool()
def get_today_date() -> str:
    """오늘 날짜를 반환합니다."""
    return f"Today's date: {datetime.now().strftime('%Y-%m-%d')}"


@mcp.tool()
def compute_sum(values: list[str]) -> str:
    """숫자 목록의 합계를 계산합니다."""
    total = sum(float(v) for v in values if _is_number(v))
    return f"Sum = {total}"


@mcp.tool()
def random_number(min: int = 0, max: int = 100) -> str:
    """지정된 범위 내의 난수를 생성합니다."""
    lo, hi = min, max
    if hi <= lo:
        hi = lo + 1
    return f"Random number: {random.randint(lo, hi)}"


@mcp.tool()
def count_words(text: str) -> str:
    """주어진 텍스트의 단어 수를 셉니다."""
    words = len(text.split()) if text.strip() else 0
    return f"Word count: {words}"


@mcp.tool()
def unit_convert(value: float, from_unit: str, to_unit: str) -> str:
    """단위를 변환합니다. 길이(m,km,cm,mm,mile), 온도(c,f), 무게(kg,g,lb) 지원."""
    to_base = {
        "m": 1.0, "km": 1000.0, "cm": 0.01, "mm": 0.001, "mile": 1609.344,
        "kg": 1.0, "g": 0.001, "lb": 0.45359237,
    }
    f, t = from_unit.lower(), to_unit.lower()
    if f in to_base and t in to_base:
        base = value * to_base[f]
        return f"{value} {f} = {base / to_base[t]} {t}"
    if f == "c" and t == "f":
        return f"{value} C = {value * 9 / 5 + 32} F"
    if f == "f" and t == "c":
        return f"{value} F = {(value - 32) * 5 / 9} C"
    return f"Error: unsupported conversion {f} -> {t}"


@mcp.tool()
def http_get(url: str) -> str:
    """지정된 URL로 GET 요청을 보내 응답을 반환합니다. (외부 API 연결용)"""
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return f"HTTP {resp.status}\n{body[:4000]}"
    except Exception as e:
        return f"HTTP Error: {e}"


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False


if __name__ == "__main__":
    print("인사이틱스 MCP 서버 시작 (streamable HTTP, port 9000)")
    mcp.run(transport="streamable-http")
PYEOF

echo "=== 4. MCP 서버 실행 (0.0.0.0:9000) ==="
python ~/insytics/mcp_server.py
