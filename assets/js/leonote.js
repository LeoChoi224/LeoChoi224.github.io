/* 레오노트: 다크 모드, 검색 단축키, 글 페이지 도구(목차·코드 복사·진행 막대), 검색, 터미널 타이핑 */
(function () {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 다크 모드 ---------- */
  const themeBtn = document.getElementById('themeBtn');
  const syncThemeLabel = () => {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-label', root.dataset.theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  };
  syncThemeLabel();
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('ln-theme', next); } catch (e) { /* 저장 못 해도 화면은 바뀐다 */ }
      syncThemeLabel();
    });
  }

  /* ---------- "/" 키로 검색 ---------- */
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    e.preventDefault();
    const input = document.getElementById('searchInput');
    if (input) input.focus();
    else {
      const link = document.querySelector('.nav__search');
      if (link) location.href = link.href;
    }
  });

  /* ---------- 글 페이지 ---------- */
  const prose = document.getElementById('prose');
  if (prose) {
    /* 넓은 표는 가로로 스크롤 */
    prose.querySelectorAll('table').forEach((table) => {
      const box = document.createElement('div');
      box.className = 'table-wrap';
      table.parentNode.insertBefore(box, table);
      box.appendChild(table);
    });

    /* 코드 블록: 언어 이름 + 복사 버튼 */
    prose.querySelectorAll('div.highlighter-rouge').forEach((block) => {
      const match = block.className.match(/language-(\S+)/);
      const lang = match ? match[1] : 'code';
      const bar = document.createElement('div');
      bar.className = 'code-bar';
      const label = document.createElement('span');
      label.textContent = lang === 'plaintext' ? 'text' : lang;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = '복사';
      btn.addEventListener('click', async () => {
        const code = block.querySelector('pre code') || block.querySelector('pre');
        try {
          await navigator.clipboard.writeText(code.textContent);
          btn.textContent = '복사됨';
        } catch (e) {
          btn.textContent = '복사 실패';
        }
        setTimeout(() => { btn.textContent = '복사'; }, 1500);
      });
      bar.append(label, btn);
      block.prepend(bar);
    });

    /* 목차 */
    const tocNav = document.getElementById('toc');
    const heads = Array.from(prose.querySelectorAll('h2, h3'));
    if (tocNav && heads.length) {
      heads.forEach((h, i) => {
        if (!h.id) h.id = 'h-' + (i + 1);
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent;
        a.className = 'lvl-' + h.tagName.charAt(1);
        tocNav.appendChild(a);
      });
    } else if (tocNav) {
      tocNav.closest('.toc').remove();
    }
    const links = tocNav ? Array.from(tocNav.querySelectorAll('a')) : [];

    /* 스크롤: 진행 막대 + 지금 읽는 목차 */
    const progress = document.getElementById('progress');
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
      if (!links.length) return;
      let current = 0;
      heads.forEach((h, i) => { if (h.getBoundingClientRect().top <= 120) current = i; });
      links.forEach((a, i) => a.classList.toggle('is-active', i === current));
    };
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- 검색 페이지 ---------- */
  const input = document.getElementById('searchInput');
  if (input && window.LN_SEARCH_INDEX) {
    const status = document.getElementById('searchStatus');
    const list = document.getElementById('searchResults');
    let docs = null;
    const load = () => docs || (docs = fetch(window.LN_SEARCH_INDEX).then((r) => r.json()).catch(() => []));

    const snippet = (body, term) => {
      const at = body.toLowerCase().indexOf(term);
      if (at < 0) return body.slice(0, 110) + '…';
      const start = Math.max(0, at - 40);
      return (start > 0 ? '…' : '') + body.slice(start, start + 120) + '…';
    };

    const render = async () => {
      const q = input.value.trim().toLowerCase();
      const items = await load();
      list.textContent = '';
      if (!q) {
        status.textContent = '글 ' + items.length + '개에서 찾아요.';
        return;
      }
      const terms = q.split(/\s+/);
      const hits = items.filter((d) => {
        const hay = (d.title + ' ' + d.tags.join(' ') + ' ' + d.categories.join(' ') + ' ' + d.body).toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
      status.textContent = hits.length ? hits.length + '개를 찾았어요.' : '찾는 글이 없어요. 다른 키워드로 검색해 보세요.';
      hits.slice(0, 30).forEach((d) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = d.url;
        const name = document.createElement('span');
        name.className = 'group__name';
        name.textContent = d.title;
        const time = document.createElement('time');
        time.textContent = d.date;
        const snip = document.createElement('p');
        snip.className = 'result__snip';
        snip.textContent = snippet(d.body, terms[0]);
        a.append(name, time, snip);
        li.append(a);
        list.append(li);
      });
    };

    let timer = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    });
    const initial = new URLSearchParams(location.search).get('q');
    if (initial) input.value = initial;
    render();
  }

  /* ---------- 홈 터미널 타이핑: 화면에 보이면 처음부터 재생 ---------- */
  const crt = document.querySelector('.crt');
  const line1 = document.getElementById('ln-line1');
  const line2 = document.getElementById('ln-line2');
  const vee = document.getElementById('ln-vee');
  if (crt && line1 && line2 && !reduced) {
    const first = line1.textContent;
    const second = line2.textContent;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const typeLoop = async () => {
      for (;;) {
        line1.textContent = '';
        line2.textContent = '';
        if (vee) vee.hidden = true;
        await wait(500);
        for (const ch of first) { line1.textContent += ch; await wait(85); }
        await wait(250);
        for (const ch of second) { line2.textContent += ch; await wait(105); }
        if (vee) vee.hidden = false;
        await wait(3000);
      }
    };
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      watcher.disconnect();
      typeLoop();
    }, { threshold: 0.4 });
    watcher.observe(crt);
  }
})();
