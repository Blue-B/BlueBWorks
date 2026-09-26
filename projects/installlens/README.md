# InstallLens

npm 프로젝트의 `package-lock.json`을 설치 전에 오프라인으로 훑어 **설치 스크립트 승인 필요 항목, Git/원격 URL 의존성, integrity 누락**을 보여주는 작은 점검 도구입니다.

Python 표준 라이브러리만 사용하며 외부 서비스로 lockfile을 업로드하지 않습니다.

## 실행

```bash
python installlens.py sample-package-lock.json --package-json sample-package.json
python installlens.py /path/to/package-lock.json --package-json /path/to/package.json --strict
```

`--strict`는 검토할 항목이 있으면 종료 코드 2를 반환합니다. 이 도구는 악성 코드 판정기가 아니라 설치 전 검토 범위를 줄이는 보조 도구입니다.

## 테스트

```bash
python -m unittest -v test_installlens.py
```
