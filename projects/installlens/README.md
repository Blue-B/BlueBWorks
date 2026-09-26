# InstallLens

`package-lock.json`을 오프라인에서 읽어 npm 설치 전에 검토할 항목을 정리합니다.

## 실행

```bash
python installlens.py /path/to/package-lock.json
python installlens.py /path/to/package-lock.json --package-json /path/to/package.json --strict
```

Python 표준 라이브러리만 사용합니다. `--strict`는 검토할 항목이 있으면 종료 코드 2를 반환합니다.

## 테스트

```bash
python -m unittest -v test_installlens.py
```
