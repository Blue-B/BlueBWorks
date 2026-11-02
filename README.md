# BlueBWorks

AI 도구, 화제 오픈소스, 개발 트렌드를 직접 확인하고 정리하는 한국어 사이트입니다.

사이트: https://bluebworks.com/

## 다루는 내용

- AI 도구와 서비스: 새 기능, 요금과 한도 변경, 보안 이슈
- 오픈소스: 주목받는 저장소의 쓰임새, 설치와 실행 결과
- 개발 트렌드: 커뮤니티 화제, 개인 개발자 프로젝트, 업계 동향

모든 글에는 발표일과 원문 출처를 남기고, 실제 화면과 확인한 수치를 바탕으로 씁니다.

## 기능

헤더 검색, 카테고리 필터, 모바일 메뉴, 이미지 확대, 원문 영상 재생, 오른쪽 목차, 글 끝 참고 자료 목록, 링크 복사, 동작 줄이기를 제공합니다.

글마다 개별 주소, canonical, 설명, BlogPosting 구조화 데이터를 만들고 RSS와 sitemap을 생성합니다. 기존 `post.html?slug=...` 주소도 같은 글로 연결됩니다.

## 글 데이터

- `content/articles/<slug>.json`: 기사 원본. 한 파일에 한 기사.
- `content/reviewed-posts.json`: 이전 검토본
- `docs/data/posts.json`: 초기 기사 데이터

같은 slug가 여러 곳에 있으면 `content/articles/`가 가장 우선합니다. 글을 고칠 때는 이 폴더부터 확인합니다.

`sections`는 문단, 출처 번호와 함께 `figures`, `video`, `links`, `table`, `code`를 지원합니다. 이미지에는 설명, 대체 텍스트, 크기, 출처 링크가 필요합니다. 영상은 자동 재생하지 않습니다.

## 빌드와 검사

Node.js 18 이상에서 별도 의존성 없이 실행합니다.

```sh
npm run editorial:check # 기사 구조, 분량, 출처 번호 검사
npm run build           # 검사 후 정적 HTML, RSS, sitemap 생성
npm run check           # 생성된 HTML과 내부 링크 검사
npm test                # 데이터, 렌더링, 출처와 미디어, UI 테스트
npm run verify          # 전체 검증
npm run indexnow        # 새 글 주소를 검색엔진에 알림
```

구조 검사를 통과했다고 내용이 사실로 확인된 것은 아닙니다. 글을 쓸 때 공식 원문을 직접 읽고 확인합니다.

`site/assets/`와 `build/lib/`가 디자인과 렌더링 원본이고 `docs/`가 게시 결과입니다. 기사 JSON과 함께 빌드한 `docs/`도 커밋해야 사이트에 반영됩니다. 기준 도메인은 `site.config.json`에서 관리합니다.

## 발행

새 소식 조사, 원문 확인, 작성, 검증과 빌드, main 반영, 공개 페이지 확인 순서로 진행합니다. 의미 있는 새 소식이 없는 회차는 건너뜁니다. 세부 절차는 `AUTOMATION.md`에 있습니다.

GitHub Pages는 `main` 브랜치의 `docs/`를 게시합니다. 되돌릴 때는 해당 커밋을 revert하는 새 커밋을 만들고, 강제 push나 기록 재작성은 하지 않습니다.
