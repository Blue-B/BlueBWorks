# BlueBWorks AI Radar 자동 발행 규칙

## 목적
AI와 개발 도구를 실제로 쓰는 사람이 놓치기 아까운 새 소식만 선별해 한국어로 정리한다. 단순 뉴스 번역이나 수량 채우기용 글은 만들지 않는다.

## 우선 수집원
1. 공식 발표: OpenAI, Anthropic, Google/DeepMind, GitHub, 주요 제품 공식 블로그와 릴리스 노트
2. 오픈소스: GitHub 저장소/Release/Trending, Hugging Face
3. 개발자 반응: Hacker News, Reddit 등
4. X는 공식 계정 또는 원 개발자 확인용 보조 소스로만 사용

## 발행 조건
- 새로운 모델, 제품, API, 개발 도구, 오픈소스 또는 중요한 기능 변화인가
- 공식 원문이나 원 저장소로 사실 확인이 가능한가
- 한국 개발자가 실제로 써보거나 알아둘 이유가 있는가
- 최근 게시물과 사실상 같은 내용이 아닌가

조건에 못 미치면 그 회차에는 아무 글도 올리지 않는다.

## 글 형식
- 제목
- 2~3문장 요약
- 무엇이 나왔는지
- 개발자에게 왜 중요한지
- 직접 써볼 때 알아둘 점
- 공식 출처
- 확인 시각

과장된 표현, 확인되지 않은 성능 비교, 출처 없는 숫자는 넣지 않는다.

## 저장과 배포
이 저장소 `Blue-B/BlueBWorks` 자체가 GitHub Pages 프로젝트 저장소다. Pages 게시 소스는 `main` 브랜치의 `/docs` 폴더다.

새 글은 `docs/data/posts.json` 배열 맨 앞에 추가하고 `docs/feed.xml`도 최신순으로 갱신한다. RSS의 사이트 링크와 각 글 링크는 항상 `https://blue-b.github.io/BlueBWorks/` 기준으로 유지한다.

예약작업은 이 저장소의 `main`만 수정한다. 기존 개인 블로그 저장소 `Blue-B/Blue-B.github.io`는 절대 수정하거나 동기화하지 않는다. 별도의 사용자 정의 GitHub Actions 워크플로도 만들지 않는다.

수정 전 `main` 최신 상태를 다시 확인하고 기존 변경을 덮어쓰지 않는다. 변경 후 `docs/data/posts.json`과 `docs/feed.xml`을 다시 읽어 새 항목, JSON 문법, 공식 출처 URL, GitHub Pages 링크가 실제 반영됐는지 확인한다.
