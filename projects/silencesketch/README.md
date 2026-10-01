# SilenceSketch

말이 없는 긴 구간을 파형 위에 바로 표시하고, 지울 쉼과 남길 쉼을 직접 고른 뒤 정리된 WAV를 만드는 로컬 브라우저 도구야. 오디오는 서버로 업로드하지 않아.

## 실행

```bash
cd projects/silencesketch
python3 -m http.server 8080 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8080`을 열고 오디오를 끌어놓거나 **9초 데모**를 누르면 돼.

## 할 수 있는 것

- 브라우저가 해석할 수 있는 오디오 파일을 로컬에서 열기
- 무음 기준(dB), 최소 무음 길이, 말끝 여유를 움직이며 결과를 즉시 비교
- 제안된 컷마다 체크를 꺼서 의도적인 쉼 보존
- 실제 잘린 오디오를 16-bit PCM WAV로 저장
- 파일 없이도 9초 가상 음성 데모로 전체 흐름 체험

## 검증

```bash
node test_audio_core.js
```

2026-10-01에 핵심 무음 검출·구간 제거·WAV 인코딩 Node 테스트 5개와 `app.js`·`audio-core.js` 문법 검사를 다시 실행해 통과했어.

### 실제 브라우저 검증·GIF 캡처 재현

Python Playwright, Pillow와 Chromium이 준비된 환경에서는 다음 명령을 실행할 수 있어. 런타임 앱에는 이 개발용 의존성이 필요하지 않아.

```bash
python3 browser_test.py
python3 browser_test.py --capture
```

`SILENCESKETCH_CHROMIUM`으로 Chromium 실행 경로를 지정할 수 있어. 스크립트는 루프백 주소에서 앱을 직접 열고 가상 음성 데모, 컷 유지·복원, 감도 변경, 무음 없음, 실제 WAV 다운로드, 합성 WAV 파일 입력, 잘못된 오디오와 복구, 반복 실행 및 390px·320px 화면을 검사하도록 작성했어. `--capture`는 모든 검사 통과 후 실제 브라우저 화면으로 `demo.gif`, `preview.png`, `preview-checks.json`을 만들어. GIF는 소리가 없는 화면 상태 시퀀스이고 연속 녹화 영상은 아니야.

현재 **브라우저 E2E와 실제 GIF는 미완료**야. 2026-10-01 환경에서는 설치된 Chromium이 `socket() failed: Operation not permitted`로 시작하지 못했고, 관리형 브라우저도 로컬 URL을 `net::ERR_BLOCKED_BY_CLIENT`로 거부했어. 캡처 스크립트는 Python 문법 검사만 통과했고 브라우저 시나리오가 통과했다고 간주하지 않아. 실제 캡처를 얻기 전까지 README에 실행 화면을 대신하는 그림을 넣지 않았어.

## 제한

현재는 결과를 WAV로 내보내기 때문에 MP3/M4A 원본 코덱은 유지하지 않아. 긴 파일은 브라우저 메모리를 많이 사용할 수 있고, 에너지 기반 무음 감지라 조용한 배경음까지 무음으로 판단할 수 있어. Safari·Firefox와 모바일 실기기는 미검증이야.
