# BlueBWorks AI Radar

빠르게 쏟아지는 AI·개발 소식 중 실제로 확인할 가치가 있는 것만 한국어로 정리하는 정적 웹사이트입니다.

## 구조
- `docs/index.html`: 최신 글, 검색, 카테고리 필터
- `docs/post.html?slug=...`: 글 상세
- `docs/about.html`: 수집·검증 기준
- `docs/data/posts.json`: 게시물 데이터
- `docs/feed.xml`: RSS
- `AUTOMATION.md`: 자동 발행 규칙

이 저장소의 `docs/`가 원본입니다. 실제 GitHub Pages 배포는 이미 Pages가 활성화된 `Blue-B/Blue-B.github.io` 저장소의 `BlueBWorks/` 경로에 동기화합니다.

사이트 주소: https://blue-b.github.io/BlueBWorks/

예약작업은 새 글을 원본에 반영한 뒤 실제 Pages 저장소에도 동기화합니다. 별도의 새 GitHub Actions 워크플로는 만들지 않습니다.
