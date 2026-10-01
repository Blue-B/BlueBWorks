# 2026-10-01 — 실제 데모와 README 누락 보완

## 결과와 범위

- AgentScope, AgentTraceLite, HARLens, InstallLens, PyLockPeek, TransitionGuard: 실제 CLI subprocess 출력을 실행해서 GIF와 PNG, 전체 출력 transcript, source/input/artifact SHA-256 근거를 저장했다. GIF는 읽기 쉽게 재생 시간을 조정한 실제 출력 리플레이이며 화면 녹화나 실행 시간 측정이 아니다. 모든 데이터는 저장소의 명시된 예제다.
- ScopeDiff: 기존 실제 브라우저 GIF를 바이트 변경 없이 유지했다. GIF와 기존 캡처 근거의 소스 blob 4개 일치를 확인했다. 이번 실행에서 브라우저 E2E를 다시 통과한 것은 아니다.
- 두 프로젝트 목록에 누락된 AgentTraceLite를 추가했다. 여덟 프로젝트 README를 검토·수정하고 여섯 CLI README에 데모 재생, 실행 방법, 테스트와 한계를 적었다. AgentTraceLite의 짧은 README를 실제 구현 기준으로 완성했다.
- HARLens와 SilenceSketch의 불완전한 project.json을 고쳤다. TransitionGuard JSX 예제에 들어 있던 리터럴 `\n`을 실제 줄바꿈으로 수정했다. 제품 기능은 변경하지 않았다.
- 누락된 목록/README 이미지, 손상된 GIF, 단일 프레임을 잡는 offline showcase 검사와 9개 회귀 테스트를 추가했다. 기존 검증기 테스트26개는 유지했다.

## 미완료: SilenceSketch 브라우저 캡처

SilenceSketch 실제 GIF와 브라우저 E2E는 **미완료**다. 설치된 Chromium은 `process_singleton_posix.cc`에서 socket `Operation not permitted`로 시작하지 못했다. 승인된 escalated 실행도 동일했다. 관리형 cloud browser는 로컬 앱 URL을 `net::ERR_BLOCKED_BY_CLIENT`로 거부했다. 정책을 우회하거나 private 소스를 외부 사이트에 올리지 않았다.

기존 SVG 도식을 실제 앱 캡처처럼 보여주던 README embed를 제거했다. `browser_test.py --capture`를 준비했지만 Python 문법/help 검사만 완료했고 시나리오 실행 성공을 주장하지 않는다. 동작하는 로컬 Chromium 환경에서 실제 UI 검증·캡처를 해야 한다. `automation/pending-demos.json`에 이 한 항목을 명시했다. 기본 showcase 검사는 이 미완료를 실패로 보고하며, `--allow-pending`은 일곱 완료된 데모만 검증한다. 예외는 전체 완료를 뜻하지 않는다.

## 실행 환경·검증

GitHub Actions 외부의 Linux cloud runtime, Python3.12.14, Node24.19.0, Pillow12.3.0에서 실행했다. Actions, 유료 API, 외부 배포, 계정/권한 변경은 하지 않았다.

통과:

- `python3 -m unittest discover -s tests -v`: 35개 (기존26 + showcase9)
- `python3 automation/check.py`: 8개 등록 정보
- `python3 automation/check.py --run`: 8개 프로젝트의 모든 선언된 검사; ScopeDiff63개 테스트와 build, SilenceSketch core5개 포함
- `python3 automation/capture_cli_demos.py --verify-only`: 6개 source/input/artifact hash와 재실행 stdout/stderr/exit code 일치
- `python3 automation/check_showcase.py --allow-pending`: 7개 GIF의 프레임·README/index 연결 검사 통과, SilenceSketch는 PENDING 출력
- SilenceSketch/ScopeDiff 캡처 helper Python 문법 검사, SilenceSketch JavaScript 문법 검사
- GIF/PNG 화면 육안 검토, GIF 여러 프레임 확인

미통과/미실행:

- 기본 `python3 automation/check_showcase.py`: SilenceSketch GIF 미완료 때문에 의도적으로 실패
- 이번 런타임의 실제 브라우저 E2E/새 UI 캡처: 위 실행 환경 차단으로 미완료
- Safari, Firefox, 모바일 실기기 검증: 수행하지 않음

## GIF 파일

| 프로젝트 | 크기 | 프레임 | 바이트 |
|---|---|---:|---:|
| agentscope | 1120×430 | 6 | 118,464 |
| agenttracelite | 1120×430 | 8 | 163,541 |
| harlens | 1120×782 | 15 | 362,863 |
| installlens | 1120×834 | 16 | 442,071 |
| pylockpeek | 1120×430 | 5 | 87,802 |
| scopediff | 2012×1840 | 12 | 730,070 |
| transition-guard | 1120×430 | 6 | 115,049 |

여섯 CLI의 재현 명령은 `python3 automation/capture_cli_demos.py`다. 각 프로젝트의 `demo-capture.json`과 `demo-transcript.txt`에 실행 명령, exit code, 전체 출력과 파일 hash가 있다. ScopeDiff는 기존 `preview-checks.json`을 보존했다. GIF 리플레이는 실제 속도를 보장하지 않는다.

## 반영 방식

기준 원격 main은 `868e777cc381963b27a35c32256925512a2bfe0c`다. 변경 파일만 Git 객체로 전송하고 최신 main을 다시 확인한 뒤 force 없이 fast-forward한다. 관련 없는 원격 파일·기존 binary preview를 보존한다. 이 보고서와 변경 파일이 있는 커밋 및 원격 main 재조회가 실제 반영의 근거이며, 로컬 파일이나 blob 생성만으로 main 완료라고 보고하지 않는다.
