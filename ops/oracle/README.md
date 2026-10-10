# Oracle ARM 독립 게시기

GitHub Actions와 유료 LLM API를 쓰지 않는 BlueBWorks 정적 페이지 발행기다. Node.js 18+, Git, npm, GitHub Pages를 이용한다. 외부 AI가 **검증 완료된 기사 JSON**을 `pending/articles/<slug>.json`으로 GitHub `main`에 제출하면, Oracle에서 정해진 시각에 가져와 `content/articles/`로 옮기고 빌드·검사·비강제 Git push·공개 페이지 확인까지 한다. 별도의 AI 작성 엔진은 포함하지 않는다.

## 실행 구조

- 매 실행마다 `main`을 임시 폴더에 새로 복제한다. 과거 Oracle 체크아웃이나 미반영 로컬 데이터를 재사용하지 않는다.
- 최신 전체 소스에서 한 회차에 한 글만 선택한다. `slug`가 기존 글과 중복되거나 편집 검사를 통과하지 않으면 아무 것도 게시하지 않는다.
- `publishedAt`은 첫 게시 시각으로 발행기가 지정한다. `announcedAt`·`verifiedAt`은 원문대로 유지한다.
- `npm run verify`, `publication-health --since`, HTML·RSS·사이트맵 일치 검사 후 `main`에 일반 Git push한다. 강제 push와 브랜치 덮어쓰기는 하지 않는다.
- 공개 GitHub Pages 글의 HTTP 200과 본문을 재확인한다. 지연되면 `pushed_unverified`로 남기고 다시 게시하지 않는다.
- 실행 기록: `~/.local/state/bluebworks-publisher/history.jsonl`. 로그와 임시 checkout은 게시 파일로 업로드하지 않는다.
- 실행 중 중복을 막는 잠금과 같은 오전/오후 회차 중복 발행 방지 기능이 있다. 상태가 `no_candidate`이면 새 글 대기 중이 아니라는 뜻이다.

## 기사 대기열

기사 작성 작업은 기존 사이트를 빌드하거나 `docs/`를 직접 수정하지 않고, **검증된 원고 JSON 하나만** `pending/articles/<slug>.json`에 원격 Git 커밋으로 제출해야 한다. JSON은 `editorialVersion: 2`, `reviewStatus: "reviewed"`, 원문 2개 이상, 4,000자 이상, 다섯 섹션 이상, `mediaReview` 및 `discovery`의 실제 조사 기록 등 기존 편집 검사를 만족해야 한다.

새 이미지나 도식은 별도로 권리 확인 후 `site/assets/editorial/`에 함께 올리고, 기사에는 실제 공개 예정 이미지 URL·원본 출처·alt·크기를 써야 한다. 게시기가 `npm run verify` 중 `docs/assets`로 옮긴다. 대기열 파일의 `publishedAt`은 첫 게재 시 발행기가 결정하므로 이 값으로 날짜를 임의 조작하지 않는다. 서로 다른 slug의 파일을 2개 이상 대기시킬 수 있다.

## 서버 점검

```bash
node /home/ubuntu/projects/BlueBWorks/ops/oracle/publisher.mjs --probe
node --test /home/ubuntu/projects/BlueBWorks/ops/oracle/publisher.test.mjs
```

`--probe`는 최신 `main`을 임시 복제해 전체 빌드를 검증하고, **빈 로컬 테스트 커밋의 `git push --dry-run`**을 수행한다. 실제 게시물 또는 브랜치를 변경하지 않는다. `--dry-run`은 대기열에 실제 검증 완료된 원고가 있을 때 게시 직전까지 검사한다(게시하지 않음).

## 24시간 타이머 활성화

Oracle VM에서 초기 1회 `bash /home/ubuntu/projects/BlueBWorks/ops/oracle/setup.sh`를 실행하면 사전 검증 후 아래 설정을 등록한다. 로그인하지 않아도 동작하게 하려면 아래의 linger 설정도 확인해야 한다.

단일 사용자 Ubuntu 기준으로 `systemd --user`를 사용한다. 다음은 Oracle VM에서 **초기 1회 실행해야 하는 관리자 설정**이다. 템플릿 파일을 저장소에 추가한 것만으로 OS의 예약 기능이 활성화되는 것은 아니다.

```bash
mkdir -p ~/.config/systemd/user
ln -sf /home/ubuntu/projects/BlueBWorks/ops/oracle/bluebworks-publisher.service ~/.config/systemd/user/bluebworks-publisher.service
ln -sf /home/ubuntu/projects/BlueBWorks/ops/oracle/bluebworks-publisher.timer ~/.config/systemd/user/bluebworks-publisher.timer
systemctl --user daemon-reload
systemctl --user enable --now bluebworks-publisher.timer
systemctl --user list-timers bluebworks-publisher.timer
```

로그아웃 뒤에도 타이머를 실행하려면 OS 관리자 권한으로 `sudo loginctl enable-linger ubuntu`를 설정해야 할 수 있다(먼저 `loginctl show-user ubuntu -p Linger`로 확인). 비밀키는 저장소나 서비스 유닛에 기록하지 않는다. Git 인증은 서버의 Git credential helper/SSH에서 관리해야 한다. `--probe`에서 push dry-run이 거절되면 유효한 GitHub 쓰기 인증을 별도 설정해야 한다.

시각은 KST 기준 09:20·10:30(오전 재시도), 20:20·21:30(오후 재시도)이며 오전/오후당 성공 게시를 최대 한 건만 처리한다. 예비 실행은 글이 이미 게시됐으면 건너뛴다.

```bash
systemctl --user status bluebworks-publisher.timer
journalctl --user -u bluebworks-publisher.service -n 100 --no-pager
tail -n 30 ~/.local/state/bluebworks-publisher/history.jsonl
```

**중요**: 이 프로그램은 검증된 원고를 올리는 역할만 한다. 매일 두 편의 뉴스 소재 조사·AI 원고 작성 자체를 Oracle에서 수행하지 않는다. 기사 생성 및 `pending/` 제출이 중단되면 발행기는 `no_candidate`를 기록하고 종료한다. 원고 생성 자동화가 별도로 필요하며, 기존 ChatGPT 예약 실행을 바꿀 때에는 타이머가 실제로 활성화된 뒤 전환해야 발행 공백을 피할 수 있다.
