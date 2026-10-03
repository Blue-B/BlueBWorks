import { escapeHtml as esc, assetHref, pageHref, formatKoreanDate, readingMinutes } from './util.mjs';

export function articleCover(post, base) {
  return `<section class="article-cover" aria-labelledby="article-title">
    <div class="cover-backdrop" aria-hidden="true"></div>
    <div class="wrap cover-inner">
      <header class="cover-copy">
        <p class="cover-eyebrow"><a href="${pageHref(base, 'articles/')}">AI RADAR</a><span>${esc(post.category)}</span></p>
        <h1 id="article-title">${esc(post.title)}</h1>
        <p class="cover-dek">${esc(post.summary)}</p>
        <div class="cover-meta"><span class="author-monogram">B</span><span>BlueBWorks</span><span>${esc(formatKoreanDate(post.publishedAt))}</span><span>${readingMinutes(post)}분 읽기</span></div>
        <p class="cover-status">${esc(post.status)} · 확인 ${esc(formatKoreanDate(post.verifiedAt))}</p>
      </header>
      <div class="hero-scene cover-character" data-parallax>
        <div class="scene-layer scene-mascot" style="--depth:12">
          <button class="mascot-button" type="button" aria-expanded="false" aria-controls="mascot-notes" aria-label="캐릭터를 눌러 사이트 사용 팁 보기">
            <span class="mascot-float"><img class="mascot-img" src="${assetHref(base, 'mascot.webp')}" width="320" height="320" alt="파란 눈과 남색 스카프의 BlueBWorks 로봇 캐릭터"></span>
            <span class="mascot-hint">읽다가 궁금하면, 원문으로.</span>
          </button>
        </div>
      </div>
    </div>
    <p class="scene-credit">배경 NASA / Jessica Meir · 캐릭터 AI 생성 이미지</p>
  </section>`;
}

export function articleExtras(section) {
  let html = '';
  if (section.table) {
    html += `<div class="table-scroll" tabindex="0" role="region" aria-label="모델 비교표"><table><thead><tr>${section.table.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row => `<tr>${row.map((c,i) => i===0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="table-caption">공식 모델 페이지의 표시 단가. 실제 결제 조건은 원문에서 확인하세요.</p>`;
  }
  if (section.diagram === 'transcription-flow') {
    html += `<figure class="flow-figure"><figcaption>실시간 자막이 화면에 남기까지</figcaption><ol class="flow-steps"><li><span>01</span><strong>마이크 입력</strong><small>음성을 연속 전송</small></li><li><span>02</span><strong>임시 자막</strong><small>새 결과로 교체</small></li><li><span>03</span><strong>확정 자막</strong><small>최종 구간만 보관</small></li></ol><p>동작을 설명하기 위한 구성도입니다. 실제 API 응답 화면은 아닙니다.</p></figure>`;
  }
  if (section.code) {
    html += `<figure class="code-example"><figcaption>${esc(section.code.language)} · 문서 기반 연결 예제</figcaption><pre tabindex="0"><code>${esc(section.code.text)}</code></pre></figure>`;
  }
  return html;
}
