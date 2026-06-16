(function () {
  const sections = Array.from(document.querySelectorAll('[data-section]'));
  const sidebar = document.getElementById('sidebar');
  const navToggle = document.querySelector('.nav-toggle');
  const searchInput = document.getElementById('doc-search');
  const sideLinks = Array.from(document.querySelectorAll('.side-nav a'));
  const tocLinksRoot = document.getElementById('toc-links');

  function slugFromHref(link) {
    const href = link.getAttribute('href') || '';
    return href.startsWith('#') ? href.slice(1) : '';
  }

  function closeMobileNav() {
    if (!sidebar || !navToggle) return;
    sidebar.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  function setupCopyButtons() {
    document.querySelectorAll('pre').forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-button';
      button.textContent = 'Copy';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent || '');
          button.textContent = 'Copied';
          window.setTimeout(() => {
            button.textContent = 'Copy';
          }, 1400);
        } catch {
          button.textContent = 'Failed';
          window.setTimeout(() => {
            button.textContent = 'Copy';
          }, 1400);
        }
      });

      pre.insertBefore(button, pre.firstChild);
    });
  }

  function setupMobileNav() {
    if (!navToggle || !sidebar) return;

    navToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    sideLinks.forEach((link) => {
      link.addEventListener('click', closeMobileNav);
    });
  }

  function setupTabs() {
    document.querySelectorAll('[data-tabs]').forEach((root) => {
      const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
      const panels = Array.from(root.querySelectorAll('.tab-panel'));

      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const targetId = tab.getAttribute('data-tab');

          tabs.forEach((item) => {
            item.setAttribute('aria-selected', String(item === tab));
          });

          panels.forEach((panel) => {
            panel.classList.toggle('is-active', panel.id === targetId);
          });
        });
      });
    });
  }

  function setupToc() {
    if (!tocLinksRoot) return;

    const headings = Array.from(document.querySelectorAll('main h2[id], main section[id] > .section-heading h2'));
    const links = [];

    headings.forEach((heading) => {
      const section = heading.closest('section[id]');
      if (!section) return;

      const id = section.id;
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = heading.textContent || id;
      tocLinksRoot.appendChild(link);
      links.push(link);
    });

    const setActive = (id) => {
      sideLinks.forEach((link) => {
        link.classList.toggle('is-active', slugFromHref(link) === id);
      });
      links.forEach((link) => {
        link.classList.toggle('is-active', slugFromHref(link) === id);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    sections.forEach((section) => observer.observe(section));
  }

  function setupSearch() {
    if (!searchInput) return;

    const linkById = new Map(sideLinks.map((link) => [slugFromHref(link), link]));

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();

      sections.forEach((section) => {
        const text = section.textContent ? section.textContent.toLowerCase() : '';
        const matches = !query || text.includes(query);
        section.classList.toggle('is-hidden-by-search', !matches);

        const link = linkById.get(section.id);
        if (link) link.classList.toggle('is-hidden-by-search', !matches);
      });
    });
  }

  setupCopyButtons();
  setupMobileNav();
  setupTabs();
  setupToc();
  setupSearch();
})();
