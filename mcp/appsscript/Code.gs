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
 * ToolsForMCPServer의 도구 함수를 이름으로 찾아 호출한다.
 */
function executeTool(toolName, params) {
  const m = ToolsForMCPServer;
  const tools = m.getTools();

  // 도구 정의에서 해당 이름 찾기
  const toolDef = tools.find((t) => t.name === toolName);
  if (!toolDef) {
    return `Tool '${toolName}' not found. Available: ${tools.map((t) => t.name).join(", ")}`;
  }

  // 도구 함수 실행 (ToolsForMCPServer의 함수는 m.<name> 형태)
  const fn = m[toolName];
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

  return fn(args);
}

/**
 * 사용 가능한 도구 목록을 확인하는 헬퍼 (테스트용).
 */
function showAllTools() {
  const res = ToolsForMCPServer.getToolList();
  console.log(res);
  return res;
}
