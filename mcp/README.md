# 인사이틱스 MCP — Google Apps Script + LeapChat 연결 가이드

## 개요

LEAP SDK에는 MCP 네이티브 지원이 없어서, **Apps Script MCP 서버를 GET 브리지로 감싸서** LeapChat의 HTTP 도구로 연결합니다.

- **MCP 서버**: Google Apps Script Web App (MCPApp + ToolsForMCPServer 라이브러리)
- **연결 방식**: Apps Script에 `doGet` 브리지 추가 → LeapChat HTTP 도구가 GET으로 호출

## 제공 도구 (ToolsForMCPServer, 160+개)

Gmail, Google Drive, Sheets, Docs, Slides, Calendar, Classroom, People, Analytics, Maps 등 Google Workspace 전반을 다루는 도구가 포함됩니다.

대표 도구:
- `get_current_date_time` — 현재 날짜/시간
- `get_exchange_rate` — 환율
- `get_current_weather` — 날씨
- `get_values_from_google_sheets` — 스프레드시트 읽기
- `create_file_to_google_drive` — Drive 파일 생성
- `get_massages_by_search_from_Gmail` — Gmail 검색
- `create_schedule_on_Google_Calendar` — 캘린더 일정

## 1. Apps Script MCP 서버 만들기

### 1) 프로젝트 생성
[script.google.com](https://script.google.com/home/projects/create) 에서 새 독립형 프로젝트 생성.

### 2) 라이브러리 설치
스크립트 편집기 → 좌측 "라이브러리" → "+" → 아래 키 입력:

| 라이브러리 | 프로젝트 키 | 식별자 |
|---|---|---|
| MCPApp | `1TlX_L9COAriBlAYvrMLiRFQ5WVf1n0jChB6zHamq2TNwuSbVlI5sBUzh` | `MCPApp` |
| ToolsForMCPServer | `1lnE7UL1jQgPDbTB9yjhiwZM0SaS9MObhzvWUWb_t8FisO6A3bLepvM2j` | `ToolsForMCPServer` |

### 3) 코드 붙여넣기
`/root/workspace/leap-ai-company/mcp/appsscript/Code.gs` 의 내용을 스크립트 편집기에 붙여넣기.

### 4) Web App 배포
1. **배포 → 새 배포 → 웹 앱**
2. 실행 주체: **"나" (Me)** ← 중요
3. 액세스 권한: **"모든 사용자" (Anyone)**
4. 배포 → Web App URL 복사 (`https://script.google.com/macros/s/###/exec`)

> ⚠️ 코드 수정 후에는 **새 버전으로 재배포**해야 반영됩니다.

## 2. LeapChat에 연결하기

LeapChat의 **연결하기 → HTTP API 도구 → + 추가** 에서 설정.

### 도구별 설정 예시

**① 현재 시간**
- 이름: `gas_time`
- 설명: `Get current date/time via Apps Script MCP`
- URL 템플릿: `<WebAppURL>?accessKey=insytics&tool=get_current_date_time`

**② 환율**
- 이름: `gas_exchange`
- 설명: `Get exchange rate via Apps Script MCP`
- URL 템플릿: `<WebAppURL>?accessKey=insytics&tool=get_exchange_rate&from={from}&to={to}`
- 파라미터: `from:string:통화1;to:string:통화2`

**③ 스프레드시트 읽기**
- 이름: `gas_sheet`
- 설명: `Read Google Sheets via Apps Script MCP`
- URL 템플릿: `<WebAppURL>?accessKey=insytics&tool=get_values_from_google_sheets&spreadsheetId={id}&range={range}`
- 파라미터: `id:string:스프레드시트ID;range:string:범위`

> **핵심**: URL 템플릿에 `?accessKey=insytics&tool=<도구이름>` 을 넣고, 파라미터는 `&{param}=...` 형태로 추가.

## 3. 동작 원리

```
LeapChat (GET) 
  → <WebAppURL>?accessKey=insytics&tool=get_exchange_rate&from=USD&to=KRW
  → Apps Script doGet 브리지
  → ToolsForMCPServer 도구 실행
  → JSON 응답 { tool, result }
  → LeapChat이 결과를 모델에 전달
```

## 4. 파일 위치

- Apps Script 코드: `/root/workspace/leap-ai-company/mcp/appsscript/Code.gs`
- 이 문서: `/root/workspace/leap-ai-company/mcp/README.md`

## 5. 참고

- MCPApp 라이브러리: https://github.com/tanaikech/MCPApp
- ToolsForMCPServer: https://github.com/tanaikech/ToolsForMCPServer
- MCP 서버는 doPost(MCP 클라이언트용) + doGet(LeapChat용) 둘 다 지원
- 보안: `accessKey` 쿼리 파라미터로 접근 제어 (기본값 `insytics`)
