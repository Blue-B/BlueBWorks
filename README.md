# BlueBWorks AI Radar

빠르게 쏟아지는 AI·개발 소식 중 실제로 확인할 가치가 있는 것만 한국어로 정리하는 정적 웹사이트입니다.

## 구조
- `docs/index.html`: 최신 글, 검색, 카테고리 필터
- `docs/post.html?slug=...`: 글 상세
- `docs/about.html`: 수집·검증 기준
- `docs/data/posts.json`: 게시물 데이터
- `docs/feed.xml`: RSS
- `AUTOMATION.md`: 자동 발행 규칙

GitHub Actions는 사용하지 않습니다. GitHub Pages는 `main /docs`를 게시 소스로 사용합니다.

예상 Pages 주소: https://blue-b.github.io/BlueBWorks/
