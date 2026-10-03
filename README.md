# BlueBWorks AI Radar

빠르게 쏟아지는 AI·개발 소식 중 실제로 확인할 가치가 있는 것만 한국어로 정리하는 정적 웹사이트입니다.

## 구조
- `docs/index.html`: 최신 글, 검색, 카테고리 필터
- `docs/post.html?slug=...`: 글 상세
- `docs/about.html`: 수집·검증 기준
- `docs/data/posts.json`: 게시물 데이터
- `docs/feed.xml`: RSS
- `AUTOMATION.md`: 자동 발행 규칙
- `vercel.json`: Vercel 정적 배포 설정

GitHub Actions는 사용하지 않습니다. 저장소는 Private으로 유지하고, 예약작업이 `main`에 새 글을 반영하면 연결된 Vercel 프로젝트가 자동으로 다시 배포하는 구조입니다.

Vercel은 저장소 루트의 `vercel.json`에 따라 `docs/`를 사이트 루트로 배포합니다.
