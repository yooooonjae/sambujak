# 부동산 연구 3부작 — 정적 사이트 빌드 태스크
#
# 이 사이트는 빌드 단계가 없는 순수 정적 파일이다. 그래서 배포 직전에
# `make stamp` 로 푸터 빌드 스탬프(커밋 SHA · 날짜)를 파일에 직접 주입한다.
#
#   SHA 우선순위: 환경변수 BUILD_SHA  →  없으면 `git rev-parse --short HEAD`
#                (git 이 없으면 unknown)
#   날짜:        빌드(주입) 시점의 로컬 날짜 (YYYY-MM-DD)
#
# 스탬프는 index.html 과 web/index.html 두 미러에 동일하게 주입되며,
# 주입 후 두 파일이 바이트 단위로 같은지 확인한다(미러 드리프트 차단).
#
# 사용 예:
#   make stamp                       # git 짧은 HEAD + 오늘 날짜
#   BUILD_SHA=$CF_PAGES_COMMIT_SHA make stamp   # 배포 커밋 SHA 주입

SHELL := /bin/sh
HTML  := index.html web/index.html

.PHONY: help stamp mirror check

help:
	@echo "make stamp   — 빌드 스탬프(SHA·날짜)를 두 index.html 에 주입 (BUILD_SHA 우선, 없으면 git HEAD)"
	@echo "make mirror  — index.html → web/index.html 동기화"
	@echo "make check   — 링크·자산·og.png 계약 + 미러 동일성 검사(tests/check_links.js)"

stamp:
	@sha="$${BUILD_SHA:-$$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"; \
	date="$$(date +%Y-%m-%d)"; \
	for f in $(HTML); do \
	  if ! grep -q '<!--BUILD-->' "$$f"; then \
	    echo "✗ $$f: <!--BUILD--> 스탬프 마커 없음 — 주입 대상 없음"; exit 1; \
	  fi; \
	  sed -i.bak -E 's#<!--BUILD-->.*<!--/BUILD-->#<!--BUILD--><span class="num">'"$$sha"'</span> · Built '"$$date"'<!--/BUILD-->#' "$$f" \
	    && rm -f "$$f.bak"; \
	  echo "✓ stamped $$f  →  $$sha · Built $$date"; \
	done; \
	if ! cmp -s index.html web/index.html; then \
	  echo "✗ 스탬프 후 index.html ≠ web/index.html — 미러 불일치"; exit 1; \
	fi; \
	echo "✓ 미러 동일 확인 (index.html == web/index.html)"

mirror:
	@cp index.html web/index.html && echo "✓ web/index.html ← index.html 동기화"

check:
	@node tests/check_links.js
