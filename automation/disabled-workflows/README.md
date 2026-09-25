# 실행하지 않는 과거 설정

사용자의 명시적 요청으로 BlueBWorks에서는 GitHub Actions를 사용하지 않는다. verify.yml.disabled는 삭제 대신 보관한 과거 원본이며 실행하거나 .github/workflows로 복원하지 않는다.

테스트·빌드·화면 캡처는 DevSpace, Oracle 또는 사용 가능한 임시 실행 환경에서 직접 수행한다. GitHub 연결 도구는 코드 읽기·push·main 반영에 사용한다. 다른 저장소의 Actions 설정은 변경하지 않는다.
