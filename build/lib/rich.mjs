import { escapeHtml as esc, pageHref, formatKoreanDate, readingMinutes } from './util.mjs';

export function articleCover(post, base) {
  const meta = [
    `<span>블로그 게시 ${esc(formatKoreanDate(post.publishedAt))}</span>`,
    post.announcedAt ? `<span>소식 발표 ${esc(formatKoreanDate(post.announcedAt))}</span>` : '',
    `<span>${readingMinutes(post)}분 읽기</span>`,
    post.status ? `<span>${esc(post.status)}</span>` : '',
    post.verifiedAt ? `<span>확인 ${esc(formatKoreanDate(post.verifiedAt))}</span>` : '',
  ].filter(Boolean).join('');
  return `<section class="article-cover article-cover-compact" aria-labelledby="article-title">
    <div class="wrap cover-inner">
      <header class="cover-copy">
        <p class="cover-eyebrow"><span>${esc(post.category)}</span><a href="${pageHref(base, 'articles/')}">글 목록</a></p>
        <h1 id="article-title">${esc(post.title)}</h1>
        <p class="cover-dek">${esc(post.summary)}</p>
        <p class="cover-meta">${meta}</p>
      </header>
    </div>
  </section>`;
}

export function articleExtras(section) {
  let html = '';
  for (const figure of section.figures || []) {
    html += `<figure class="article-figure">
      <a href="${esc(figure.src)}" data-zoom-image target="_blank" rel="noopener noreferrer" aria-label="이미지 크게 보기: ${esc(figure.alt)}">
        <img src="${esc(figure.src)}" alt="${esc(figure.alt)}" width="${figure.width}" height="${figure.height}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <span class="figure-zoom-label" aria-hidden="true">확대해서 보기 ↗</span>
      </a>
      <figcaption><span>${esc(figure.caption || figure.alt)}</span><a href="${esc(figure.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(figure.credit)} · 원문</a></figcaption>
    </figure>`;
  }
  if (section.video) {
    const video = section.video;
    html += `<figure class="article-video">
      <video controls playsinline preload="none"${video.poster ? ` poster="${esc(video.poster)}"` : ''} aria-label="${esc(video.caption)}">
        <source src="${esc(video.src)}" type="video/mp4">
        <a href="${esc(video.src)}">공식 영상 파일 열기</a>
      </video>
      <figcaption><span>${esc(video.caption)}</span><a href="${esc(video.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(video.credit)} · 원문과 전체 데모</a></figcaption>
    </figure>`;
  }
  if (section.table) {
    html += `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(section.title || '비교표')}"><table><thead><tr>${section.table.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (section.table.caption) html += `<p class="table-caption">${esc(section.table.caption)}</p>`;
  }
  if (section.diagram === 'transcription-flow') {
    html += `<figure class="flow-figure"><figcaption>실시간 자막이 화면에 남기까지</figcaption><ol class="flow-steps"><li><span>01</span><strong>마이크 입력</strong><small>음성을 연속 전송</small></li><li><span>02</span><strong>임시 자막</strong><small>새 결과로 교체</small></li><li><span>03</span><strong>확정 자막</strong><small>최종 구간만 보관</small></li></ol><p>동작을 설명하기 위한 구성도입니다. 실제 API 응답 화면은 아닙니다.</p></figure>`;
  }
  if (section.code) {
    html += `<figure class="code-example"><figcaption>${esc(section.code.language)} · ${esc(section.code.caption || '문서 기반 구성 예시')}</figcaption><pre tabindex="0"><code>${esc(section.code.text)}</code></pre></figure>`;
  }
  if (section.links?.length) {
    html += `<div class="section-links">${section.links.map(link => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)} <span aria-hidden="true">↗</span></a>`).join('')}</div>`;
  }
  return html;
}
