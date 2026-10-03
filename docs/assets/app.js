const dataUrl="data/posts.json";
const txt=(v="")=>String(v);
const fmtDate=v=>{const d=new Date(v+(v&&v.length===10?"T00:00:00+09:00":""));return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric"}).format(d)};
const fmtVerified=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const readingMinutes=p=>Math.max(2,Math.round(([p.summary,p.editorNote,...(p.sections||[]).map(x=>x.body)].join(" ").length)/700));
const sourceDomain=p=>{try{return new URL(p.sources?.[0]?.url||"").hostname.replace(/^www\./,"")}catch{return""}};
const sourcePreview=p=>p.image||(`https://s.wordpress.com/mshots/v1/${encodeURIComponent(p.sources?.[0]?.url||"https://github.com")}?w=1200`);

async function loadPosts(){const r=await fetch(dataUrl,{cache:"no-store"});if(!r.ok)throw new Error("posts load failed");const d=await r.json();return Array.isArray(d)?d:[]}

function media(p,cls="story-media"){
  const wrap=document.createElement("div");wrap.className=cls;
  const img=document.createElement("img");img.src=sourcePreview(p);img.alt=p.imageAlt||p.title;img.loading="lazy";img.decoding="async";
  img.onerror=()=>{wrap.classList.add("media-failed");img.remove();const f=document.createElement("div");f.className="media-fallback";f.innerHTML=`<strong>${txt(p.tags?.[0]||p.category)}</strong><span>${sourceDomain(p)}</span>`;wrap.append(f)};
  wrap.append(img);
  if(p.imageCredit){const c=document.createElement("span");c.className="image-credit";c.textContent=p.imageCredit;wrap.append(c)}
  return wrap;
}

function metaLine(p){
  const m=document.createElement("div");m.className="story-meta";
  m.innerHTML=`<span>${txt(p.category)}</span><span>${fmtDate(p.publishedAt)}</span><span>${readingMinutes(p)}분</span><span>${txt(p.status||"")}</span>`;
  return m;
}

function leadCard(p){
  const host=document.querySelector("#lead-story");host.replaceChildren();
  const a=document.createElement("a");a.className="lead-link";a.href="post.html?slug="+encodeURIComponent(p.slug);
  a.append(media(p,"lead-media"));
  const copy=document.createElement("div");copy.className="lead-copy";
  const label=document.createElement("p");label.className="section-label";label.textContent="LEAD STORY";
  const h=document.createElement("h2");h.textContent=p.title;
  const dek=document.createElement("p");dek.className="lead-dek";dek.textContent=p.summary;
  const note=document.createElement("p");note.className="lead-note";note.textContent=p.editorNote||"";
  copy.append(label,metaLine(p),h,dek,note);
  a.append(copy);host.append(a);
}

function storyCard(p){
  const a=document.createElement("a");a.className="story-card";a.href="post.html?slug="+encodeURIComponent(p.slug);
  a.append(media(p));
  const body=document.createElement("div");body.className="story-card-body";
  body.append(metaLine(p));
  const h=document.createElement("h3");h.textContent=p.title;
  const s=document.createElement("p");s.textContent=p.summary;
  const foot=document.createElement("div");foot.className="card-foot";
  foot.innerHTML=`<span>${sourceDomain(p)}</span><span>읽기 →</span>`;
  body.append(h,s,foot);a.append(body);return a;
}

async function home(){
  const all=await loadPosts();
  if(!all.length)return;
  document.querySelector("#edition-date").textContent=fmtDate(all[0].publishedAt)+" EDITION";
  leadCard(all[0]);
  const rest=all.slice(1),host=document.querySelector("#posts"),q=document.querySelector("#search"),cats=document.querySelector("#categories"),count=document.querySelector("#count");
  let active="전체";
  ["전체",...new Set(all.map(x=>x.category).filter(Boolean))].forEach(name=>{
    const b=document.createElement("button");b.className="category-tab"+(name==="전체"?" active":"");b.textContent=name;
    b.onclick=()=>{active=name;cats.querySelectorAll(".category-tab").forEach(x=>x.classList.toggle("active",x===b));render()};
    cats.append(b);
  });
  function render(){
    const needle=q.value.trim().toLowerCase();
    const rows=rest.filter(p=>(active==="전체"||p.category===active)&&(!needle||[p.title,p.summary,p.editorNote,...(p.tags||[])].join(" ").toLowerCase().includes(needle)));
    host.replaceChildren();count.textContent=`${rows.length} BRIEFINGS`;
    if(!rows.length){const e=document.createElement("div");e.className="empty";e.textContent="조건에 맞는 글이 없어.";host.append(e);return}
    rows.forEach(p=>host.append(storyCard(p)));
  }
  q.oninput=render;render();
}

function relatedCard(p){
  const a=document.createElement("a");a.className="related-card";a.href="post.html?slug="+encodeURIComponent(p.slug);
  a.append(media(p,"related-media"));
  const t=document.createElement("div");t.innerHTML=`<span>${fmtDate(p.publishedAt)} · ${txt(p.category)}</span><strong>${txt(p.title)}</strong>`;a.append(t);return a;
}

async function post(){
  const slug=new URLSearchParams(location.search).get("slug"),host=document.querySelector("#article"),all=await loadPosts(),p=all.find(x=>x.slug===slug);
  host.replaceChildren();
  const back=document.createElement("a");back.className="back";back.href="./";back.textContent="← RADAR";
  host.append(back);
  if(!p){const h=document.createElement("h1");h.textContent="글을 찾을 수 없어.";host.append(h);return}
  document.title=p.title+" · BlueBWorks AI Radar";

  const head=document.createElement("header");head.className="article-head";
  const eyebrow=document.createElement("div");eyebrow.className="article-kicker";eyebrow.innerHTML=`<span>${txt(p.category)}</span><span>${txt(p.status||"")}</span>`;
  const h=document.createElement("h1");h.textContent=p.title;
  const dek=document.createElement("p");dek.className="article-dek";dek.textContent=p.summary;
  const meta=document.createElement("div");meta.className="article-meta";
  meta.innerHTML=`<span>발표 ${fmtDate(p.publishedAt)}</span><span>${readingMinutes(p)}분 읽기</span><span>확인 ${fmtVerified(p.verifiedAt)}</span>`;
  head.append(eyebrow,h,dek,meta);host.append(head);
  host.append(media(p,"article-hero"));

  if(p.keyPoints?.length){
    const box=document.createElement("section");box.className="key-points";
    box.innerHTML="<div class='key-label'>핵심만 먼저</div>";
    const ul=document.createElement("ul");p.keyPoints.forEach(k=>{const li=document.createElement("li");li.textContent=k;ul.append(li)});box.append(ul);host.append(box);
  }
  if(p.editorNote){
    const n=document.createElement("section");n.className="editorial-note";
    n.innerHTML="<span>EDITOR'S NOTE</span>";const pp=document.createElement("p");pp.textContent=p.editorNote;n.append(pp);host.append(n);
  }

  const body=document.createElement("div");body.className="article-body";
  (p.sections||[]).forEach(s=>{const sec=document.createElement("section");const sh=document.createElement("h2");sh.textContent=s.title;const bp=document.createElement("p");bp.textContent=s.body;sec.append(sh,bp);body.append(sec)});
  host.append(body);

  const sources=document.createElement("section");sources.className="sources";
  const sh=document.createElement("div");sh.className="source-head";sh.innerHTML="<span>PRIMARY SOURCES</span><strong>확인한 원문</strong>";sources.append(sh);
  (p.sources||[]).forEach((s,i)=>{const a=document.createElement("a");a.className="source-link";a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.innerHTML=`<span>0${i+1}</span><strong>${txt(s.name)}</strong><em>${new URL(s.url).hostname.replace(/^www\./,"")} ↗</em>`;sources.append(a)});
  host.append(sources);

  const related=all.filter(x=>x.slug!==p.slug&&(x.category===p.category||x.tags?.some(t=>p.tags?.includes(t)))).slice(0,3);
  if(related.length){const sec=document.createElement("section");sec.className="related";sec.innerHTML="<div class='related-head'><span>KEEP READING</span><strong>이어 읽기</strong></div>";const grid=document.createElement("div");grid.className="related-grid";related.forEach(x=>grid.append(relatedCard(x)));sec.append(grid);host.append(sec)}

  const bar=document.querySelector("#reading-progress");
  addEventListener("scroll",()=>{const h=document.documentElement.scrollHeight-innerHeight;bar.style.width=(h>0?Math.min(100,scrollY/h*100):0)+"%"},{passive:true});
}

(async()=>{try{window.BLUEB_PAGE==="post"?await post():await home()}catch(e){const t=document.querySelector("#posts")||document.querySelector("#article");if(t){t.textContent="데이터를 불러오지 못했어.";t.classList.add("muted")}console.error(e)}})();