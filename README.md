# BlueBWorks

개발 도구, 오픈소스, AI 소식을 공식 출처와 함께 정리하는 한국어 정적 사이트입니다.

사이트: https://blue-b.github.io/BlueBWorks/

## 구성
장식을 줄인 밝은 바탕과 본문 중심 화면입니다. 작은 로봇 캐릭터는 브랜드 보조 요소로만 쓰고, 기사 탐색을 중심으로 구성합니다. 헤더 검색, 모바일 메뉴, 카테고리 필터, 이미지 확대, 원문 영상 재생, 오른쪽 목차, 글 끝 참고 자료 목록, 링크 복사, 동작 줄이기를 제공합니다. 모바일 메뉴와 이미지 링크는 JavaScript가 없어도 기본 탐색 경로를 유지합니다.

본문은 처음부터 HTML에 포함됩니다. 개별 기사 주소와 canonical, 설명, BlogPosting 구조화 데이터, RSS와 sitemap을 생성합니다. 기존 `post.html?slug=...`도 같은 글에 연결됩니다. 검색 노출과 수익을 보장하는 설정은 아닙니다.

## 작성 데이터
- `docs/data/posts.json`: 보존한 기존 기사 데이터
- `content/reviewed-posts.json`: 기존 정밀 검토본
- **`content/articles/<slug>.json`: 새로운 장문 기사와 기존 글 개정본. 한 파일당 한 기사.**

같은 slug에는 위 목록에서 뒤쪽 데이터가 우선합니다. 기존 검토본보다 `content/articles/`가 우선하므로 실제 글을 수정할 때 이 폴더부터 확인합니다. 발표일을 임의로 새 날짜로 바꾸지 않고 정정이 필요한 내용은 기록합니다.

`sections`는 문단·출처 번호와 함께 `figures`, `video`, `links`, `table`, `code`를 지원합니다. 원문 이미지에는 설명, 대체 텍스트, 고유 크기, 출처 링크가 필요합니다. 공식 MP4는 직접 재생할 수 있지만 자동재생하지 않습니다. 확인되지 않은 영상 ID나 가짜 재생 버튼은 넣지 않습니다.

## 빌드와 검사
Node.js 18 이상, 별도 npm 의존성 없이 실행합니다.

```sh
npm run editorial:check # 새 장문 기사 구조·분량·출처 번호 검사
npm run build           # 구조 검사 후 정적 HTML·RSS·sitemap 생성
npm run check           # 생성된 HTML과 내부 링크 검사
npm test                # 데이터, 렌더링, 출처·미디어, UI 회귀 테스트
npm run verify          # 전체 검증
```

장문 기사 검사는 본문 3,000자 이상, 출처 연결, 중복 문단, 원문 미디어 정보와 직접 자료 링크를 확인합니다. **구조 검사만으로 사실이 검증되는 것은 아닙니다.** 편집 시 공식 원문을 실제로 읽고 별도로 확인해야 합니다.

`site/assets/`와 `build/lib/`가 디자인·렌더링 원본이며 `docs/`는 게시되는 결과입니다. **JSON뿐 아니라 빌드한 docs/도 함께 커밋**해야 사이트가 바뀝니다. `site.config.json`이 기준 도메인을 관리합니다.

## 브라우저 확인
DevSpace 전용 프로필과 현재 작업공간 세션만 사용합니다.

```sh
DEVSPACE_WORKSPACE_ID=<현재작업공간> node test/browser-smoke.mjs
DEVSPACE_WORKSPACE_ID=<현재작업공간> node test/editorial-browser.mjs
# 공개 배포 검사에는 SITE_TEST_URL=https://blue-b.github.io/BlueBWorks 를 함께 지정
```

기본 검사는 기존 주소 호환·검색·캐릭터를, 편집 검사는 새 기사들의 실제 이미지·영상 메타데이터·확대·모바일 메뉴를 확인합니다. 스크린샷은 `.verify/` 또는 임시 폴더에만 기록합니다.

## 미디어와 발행
기존 로봇은 AI 생성 브랜드 보조 요소입니다. 우주 사진(`earth-night.jpg`)은 홈 공유 미리보기 이미지로만 쓰고 NASA / Jessica Meir 출처를 따릅니다. 기사에는 해당 원문에서 확인한 실제 화면·도식과 허용된 미디어를 사용하며, 장식 이미지를 제품의 증거로 설명하지 않습니다. 직접 API를 실행하지 않은 해설은 사용기나 실험 결과로 표시하지 않습니다.

정기 작업은 `AUTOMATION.md`에 따라 새 소식 조사 → 근거 확인 → 장문 작성 → 검증·빌드 → main 반영 → 공개 배포 확인 순으로 진행합니다. 의미 있는 새 소식이 없는 회차는 건너뜁니다.

GitHub Pages는 `main /docs`를 사용합니다. 개인 블로그 `Blue-B/Blue-B.github.io`는 수정하지 않으며 사용자 정의 Actions 워크플로를 추가하지 않습니다. 이번 변경 전 배포 기준은 `18057dcc7e53f0db789e6c01b92cf2894344b528`입니다. 복구가 필요하면 변경 커밋을 revert하는 새 커밋을 만들고 다시 배포합니다. 강제 push나 기록 재작성은 하지 않습니다.
