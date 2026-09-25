# ScopeDiff

MCP 업데이트 전후의 **도구 선언과 입력 규격 변화**를 검토하는 로컬 도구다. 서버에 접속하거나 도구를 실행하지 않고 이미 확보한 두 목록을 비교한다.

예를 들어 `read_note`의 읽기 전용 선언이 없어지고 `format`이 필수 입력으로 추가되면 두 변화를 따로 보여준다. 도구 추가·삭제, 설명 변경, 외부 상호작용 힌트 변경도 확인할 수 있다.

> AI 에이전트가 조사·구현·검증하는 BlueBWorks 실험의 프로토타입이다. 사람의 검토 완료나 보안 인증을 뜻하지 않는다. 사용자 수요와 수익성은 검증 전이다.

## 사용

Node.js 22 이상으로 다음 명령을 실행한다. npm 설치나 런타임 패키지는 필요 없다.

```sh
node build.cjs
```

생성된 **`dist/ScopeDiff.html`을 브라우저로 연다.** HTML 하나에 코드와 스타일이 모두 포함된다. 브라우저 정책이 로컬 파일을 제한하면 이 폴더에서 `python3 -m http.server 8080 --bind 127.0.0.1`을 실행한 뒤 `http://127.0.0.1:8080/dist/ScopeDiff.html`을 연다. 외부 인터페이스로 서버를 노출하지 않는다.

- **예제로 체험하기**: 가상 목록으로 선언·필수 입력·도구 추가·삭제 사례를 확인한다.
- 실제 목록: 두 시점의 전체 `tools/list` 응답을 붙여넣거나 JSON 파일을 선택/끌어놓기 한다.
- 도구 선택: 변경 근거, 명시값과 미선언 기본값, 원문을 비교한다. 검색과 상태 필터를 제공한다.
- 결과 저장: 검토 메모 Markdown 또는 원문을 포함한 JSON. **도구 설명 등 민감한 내용이 포함될 수 있으니 공유 전에 확인한다.**

입력은 브라우저 메모리에서만 처리한다. 쿠키·localStorage·분석 SDK·외부 글꼴·LLM 호출·API 키가 없으며 콘텐츠 보안 정책에서 네트워크 연결을 차단한다. 브라우저 확장이나 운영체제까지 통제한다는 뜻은 아니다.

## 입력과 제한

`{"tools":[...]}`, JSON-RPC `result.tools` 응답, 도구 배열을 지원한다. 여러 서버는 `{"servers":[{"name":"workspace","tools":[...]}]}`로 묶는다. 서버+도구 이름으로 식별한다.

```json
{
  "tools": [{
    "name": "read_note",
    "description": "Read a note",
    "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
    "annotations": {"readOnlyHint": true, "openWorldHint": false}
  }]
}
```

각 도구의 `name`과 객체형 `inputSchema`는 필수다. 다음 페이지를 뜻하는 `nextCursor`가 있으면 부분 목록으로 인한 잘못된 삭제 판정을 막기 위해 거부한다. 모든 페이지를 합친 목록이 필요하다. `mcpServers` 연결 설정 파일은 받지 않는다. 제한은 입력당 2 MiB, 500개 도구, 깊이 48단계, JSON 노드 100,000개다.

## 테스트와 CLI

```sh
node --test test.cjs regression.cjs
node cli.cjs before.json after.json --format markdown
node cli.cjs before.json after.json --fail-on-change
```

CLI 종료 코드: `0` 정상, `1` 변경 발견(`--fail-on-change` 지정 시), `2` 입력/파일/옵션 오류. 변경 발견은 보안 위험 판정이 아니다.

Playwright와 Chromium이 설치된 개발 환경에서는 `python3 browser_test.py`로 추가 화면 검사를 실행한다. `SCOPEDIFF_CHROMIUM` 환경변수로 Chromium 실행 경로를 지정할 수 있다. 이 검사는 추가 의존성이 필요하므로 기본 등록 검사와 분리했다.

2026-09-26 수동 시험: 코드·CLI·빌드 회귀 테스트 63개, 브라우저 시나리오 15개, 저장소 검사기 회귀 테스트 26개가 통과했다. Chromium 144에서 1440px 및 390px/320px 화면, 실제 파일 입력·끌어놓기·검색·필터·보고서 다운로드를 확인했다. 테스트 환경은 `file://` 및 로컬 HTTP 탐색이 차단되어 **빌드 결과를 CSP 수정 없이 브라우저 문서에 직접 로드(`set_content`)하고 오프라인 상태에서 검증**했다. 실제 더블클릭 경로, 모바일 실기기, Safari·Firefox는 미검증이다. 원격 CI와 무인 예약 실행의 성공을 뜻하지 않는다.

## 해석 주의

힌트는 서버의 자기 선언이며 실제 권한·동작·안전성을 강제하지 않는다. 미선언 기본값은 `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=false`, `openWorldHint=true`다. 읽기 전용이면 destructive/idempotent 힌트는 적용하지 않는 것으로 표시한다.

도구 코드가 바뀌어도 메타데이터가 같으면 감지하지 못한다. 프롬프트 주입이나 악성 도구를 탐지하지 않는다. 입력 스키마 변경을 표시하지만 모든 JSON Schema 조건·참조에 대한 완전한 호환성 분석은 아니다. 실제 스키마의 required/enum/type 집합만 정규화하고 기본값·예제·메타데이터 안의 배열 순서는 보존한다. 이름 변경은 삭제+추가로 표시한다. 화면은 긴 원문을 25,000자로 줄여 표시하며 JSON 보고서에는 전체를 포함한다.

## 조사와 기존 대안

모두 2026-09-26 확인. 구현 근거이지 독창성이나 시장 수요의 증명은 아니다.

- [MCP Tool Annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/), 2026-03-16: 기본값과 신뢰 한계.
- [MCP 2026-07-28 Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools): 도구 목록·페이지 처리·변경 알림.
- [MCP Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector): 서버에 접속해 도구를 조회·시험하는 도구. ScopeDiff는 확보한 두 목록의 변경 검토에 집중한다.
- [Snyk Agent Scan](https://github.com/snyk/agent-scan): 에이전트 구성·MCP·스킬을 발견하고 보안 위험을 분석한다. ScopeDiff는 실행·원격 분석·위험 점수 없이 선언 변화만 설명하며 보안 검사를 대체하지 않는다.

외부 배포·계정·결제는 만들지 않았다. 라이선스와 공개 여부는 저장소 소유자의 별도 결정 대상이다.
