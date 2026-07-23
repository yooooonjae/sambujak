# 부동산 연구 3부작 — 통합 허브 (循環 · 時差 · 收支)

세 개의 독립 연구를 하나의 의사결정 시스템으로 잇는 랜딩 페이지.

> 순환에서 구조를 보고, 시차에서 전달시간을 재고, 수지에서 손익으로 환산한다.

- **循環 순환** — 시장과 자본의 구조 (공급·분양·리츠) · https://sunhwan.pages.dev · [github.com/yooooonjae/sunhwan](https://github.com/yooooonjae/sunhwan)
- **時差 시차** — 신호의 전달시간 (금리·거래·가격·공급 교차상관) · https://sicha.pages.dev · [github.com/yooooonjae/sicha](https://github.com/yooooonjae/sicha)
- **收支 수지** — 개별 사업의 손익 (수지 계산기·민감도·딜 리포트) · https://yoonjae.pages.dev · [github.com/yooooonjae/suji](https://github.com/yooooonjae/suji)

## 구성

단일 `index.html` — 외부 네트워크 요청 0 (인라인 CSS·SVG, 시스템 명조 폰트, 이미지 없음).

1. 히어로 — 「부동산 연구 3부작」 + 한 문장
2. 세 카드 — 각 연구의 질문 · 미감 힌트(순환 금 · 시차 적청 · 수지 주황) · 라이브 링크
3. 사용자 경로 — 순환 → 시차 → 수지
4. 대표 사례 — 부산 초기분양률 회복(56.4→71.0) → 전국 전달 시차 지도 탐색 → 부산 조건 수지 시나리오 (각 단계가 해당 연구의 장으로 딥링크)
5. 푸터 — GitHub 세 저장소 · 데이터 공개 원칙 · noindex

## 미감

세 사이트의 공통 골격(56px 앱바 · 카드 12px · 명조 디스플레이) 위에 중립 종이색.
세 색은 포인트로만 쓴다. 라이트/다크 자동(`prefers-color-scheme`) + 토글(`data-theme`). 모바일 1열.

## 원칙

공공 데이터만으로 관측하고, 불리한 결과까지 화면에 공개한다. 모든 수치는 예측적
선후관계이며 인과 주장이 아니다. `noindex` 상시.
