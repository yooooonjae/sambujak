#!/usr/bin/env node
'use strict';
/*
 * 링크 계약 CI.
 *  - 순환(sunhwan)·수지(yoonjae) 딥링크는 해시 SPA → '#/' 형식이어야 한다.
 *  - 시차(sicha) 딥링크는 일반 앵커 → '#' 형식(‘#/’ 금지)이어야 한다.
 *  - 외부 자산 0: script[src]·img[src]·link[rel=stylesheet] 에 http(s)/프로토콜상대 URL 부재.
 *  - og.png 존재 및 1200×630 (PNG IHDR 헤더를 파이썬 struct 로 파싱).
 * 루트 index.html 과 배포본 web/index.html 을 모두 검사한다.
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

// ---------- HTML 계약 ----------
for (const relFile of ['index.html', 'web/index.html']) {
  const file = path.join(ROOT, relFile);
  if (!fs.existsSync(file)) { fail(`${relFile} 없음`); continue; }
  const html = fs.readFileSync(file, 'utf8');

  // 1) 딥링크 형식 계약
  let sunhwan = 0, yoonjae = 0, sicha = 0;
  for (const h of all(RE_HREF, html)) {
    if (!h.includes('#')) continue; // 프래그먼트 없는 라이브/깃허브 링크는 대상 아님
    if (/sunhwan\.pages\.dev/.test(h)) { sunhwan++; if (!h.includes('#/')) fail(`[${relFile}] 순환 딥링크는 '#/' 형식이어야 함: ${h}`); }
    else if (/yoonjae\.pages\.dev/.test(h)) { yoonjae++; if (!h.includes('#/')) fail(`[${relFile}] 수지 딥링크는 '#/' 형식이어야 함: ${h}`); }
    else if (/sicha\.pages\.dev/.test(h)) {
      sicha++;
      if (h.includes('#/')) fail(`[${relFile}] 시차 딥링크는 '#'(일반 앵커) 형식이어야 함 — '#/' 금지: ${h}`);
      if (!/#[A-Za-z]/.test(h)) fail(`[${relFile}] 시차 딥링크 앵커 형식 이상: ${h}`);
    }
  }

  // 2) 외부 자산 0 (script / img / css)
  const assets = [];
  for (const v of all(RE_SCRIPT, html)) assets.push(['script[src]', v]);
  for (const v of all(RE_IMG, html)) assets.push(['img[src]', v]);
  for (const t of (html.match(RE_LINK_TAG) || [])) {
    const rel = attr(t, 'rel').toLowerCase();
    if (/\b(stylesheet|preload|prefetch|preconnect|dns-prefetch)\b/.test(rel)) assets.push(['link[' + rel + ']', attr(t, 'href')]);
    // rel=canonical / icon 등은 자산이 아니므로 제외
  }
  for (const [tag, v] of assets) {
    if (EXTERNAL.test(v)) fail(`[${relFile}] 외부 자산 발견 (${tag}): ${v}`);
  }

  pass(`${relFile}: 딥링크(순환 ${sunhwan}·시차 ${sicha}·수지 ${yoonjae})·외부자산 ${assets.filter(a => EXTERNAL.test(a[1])).length}건`);
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
