# HARLens

브라우저 DevTools에서 저장한 HAR(JSON) 파일을 **외부 업로드 없이 로컬에서** 빠르게 훑는 작은 진단 도구입니다.

실패한 요청, 느린 요청, 도메인별 호출 수, 상태 코드 분포와 전송량을 한 번에 보여줘서 네트워크 문제를 처음 확인할 때 쓸 수 있습니다.

![HARLens 미리보기](preview.svg)

## 실행

```bash
python harlens.py sample.har
python harlens.py your.har --slow-ms 750
python harlens.py your.har --json
```

추가 패키지는 필요하지 않습니다. Python 표준 라이브러리만 사용합니다.

## 테스트

```bash
python -m unittest -v
```

현재는 HAR의 핵심 요청/응답 메타데이터만 분석하며 waterfall 시각화나 쿠키/헤더 보안 판정은 하지 않습니다.
