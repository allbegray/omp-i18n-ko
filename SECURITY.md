# 보안 정책 (Security Policy)

## 지원 버전

| 버전 | 지원 |
| --- | --- |
| 0.1.x | ✅ |

## 취약점 신고

보안 이슈는 공개 이슈 대신 **GitHub 비공개 취약점 신고**를 사용해 주세요: 저장소 → **Security** → **Report a vulnerability**.

개인 프로젝트라 응답은 최선 노력(best effort) 기준입니다. 확인된 취약점은 가능한 한 빠르게 수정하고 릴리즈에 기록합니다.

## 보안 설계

- **공식 omp 확장 API만 사용**합니다. omp 본체·dist·설정 파일을 직접 수정하거나 패치하지 않습니다.
- **네트워크 통신이 없습니다.** 번역 데이터는 전부 리포지토리 안의 로컬 JSON이며, 외부로 전송되는 데이터가 없습니다.
- **파일 시스템 접근은 omp가 제공하는 설정 스코프 읽기/쓰기뿐**입니다 (`settings.layered()` / `settings.set()`).
- 번역 데이터는 **선언적 문자열·정규식**이며 `eval` 등으로 실행되지 않습니다.
- 모든 경로가 **예외 격리 + 영어 폴백**이라 데이터가 손상되거나 omp가 업데이트돼도 CLI 동작에 영향을 주지 않습니다.
- 확장은 omp와 **같은 사용자 권한**으로 실행됩니다(omp 확장 모델의 본질). 이 프로젝트는 그 권한을 설정 UI 번역 목적으로만 사용합니다.

## English

Report vulnerabilities via **GitHub private vulnerability reporting** (repository → Security → Report a vulnerability). Best-effort response — this is a personal project.

Scope notes: this extension uses only the official omp extension API, makes **no network requests**, touches no files beyond omp's own settings scopes, treats all translation data as inert declarative strings, and isolates every failure path to fall back to English without affecting the CLI.
