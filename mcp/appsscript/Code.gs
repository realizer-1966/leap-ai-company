/**
 * 인사이틱스(Insytics) — Google Apps Script MCP 서버 + LeapChat GET 브리지
 *
 * 이 코드를 Apps Script 프로젝트에 붙여넣고 Web App으로 배포하면,
 * LeapChat의 HTTP 도구로 연결할 수 있는 MCP 서버가 됩니다.
 *
 * [필수 라이브러리 설치]
 * 1. MCPApp            : 프로젝트 키 1TlX_L9COAriBlAYvrMLiRFQ5WVf1n0jChB6zHamq2TNwuSbVlI5sBUzh
 * 2. ToolsForMCPServer : 프로젝트 키 1lnE7UL1jQgPDbTB9yjhiwZM0SaS9MObhzvWUWb_t8FisO6A3bLepvM2j
 *
 * [배포 방법]
 * 1. script.google.com 에서 새 프로젝트 생성
 * 2. 위 라이브러리 2개 설치 (식별자: MCPApp, ToolsForMCPServer)
 * 3. 이 코드를 붙여넣기
 * 4. 배포 → 새 배포 → 웹 앱
 *    - 실행 주체: "나" (Me)
 *    - 액세스 권한: "모든 사용자" (Anyone)
 * 5. 배포 후 Web App URL (https://script.google.com/macros/s/###/exec) 복사
 */

// Gemini API 키 (선택 — generate_* 도구 사용 시 필요)
const apiKey = ""; // 예: "AIza..."

// MCP 서버 접근 키 (보안)
const ACCESS_KEY = "insytics";

/**
 * MCP 클라이언트(Gemini CLI 등)가 POST로 접근할 때 실행되는 엔트리포인트.
 */
const doPost = (e) => main(e);

/**
 * LeapChat HTTP 도구가 GET으로 접근할 때 실행되는 브리지.
 * URL: <WebAppURL>?accessKey=insytics&tool=<도구이름>&arg1=값&arg2=값
 *
 * 예: <WebAppURL>?accessKey=insytics&tool=get_current_date_time
 *     <WebAppURL>?accessKey=insytics&tool=get_exchange_rate&from=USD&to=KRW
 */
function doGet(e) {
  const params = e.parameter || {};
  // 접근 키 검증
  if (params.accessKey !== ACCESS_KEY) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Invalid access key" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const toolName = params.tool;
  if (!toolName) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Missing 'tool' parameter" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 직접 구현한 도구가 있으면 먼저 실행 (라이브러리 items에 없으므로)
    const customResult = runCustomTool(toolName, params);
    if (customResult !== null) {
      return ContentService.createTextOutput(
        JSON.stringify({ tool: toolName, result: customResult })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 도구 실행 (ToolsForMCPServer의 도구 목록에서 찾아 실행)
    const result = executeTool(toolName, params);
    return ContentService.createTextOutput(
      JSON.stringify({ tool: toolName, result: result })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ tool: toolName, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * MCP 서버 메인 로직 (MCPApp 라이브러리 사용).
 */
function main(eventObject) {
  const m = ToolsForMCPServer;
  m.apiKey = apiKey;

  const object = { eventObject, items: m.getTools() };
  return new MCPApp.mcpApp({ accessKey: ACCESS_KEY })
    .setServices({ lock: LockService.getScriptLock() })
    .server(object);
}

/**
 * GET 브리지에서 도구를 직접 실행하는 헬퍼.
 * ToolsForMCPServer의 getTools()가 반환하는 MCP items 구조에서 도구를 찾아 실행한다.
 * 각 item: { type: "tools/list", function: <실제함수>, value: { name, description, inputSchema, ... } }
 *
 * v3 개선:
 * - 도구의 inputSchema.properties 키 순서대로 파라미터를 개별 인자로 전달한다.
 *   (일부 도구는 fn(location)처럼 개별 인자를 기대하므로 객체 하나로 넘기면 실패)
 * - inputSchema가 없으면 기존처럼 객체 하나로 전달 (호환성 유지)
 */
function executeTool(toolName, params) {
  const m = ToolsForMCPServer;
  const items = m.getTools();

  // 도구 정의에서 해당 이름 찾기 (value.name)
  const toolItem = items.find((t) => t.value && t.value.name === toolName);
  if (!toolItem) {
    const available = items
      .filter((t) => t.value && t.value.name)
      .map((t) => t.value.name)
      .join(", ");
    return `Tool '${toolName}' not found. Available: ${available}`;
  }

  // 실제 함수 실행 (item.function)
  const fn = toolItem.function;
  if (typeof fn !== "function") {
    return `Tool '${toolName}' has no executable function.`;
  }

  // 파라미터 구성 (tool, accessKey 제외한 나머지)
  const args = {};
  for (const key in params) {
    if (key !== "tool" && key !== "accessKey") {
      args[key] = params[key];
    }
  }

  // inputSchema가 있으면 파라미터 순서대로 개별 인자로 전달
  const schema = toolItem.value && toolItem.value.inputSchema;
  if (schema && schema.properties) {
    const orderedArgs = [];
    for (const key in schema.properties) {
      if (args[key] !== undefined) {
        orderedArgs.push(args[key]);
      }
    }
    // 개별 인자로 호출 (fn(location) 형태)
    return fn.apply(null, orderedArgs);
  }

  // inputSchema가 없으면 객체 하나로 전달 (호환성)
  return fn(args);
}

/**
 * 직접 구현한 도구를 실행하는 헬퍼.
 * 라이브러리 items에 없는 도구 중, 아래에서 직접 구현한 도구를 찾아 실행한다.
 * 해당 도구가 아니면 null을 반환한다.
 */
function runCustomTool(toolName, params) {
  const args = {};
  for (const key in params) {
    if (key !== "tool" && key !== "accessKey") {
      args[key] = params[key];
    }
  }

  switch (toolName) {
    case "get_exchange_rate":
      return get_exchange_rate(args);
    case "get_specific_date_weather":
      return get_specific_date_weather(args);
    default:
      return null;
  }
}

/**
 * 사용 가능한 도구 목록을 확인하는 헬퍼 (테스트용).
 */
function showAllTools() {
  const res = ToolsForMCPServer.getToolList();
  console.log(res);
  return res;
}

/* ============================================================
 * 직접 구현 도구 (라이브러리 대체)
 * ============================================================
 * 아래 도구들은 ToolsForMCPServer 라이브러리 구현이 GET 브리지에서
 * 제대로 동작하지 않아(파라미터 무시, 개별 인자 문제 등) 직접 구현한다.
 */

/**
 * 환율 조회 — from/to 파라미터 정상 동작.
 * URL: <WebAppURL>?accessKey=insytics&tool=get_exchange_rate&from=USD&to=KRW
 * 무료 API: https://open.er-api.com/v6/latest/{base}
 */
function get_exchange_rate(args) {
  const from = (args && args.from) || "USD";
  const to = (args && args.to) || "KRW";

  try {
    const url = "https://open.er-api.com/v6/latest/" + encodeURIComponent(from);
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(resp.getContentText());

    if (data.result !== "success") {
      return "환율 조회 실패: " + (data["error-type"] || "unknown error");
    }

    const rate = data.rates[to];
    if (rate === undefined) {
      return "통화 '" + to + "' 를 찾을 수 없습니다. 사용 가능: " + Object.keys(data.rates).slice(0, 20).join(", ") + " ...";
    }

    return "1 " + from + " = " + rate + " " + to + " (기준일: " + data.time_last_update_utc + ")";
  } catch (err) {
    return "환율 조회 오류: " + String(err);
  }
}

/**
 * 특정 날짜 날씨 조회 — open-meteo API 사용.
 * URL: <WebAppURL>?accessKey=insytics&tool=get_specific_date_weather&location=Seoul&date=2026-08-16
 * (location은 도시명 또는 위도,경도)
 */
function get_specific_date_weather(args) {
  const location = (args && args.location) || "Seoul";
  const date = (args && args.date) || "";

  try {
    // 위도/경도 해석
    let lat, lon;
    if (location.indexOf(",") > -1) {
      const parts = location.split(",");
      lat = parseFloat(parts[0].trim());
      lon = parseFloat(parts[1].trim());
    } else {
      // 도시명 → 위도/경도 (geocoding API)
      const geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(location) + "&count=1&language=ko&format=json";
      const geoResp = UrlFetchApp.fetch(geoUrl, { muteHttpExceptions: true });
      const geoData = JSON.parse(geoResp.getContentText());
      if (!geoData.results || geoData.results.length === 0) {
        return "위치 '" + location + "' 를 찾을 수 없습니다.";
      }
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
    }

    // 날짜 검증 (YYYY-MM-DD)
    let targetDate = date;
    if (!targetDate) {
      const now = new Date();
      targetDate = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd");
    }

    // open-meteo 과거/미래 날씨 API
    const weatherUrl = "https://archive-api.open-meteo.com/v1/archive?latitude=" + lat +
      "&longitude=" + lon +
      "&start_date=" + targetDate + "&end_date=" + targetDate +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code" +
      "&timezone=Asia/Seoul";
    const resp = UrlFetchApp.fetch(weatherUrl, { muteHttpExceptions: true });
    const data = JSON.parse(resp.getContentText());

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      return "해당 날짜(" + targetDate + ")의 날씨 데이터가 없습니다.";
    }

    const maxT = data.daily.temperature_2m_max[0];
    const minT = data.daily.temperature_2m_min[0];
    const precip = data.daily.precipitation_sum[0];
    const code = data.daily.weather_code[0];

    const desc = weatherCodeToText(code);
    return "날짜: " + targetDate + " (" + location + ")\n" +
      "날씨: " + desc + "\n" +
      "최고: " + maxT + "°C, 최저: " + minT + "°C\n" +
      "강수량: " + precip + "mm";
  } catch (err) {
    return "날씨 조회 오류: " + String(err);
  }
}

/**
 * WMO weather code → 한글 설명 변환.
 */
function weatherCodeToText(code) {
  const map = {
    0: "맑음", 1: "대체로 맑음", 2: "약간 흐림", 3: "흐림",
    45: "안개", 48: "서리 안개",
    51: "이슬비(약)", 53: "이슬비(보통)", 55: "이슬비(강)",
    56: "얼음 이슬비(약)", 57: "얼음 이슬비(강)",
    61: "비(약)", 63: "비(보통)", 65: "비(강)",
    66: "얼음비(약)", 67: "얼음비(강)",
    71: "눈(약)", 73: "눈(보통)", 75: "눈(강)",
    77: "눈 알갱이",
    80: "소나기(약)", 81: "소나기(보통)", 82: "소나기(강)",
    85: "눈보라(약)", 86: "눈보라(강)",
    95: "뇌우", 96: "뇌우(우박)", 99: "뇌우(강한 우박)"
  };
  return map[code] || ("코드 " + code);
}
