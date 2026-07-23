#!/usr/bin/env node
'use strict';
/*
 * 링크 계약 CI (강화판).
 *
 *  계약 대상: 루트 index.html 과 배포본 web/index.html 을 모두 검사한다.
 *
 *  1) 필수 딥링크 3개가 "정확한 문자열"로 존재해야 한다(삭제·오타·변형 차단):
 *        https://sunhwan.pages.dev/#/ch2   (循環 Ⅱ 분양)
 *        https://sicha.pages.dev#ch5       (時差 Ⅴ 시차지도)
 *        https://yoonjae.pages.dev/#/ch3   (收支 Ⅲ 계산기)
 *  2) 딥링크 형식 계약:
 *        순환(sunhwan)·수지(yoonjae) → 해시 SPA '#/' 형식
 *        시차(sicha)                 → 일반 앵커 '#' 형식('#/' 금지)
 *  3) 개수 하한: 세 도메인 딥링크가 각각 최소 1개(합계 ≥ 3). 0개면 실패
 *        — '링크가 통째로 사라져도 통과'하는 공백 성공을 봉쇄한다.
 *  4) 외부 자산 0: script[src]·img[src]·link[rel=stylesheet|preload…]에
 *        http(s)/프로토콜상대 URL 부재.
 *  5) og.png 존재 및 1200×630 (PNG IHDR 헤더를 파이썬 struct 로 파싱).
 *  6) 네거티브 자가검증: 위 계약을 위반한 합성 HTML(링크 삭제·형식 오염·
 *        외부 자산 주입)을 넣었을 때 체커가 "반드시 실패를 검출"하는지 확인한다.
 *        — 체커가 무력화(항상 통과)되는 회귀를 스스로 잡는다.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const fail = (m) => failures.push(m);
const pass = (m) => console.log('  ✓ ' + m);

function all(re, s) { const out = []; let m; re.lastIndex = 0; while ((m = re.exec(s))) out.push(m[1]); return out; }
function attr(tag, name) { const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i')); return m ? m[1] : ''; }
const EXTERNAL = /^(https?:)?\/\//i;

const RE_HREF = /<a\b[^>]*\bhref\s*=\s*"([^"]*)"/gi;
const RE_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*"([^"]*)"/gi;
const RE_IMG = /<img\b[^>]*\bsrc\s*=\s*"([^"]*)"/gi;
const RE_LINK_TAG = /<link\b[^>]*>/gi;

// 필수 딥링크 — "정확한 문자열"로 존재해야 함 (형식까지 이 3개가 규정한다)
const EXPECTED_DEEPLINKS = [
  'https://sunhwan.pages.dev/#/ch2',
  'https://sicha.pages.dev#ch5',
  'https://yoonjae.pages.dev/#/ch3',
];

/**
 * 단일 HTML 문자열에 대한 링크·자산 계약 검사(순수 함수).
 * @returns {{failures:string[], counts:{sunhwan:number,sicha:number,yoonjae:number,ext:number}}}
 */
function checkHtml(label, html) {
  const F = [];

  // (1) 필수 딥링크 정확 문자열 존재 assert
  for (const want of EXPECTED_DEEPLINKS) {
    if (!html.includes('href="' + want + '"')) {
      F.push(`[${label}] 필수 딥링크 누락/변형(정확 문자열 부재): ${want}`);
    }
  }

  // (2) 딥링크 형식 계약 + (3) 개수 집계
  let sunhwan = 0, yoonjae = 0, sicha = 0;
  for (const h of all(RE_HREF, html)) {
    if (!h.includes('#')) continue; // 프래그먼트 없는 라이브/깃허브 링크는 대상 아님
    if (/sunhwan\.pages\.dev/.test(h)) { sunhwan++; if (!h.includes('#/')) F.push(`[${label}] 순환 딥링크는 '#/' 형식이어야 함: ${h}`); }
    else if (/yoonjae\.pages\.dev/.test(h)) { yoonjae++; if (!h.includes('#/')) F.push(`[${label}] 수지 딥링크는 '#/' 형식이어야 함: ${h}`); }
    else if (/sicha\.pages\.dev/.test(h)) {
      sicha++;
      if (h.includes('#/')) F.push(`[${label}] 시차 딥링크는 '#'(일반 앵커) 형식이어야 함 — '#/' 금지: ${h}`);
      if (!/#[A-Za-z]/.test(h)) F.push(`[${label}] 시차 딥링크 앵커 형식 이상: ${h}`);
    }
  }

  // (3) 개수 하한 — 0개 통과 봉쇄
  if (sunhwan < 1) F.push(`[${label}] 순환 딥링크 0개 — 최소 1개 필요(링크 소실 의심)`);
  if (sicha < 1) F.push(`[${label}] 시차 딥링크 0개 — 최소 1개 필요(링크 소실 의심)`);
  if (yoonjae < 1) F.push(`[${label}] 수지 딥링크 0개 — 최소 1개 필요(링크 소실 의심)`);
  if (sunhwan + sicha + yoonjae < 3) F.push(`[${label}] 딥링크 합계 ${sunhwan + sicha + yoonjae}개 — 3개 미만`);

  // (4) 외부 자산 0 (script / img / css)
  const assets = [];
  for (const v of all(RE_SCRIPT, html)) assets.push(['script[src]', v]);
  for (const v of all(RE_IMG, html)) assets.push(['img[src]', v]);
  for (const t of (html.match(RE_LINK_TAG) || [])) {
    const rel = attr(t, 'rel').toLowerCase();
    if (/\b(stylesheet|preload|prefetch|preconnect|dns-prefetch)\b/.test(rel)) assets.push(['link[' + rel + ']', attr(t, 'href')]);
    // rel=canonical / icon 등은 자산이 아니므로 제외
  }
  let ext = 0;
  for (const [tag, v] of assets) {
    if (EXTERNAL.test(v)) { ext++; F.push(`[${label}] 외부 자산 발견 (${tag}): ${v}`); }
  }

  return { failures: F, counts: { sunhwan, sicha, yoonjae, ext } };
}

// ---------- 실제 파일 계약 검사 ----------
let baseHtml = null; // 네거티브 자가검증의 기준 원본(정상 통과해야 하는 실제 문서)
for (const relFile of ['index.html', 'web/index.html']) {
  const file = path.join(ROOT, relFile);
  if (!fs.existsSync(file)) { fail(`${relFile} 없음`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (relFile === 'index.html') baseHtml = html;

  const { failures: F, counts: c } = checkHtml(relFile, html);
  F.forEach(fail);
  pass(`${relFile}: 딥링크(순환 ${c.sunhwan}·시차 ${c.sicha}·수지 ${c.yoonjae})·외부자산 ${c.ext}건`);
}

// ---------- 네거티브 자가검증: 체커가 위반을 실제로 잡는가 ----------
// 기준 원본이 우선 "깨끗하게" 통과해야 한다(항상 실패하는 무력 체커가 아님을 보장).
if (baseHtml) {
  const clean = checkHtml('«정상 원본»', baseHtml);
  if (clean.failures.length !== 0) {
    fail(`자가검증(정상 통제) 실패: 실제 index.html 이 계약 위반을 냄 → ${clean.failures.join(' | ')}`);
  } else {
    pass('자가검증 정상 통제: 실제 index.html 무위반 통과');
  }

  // 위반을 넣으면 반드시 검출되어야 한다.
  const negatives = [
    // 링크 삭제 — href 속성 통째 제거 → 정확문자열 부재 + 개수 하한 위반
    ['링크 삭제(순환 딥링크 제거)',
      baseHtml.replace('href="https://sunhwan.pages.dev/#/ch2"', ''),
      /필수 딥링크 누락|순환 딥링크 0개/],
    // 형식 오염 — 순환에서 '#/' 제거
    ['형식 오염(순환 #/ → #)',
      baseHtml.replace('https://sunhwan.pages.dev/#/ch2', 'https://sunhwan.pages.dev#ch2'),
      /순환 딥링크는 '#\/'|필수 딥링크 누락/],
    // 형식 오염 — 시차에 '#/' 삽입(금지)
    ['형식 오염(시차 # → #/)',
      baseHtml.replace('https://sicha.pages.dev#ch5', 'https://sicha.pages.dev/#/ch5'),
      /시차 딥링크는 '#'|필수 딥링크 누락/],
    // 형식 오염 — 수지에서 '#/' 제거
    ['형식 오염(수지 #/ → #)',
      baseHtml.replace('https://yoonjae.pages.dev/#/ch3', 'https://yoonjae.pages.dev#ch3'),
      /수지 딥링크는 '#\/'|필수 딥링크 누락/],
    // 오염 — 외부 스크립트 주입
    ['외부 자산 오염(script[src])',
      baseHtml.replace('</head>', '<script src="https://cdn.example.com/x.js"></script>\n</head>'),
      /외부 자산 발견 \(script/],
    // 오염 — 외부 이미지 주입
    ['외부 자산 오염(img[src])',
      baseHtml.replace('</main>', '<img src="https://evil.example.com/x.png" alt="">\n</main>'),
      /외부 자산 발견 \(img/],
    // 오염 — 외부 스타일시트 주입
    ['외부 자산 오염(link[stylesheet])',
      baseHtml.replace('</head>', '<link rel="stylesheet" href="https://evil.example.com/x.css">\n</head>'),
      /외부 자산 발견 \(link/],
  ];

  for (const [name, mutated, mustMatch] of negatives) {
    if (mutated === baseHtml) { fail(`자가검증 준비 실패: '${name}' 변형이 원본과 동일(치환 대상 부재)`); continue; }
    const { failures: F } = checkHtml('«fixture»', mutated);
    if (F.length === 0) {
      fail(`자가검증 실패: '${name}' — 위반을 검출하지 못함(체커 무력화 회귀)`);
    } else if (mustMatch && !F.some((f) => mustMatch.test(f))) {
      fail(`자가검증 실패: '${name}' — 검출 사유가 예상과 다름 → ${F.join(' | ')}`);
    } else {
      pass(`네거티브 검출 OK: '${name}' → ${F.length}건`);
    }
  }
} else {
  fail('네거티브 자가검증 불가: 기준 index.html 을 읽지 못함');
}

// ---------- og.png 존재·치수 (파이썬 struct 로 PNG IHDR 파싱) ----------
const PY = [
  'import struct,sys',
  'f=open(sys.argv[1],"rb")',
  'assert f.read(8)==b"\\x89PNG\\r\\n\\x1a\\n","PNG 시그니처 아님"',
  'f.read(4)',
  'assert f.read(4)==b"IHDR","IHDR 청크 아님"',
  'w,h=struct.unpack(">II",f.read(8))',
  'print(w,h)',
].join('\n');

function pngSize(p) {
  const out = execFileSync('python3', ['-c', PY, p], { encoding: 'utf8' }).trim();
  const [w, h] = out.split(/\s+/).map(Number);
  return { w, h };
}

for (const relFile of ['og.png', 'web/og.png']) {
  const p = path.join(ROOT, relFile);
  if (!fs.existsSync(p)) { fail(`${relFile} 없음`); continue; }
  try {
    const { w, h } = pngSize(p);
    if (w !== 1200 || h !== 630) fail(`${relFile} 치수 ${w}×${h} — 1200×630 이어야 함`);
    else pass(`${relFile}: PNG 1200×630 확인`);
  } catch (e) { fail(`${relFile} PNG 파싱 실패: ${e.message}`); }
}

// ---------- 판정 ----------
if (failures.length) {
  console.error('\n✗ 링크 계약 CI 실패:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('\n✓ 링크 계약 CI 통과');
