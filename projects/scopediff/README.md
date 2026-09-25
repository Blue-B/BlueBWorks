# ScopeDiff

MCP 도구 업데이트 전후의 **선언과 입력 규격 변화**를 검토하는 로컬 웹 도구. 연결된 서버를 실행하지 않고 이미 확보한 두 목록을 비교한다.

예: `read_note`의 읽기 전용 선언이 사라지고 `format` 필수 입력이 생겼다면, 두 변화를 따로 표시한다. 새 도구·빠진 도구, 외부 상호작용 힌트 변경, 설명 변경도 함께 볼 수 있다.

> AI 에이전트가 조사·구현·검증하는 BlueBWorks 실험의 프로토타입이다. 사람의 검토 완료나 보안 인증을 뜻하지 않는다. 실제 사용자 수요와 수익성은 검증 전이다.

## 바로 사용

이 폴더의 `index.html`을 브라우저로 연다. 브라우저의 로컬 파일 정책 때문에 실행이 제한되면 아래 단일 HTML 빌드를 사용하거나 `python3 -m http.server 8080 --bind 127.0.0.1`을 이 폴더에서 실행하고 `http://127.0.0.1:8080`을 연다. 외부 인터페이스에 서버를 노출하지 않는다.

1. **예제로 체험하기**: 가상 목록으로 읽기 전용·필수 입력·외부 상호작용·추가·삭제 사례를 확인한다.
2. 실제 사용: 변경 전후의 전체 `tools/list` 응답을 붙여넣거나 JSON 파일로 넣는다. 파일 끌어놓기도 지원한다.
3. 도구를 선택해 힌트의 명시값/미선언 기본값과 원문을 비교한다. 검색과 상태 필터를 사용할 수 있다.
4. 검토 메모 Markdown 또는 원문을 포함한 JSON 보고서를 내려받는다. **보고서에는 민감한 도구 설명이 들어갈 수 있으니 공유 전에 확인한다.**

입력은 브라우저 메모리에만 두며 저장소·분석 서비스로 전송하지 않는다. 쿠키·localStorage·분석 SDK·외부 글꼴·LLM 호출·API 키가 없다. 콘텐츠 보안 정책에서 네트워크 연결을 차단한다. 이는 입력 데이터 처리 설계이며, 외부 브라우저 확장이나 운영체제까지 통제한다는 뜻은 아니다.

## 단일 파일 빌드 / CLI

Node.js 22 이상. npm 설치나 런타임 패키지는 필요 없다.

```sh
node --test test.cjs
node build.cjs
# 생성된 dist/ScopeDiff.html을 더블클릭해서 실행
node cli.cjs before.json after.json --format markdown
node cli.cjs before.json after.json --fail-on-change
```

CLI 종료 코드: `0` 정상, `1` 변경 발견(`--fail-on-change`를 지정했을 때만), `2` 입력/파일/옵션 오류. 기본 JSON 출력에는 두 시점의 원문도 포함한다. `--fail-on-change`는 보안 위험이 아니라 **어떤 선언 변화든** 있다는 뜻이다.

## 입력 형식

지원: `{ "tools": [...] }`, JSON-RPC `result.tools` 응답, 도구 배열. 여러 서버는 `{ "servers": [{ "name": "workspace", "tools": [...] }] }`로 묶는다. 서버+도구 이름으로 식별하므로 서로 다른 서버의 동명 도구를 합치지 않는다.

```json
{
  "tools": [{
    "name": "read_note",
    "description": "Read a note",
    "inputSchema": {
      "type": "object",
      "properties": {"id": {"type": "string"}},
      "required": ["id"]
    },
    "annotations": {"readOnlyHint": true, "openWorldHint": false}
  }]
}
```

각 도구의 `name`, 객체형 `inputSchema`는 필수다. `nextCursor`가 있으면 부분 목록으로 인한 가짜 삭제 판정을 막기 위해 거부한다. 모든 페이지를 합친 목록을 준비해야 한다. `mcpServers` 연결 설정은 목록이 아니며 받지 않는다. 제한: 입력당 2 MiB, 500개 도구, 깊이 48단계, JSON 노드 100,000개.

## 무엇을 보장하지 않는가

- 힌트는 서버의 자기 선언이다. 안전성을 검증하거나 실제 권한을 강제하지 않는다. 신뢰할 수 없는 서버는 거짓말할 수 있다.
- 미선언 기본값은 `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=false`, `openWorldHint=true`. 읽기 전용이면 destructive/idempotent 힌트는 적용하지 않는 것으로 표시한다.
- 설정 변화가 실제로 권한을 확장했다는 결론은 내리지 않는다. 검토가 필요한 **선언 변화**만 표시한다.
- 도구 설명의 프롬프트 주입·악성 코드를 탐지하지 않는다. 도구 코드가 바뀌고 메타데이터가 같으면 찾을 수 없다.
- 스키마 변경을 표시하지만 JSON Schema의 모든 조건·참조·조합에 대한 완전한 호환성 분석은 아니다. 키 순서와 required/enum/type 배열 순서는 비교에서 정규화한다.
- 이름 변경은 삭제+추가로 표시한다. 서버 이름을 두 시점에 일관되게 지정해야 한다.
- 브라우저 화면은 긴 원문을 25,000자로 줄여 표시하며 JSON 보고서에는 원문 전체를 넣는다.

## 기존 대안과 역할

**MCP Inspector**는 서버 접속·도구 조회·실행 시험용이다. ScopeDiff는 이미 확보한 두 시점의 목록을 대조하는 변경 검토 작업에 집중한다. Inspector와 경쟁하는 전체 디버거가 아니다.

**Snyk Agent Scan**은 에이전트 구성·MCP·스킬을 발견하고 보안 위험을 분석한다. 서버 접속/실행과 원격 분석을 포함할 수 있다. ScopeDiff는 연결·원격 분석·위험 점수 없이 선언 변화만 로컬에서 설명한다. Agent Scan의 보안 검사를 대체하지 않는다.

## 조사 출처

모두 2026-09-26 확인. 아래는 구현 근거이지 수요나 독창성의 증명이 아니다.

- MCP, [Tool Annotations as Risk Vocabulary](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/), 2026-03-16 발표: 힌트 기본값, 신뢰 한계와 강제력 부재.
- MCP, [2026-07-28 Tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools): 도구 목록, 페이지 처리, 목록 변경 및 사용자 확인 인터페이스.
- MCP, [Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector): 비교 대상의 접속·시험 역할.
- Snyk, [Agent Scan](https://github.com/snyk/agent-scan): 비교 대상의 발견·보안 분석과 실행/전송 주의사항.

별도 공개 배포, 외부 서비스 연결, 계정, 결제는 만들지 않았다. 라이선스와 공개 여부는 저장소 소유자의 별도 결정 대상이다.
