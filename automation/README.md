# 예약 실행과 검증

## GitHub Actions는 사용하지 않음

사용자의 명시적 요청으로 BlueBWorks에서는 GitHub Actions를 절대 사용하지 않는다. 자동 실행·수동 실행·재실행·Actions runner 모두 제외한다. 과거 verify.yml은 실행 경로에서 제거하고 disabled-workflows/verify.yml.disabled에 원본 그대로 보관한다. .github/workflows에 실행 파일을 추가하거나 원본을 복원하지 않는다. 다른 저장소의 Actions 설정은 건드리지 않는다.

ChatGPT 예약 작업이 조사·선정·개발 도구 호출·보고를 시작한다. 한국시간 오전 8시·오후 7시 전후에 각 한 프로젝트가 목표이며 완료 시각 보장은 아니다. 별도 LLM API 키나 서버 cron은 이 구성에서 만들지 않는다. clone/fork만으로 개발 예약이 복제되지 않는다.

GitHub MCP는 파일 읽기·브랜치·코드·PR 반영과 main 병합에 사용한다. 테스트·빌드·실행·미리보기는 DevSpace, Oracle 또는 사용 가능한 임시 실행 환경에서 직접 수행한다. DevSpace 연결 오류와 GitHub push 가능 여부는 서로 다른 상태다. 실제 실행 환경이 없으면 미검증이라고 보고하며 Actions로 우회하지 않는다.

연결 앱의 권한이나 승인 요구로 예약이 멈출 수 있다. 수동 검증과 main 반영 성공을 무인 예약 성공으로 표시하지 않는다.

## 상태와 중복 방지

회차는 한국 날짜와 am|pm으로 식별한다. daily/YYYY-MM-DD-am|pm 브랜치, 보고서, main 실제 파일을 먼저 확인한다. main에 완료된 회차는 다시 만들지 않고 중단된 회차는 기존 변경을 보존해 재개한다. 미병합 프로젝트도 중복 주제 검사에 포함한다.

소유자는 검증한 결과의 비공개 main 반영을 승인했다. 작업 브랜치와 PR에서 멈추지 않고 main으로 실제 병합하거나 허용된 정상 push를 수행한다. 반영 후 원격 main의 커밋·소스·보고서를 다시 읽어 확인한다. main에 없으면 미완료다. 오래된 보고서의 main 병합 금지는 이전 운영 방식이다.

반영 직전 원격 최신 상태와 Actions 실행 파일의 부재를 확인한다. 다른 작업과 사용자의 변경을 보존하며 기존 브랜치에서 workflow가 되살아나지 않게 한다.

## 프로젝트 등록과 직접 검증

projects/<slug>/project.json에는 이름·설명·문제·대상 사용자·현재 관련성·차별점·수익화 가설·한계·소스/테스트 파일·설치/검사 명령·출처·대안을 기록한다. project.template.json은 양식이다. created_at과 checked_at은 YYYY-MM-DD이며 published_at은 확인된 경우만 적는다.

setup/checks의 command는 문자열이 아닌 인자 배열이다. 프로젝트 폴더에서 shell=False로 실행한다. checks에는 kind:test가 하나 이상 필요하고 필요한 build/smoke를 추가한다. timeout_seconds는 1~300초다. 설치와 실행 환경도 프로젝트에 맞춰 직접 검증하며 유료 사용은 무단 활성화하지 않는다.

Actions 외부의 실행 환경에서 아래 검사를 수행한다.

```sh
python3 -m unittest discover -s tests -v
python3 automation/check.py
python3 automation/check.py --run
```

구조 검사는 파일·경로·출처·대안·명령 형식을 확인할 뿐 제품의 실용성이나 정확성을 증명하지 않는다. 정상·오류·경계 입력, 필요한 빌드, 실제 사용자 동작을 별도로 확인한다. 테스트한 파일과 원격 반영 파일이 일치하는지 확인한다.

실제 테스트·빌드 실패나 미검증 코드는 main에 넣지 않는다. 필수 검사·리뷰·보호 규칙·앱 승인이 막으면 우회하지 않는다. 필수 검사가 Actions를 요구하더라도 실행하거나 규칙을 해제하지 말고 차단 사실을 보고한다.

## 소개와 보고

메인 README는 프로젝트 이름·짧은 설명·실제 미리보기만 있는 목록으로 유지한다. 사용법과 제한은 프로젝트 README에, 검증 증거와 반영 커밋·PR은 reports/에 둔다. 채팅 보고는 이름·기능·실행 파일·main 반영 여부 위주로 짧게 하되 중요한 실패나 미검증을 숨기지 않는다.

## 중지와 범위

예약을 중지하려면 ChatGPT에서 BlueBWorks 하루 두 작품을 일시 중지한다. 저장소 파일을 지울 필요는 없다. private을 유지하며 공개 전환·외부 배포·릴리즈·결제·권한·보호 규칙 변경은 별도 승인 대상이다. 전체 승인 범위와 개인정보 규칙은 AGENTS.md를 따른다.
