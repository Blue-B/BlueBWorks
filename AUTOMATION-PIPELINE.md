# BlueBWorks 자동 게시 파이프라인 (2026-10-28)

## 실행 주체와 범위

ChatGPT 예약 작업이 기사 후보 조사, 공식 자료 확인, 원고 작성, 빌드, GitHub Pages 배포와 공개 검증을 수행한다. 이 저장소 자체에 지속 실행하는 AI 에이전트나 추가 GitHub Actions는 없다. 따라서 예약 작업이 중단되거나 연결 도구 접근에 실패하면 새 기사는 게시되지 않는다. 실패를 성공이라고 보고하지 않는다.

대상은 `Blue-B/BlueBWorks`의 최신 `main`뿐이다. 기존 개인 블로그 `Blue-B/Blue-B.github.io`와 GitHub Pages 설정, 유료 API, 비밀키, 도메인 설정은 자동으로 변경하지 않는다. 오래된 로컬 체크아웃 또는 변경이 남은 작업 폴더를 덮어쓰지 않는다. 최신 원격 `main`에서 격리된 작업 폴더를 확보한다.

## 발행 한 회차

1. 최신 원격 `main` SHA, RSS 최신 글, 관련 기존 기사들을 확인한다. `AUTOMATION.md`와 `AUTOMATION-X.md`를 읽는다.
2. 공식 웹 검색과 `npm run radar`를 함께 사용해 최근 24시간 중심의 후보를 찾고 필요할 때 최근 7일로 확장한다. 수집 실패는 기록하고 다른 1차 출처를 사용한다. X 공개 게시물은 소재 발견용이며 사실 근거는 공식 문서로 검증한다.
3. 이미 다룬 소식을 제외하고 실제 활용 가치가 큰 주제 **최대 한 편**을 선택한다. 새 소식이라는 이유만으로 사소한 릴리스나 원문 재서술을 발행하지 않는다.
4. 공식 1차 출처 최소 두 개를 실제 열어 확인하고 출시 상태, 지원 범위, 버전, 가격, 성능 수치의 출처를 검증한다. 공개 프리뷰를 정식 출시로 포장하지 않는다.
5. `content/articles/<slug>.json`에 충분한 기술 해설과 실제 사용 상황, 유용한 링크, 정정 가능한 날짜 정보를 작성한다. `editorialVersion: 2`, `reviewStatus: reviewed` 및 기존 최소 본문 4,000자·출처·미디어 권리 기준을 유지한다. 권리가 불명확한 이미지를 복사하지 않는다.
6. `npm run verify`로 HTML·SEO 메타·canonical·BlogPosting 구조화 데이터·사이트맵·RSS·내부 링크·미디어·기존 테스트를 확인한다. `node tools/publication-health.mjs --since=<직전_글의_게시시각>`로 실제 새 글이 생성됐는지 확인한다.
7. 최신 원격 SHA에서 새 기사 데이터와 생성된 `docs/`를 함께 커밋해 `main`에 fast-forward로 반영한다. 실패 시 충돌을 재검토하고 오래된 커밋을 강제 푸시하지 않는다.
8. `npm run remote:check -- --slug=<기사_slug> --title='<실제 기사 제목>'`로 공개 HTML 본문, 정확한 canonical, 홈·글 목록·sitemap·RSS의 일치 여부를 확인한다. Pages 반영 지연이라면 적절한 간격으로 재확인한다. GitHub Actions 배포 성공만으로 발행 완료로 보지 않는다.
9. 보고에는 `published`/`pushed_unverified`/`skipped_no_candidate`/`failed` 중 정확한 상태, 공개 URL과 제목, SHA 전후, 확인한 범위와 실패 원인을 적는다. 한 회차에 중복 글을 발행하지 않는다.

## SEO와 AdSense

현재 빌더는 고유 URL, canonical, 각 글 제목·설명, BlogPosting JSON-LD, 내부 관련 글, RSS·sitemap을 생성한다. 이는 검색엔진이 이해하기 쉬운 기본 설정일 뿐 검색 결과 노출이나 순위는 보장하지 않는다. 사용자의 AdSense 승인을 위해 원문과 다른 실용 설명, 방문자를 위한 탐색과 정책·운영자 정보의 정확성을 우선한다. 자동 발행량을 늘리기 위해 반복·저품질 글을 만들지 않는다.

현재 사이트는 사용자 지정 도메인 `https://bluebworks.com/` 루트에 있다(2026-10-29 전환, Cloudflare Registrar에서 구매한 도메인, docs/CNAME). 이전 `https://blue-b.github.io/BlueBWorks/` 경로는 GitHub Pages가 새 주소로 넘긴다. 실제 호스트 루트 `https://blue-b.github.io/robots.txt`와 `https://blue-b.github.io/ads.txt`는 별도의 개인 사이트 저장소 관할이므로 이 저장소에서 바꾸지 않는다. Search Console 소유권 확인, AdSense 사이트 연결·심사, ads.txt 게시자 ID, 개인정보 처리 및 동의 설정은 계정 주인이 제공·승인해야 할 별도 단계이다. **승인이나 색인 등록을 자동으로 달성했다고 주장하지 않는다.**

## 로컬 확인 명령

```sh
npm run radar
npm run verify
node tools/publication-health.mjs
npm run remote:check -- --slug=<slug> --title='<title>'
```

`npm run radar`는 최근 공식 소식 URL과 시간만 제안하며 AI 원고를 생성하지 않는다. 원고 작성은 ChatGPT 예약 작업이 맡는다. `remote:check`는 읽기 전용으로 공개 사이트 5개 주소를 조회해 새 글이 실제로 게시됐는지만 확인한다.
