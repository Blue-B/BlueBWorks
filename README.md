# BlueBWorks AI Radar

공식 자료와 실제 사용 경로를 함께 정리하는 한국어 AI 기술 사이트입니다.

- 사이트: https://blue-b.github.io/BlueBWorks/
- 음성 AI 해설: https://blue-b.github.io/BlueBWorks/articles/microsoft-mai-audio-vercel-ai-gateway-2026/
- 기존 `post.html?slug=...` 주소도 같은 글로 연결됩니다.

## 구현
짙은 우주 배경과 생성 캐릭터, 밝은 기사 본문, 데스크톱의 목차·리소스 사이드바를 사용합니다. 모바일에서는 읽는 순서대로 한 열로 정리됩니다. 캐릭터 안내, 검색, 카테고리 필터, 링크 복사, 동작 줄이기 기능이 있습니다.

본문은 JavaScript 실행을 기다리지 않아도 HTML에 포함됩니다. 각 기사에는 개별 주소, canonical, 설명, BlogPosting 구조화 데이터가 있으며 RSS와 sitemap을 생성합니다. 검색 노출이나 광고 수익을 보장하는 설정은 아닙니다.

## 빌드
Node.js 18 이상이 필요합니다. npm 패키지 의존성은 없습니다.

```sh
npm run build
npm run check
npm test
# 전체 빌드·정적 검사·단위 테스트
npm run verify
```

이미지는 준비된 파일을 재사용합니다. 원본 에셋을 다시 확보할 때만 네트워크가 필요하며, Python Pillow가 있으면 큰 이미지를 최적화합니다. 준비된 이미지를 사용하는 일반 빌드는 Pillow가 없어도 됩니다.

브라우저 검사는 DevSpace의 전용 브라우저 프로필을 사용합니다.

```sh
SITE_TEST_URL=https://blue-b.github.io/BlueBWorks node test/browser-smoke.mjs
```

## 파일
- `docs/data/posts.json`: 기존 기사 데이터
- `content/reviewed-posts.json`: 같은 slug에 우선 적용하는 검토본
- `build/lib/templates.mjs`, `rich.mjs`: 페이지·기사 HTML
- `site/assets/`: CSS, 동작 코드, 준비된 이미지
- `site/asset-data.json`: 생성 캐릭터의 원본 데이터
- `build/prepare-assets.mjs`: 공식 이미지 다운로드 및 캐릭터 준비
- `site/assets/credits.json`: 에셋 출처
- `site.config.json`: 사이트 이름과 기준 주소
- `docs/`: GitHub Pages에 실제 게시되는 빌드 결과
- `AUTOMATION.md`: 기사 작성·사실 확인·배포 규칙

`docs/`는 빌드 결과지만 저장소에 함께 반영해야 합니다. 데이터 JSON만 바꾸고 빌드 결과를 올리지 않으면 실제 기사 페이지는 바뀌지 않습니다.

## 미디어 및 편집
장식용 로봇은 AI 생성 이미지입니다. 우주 배경은 NASA / Jessica Meir의 공식 사진이며, 기사 이미지에는 공식 발표 자료를 사용합니다. 로봇이나 구성도를 제품의 실제 화면처럼 표시하지 않습니다. 확인된 관련 영상이 없으면 유튜브 임베드를 만들지 않습니다.

Microsoft 음성 AI 글은 문서 기반 해설입니다. 유료 API를 실제 호출해 벤치마크한 사용기가 아닙니다. 기존 다른 기사의 본문은 별도 검토본이 없는 한 원본을 유지합니다.

Pages는 이 저장소의 `main /docs`를 사용합니다. 개인 블로그 저장소 `Blue-B/Blue-B.github.io`는 수정하거나 동기화하지 않습니다. 사용자 정의 GitHub Actions 워크플로는 추가하지 않습니다.
