(() => {
  const ORIGIN = { lat: 30.0205, lng: 31.4850 };
  const state = {
    places: [],
    meta: null,
    subs: { waffarha: true, xclusives: false, waffarx: false },
    filter: 'all',
    category: 'الكل',
    view: 'list',
    map: null,
    markers: [],
    selectedId: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const listEl = $('#list');
  const statsEl = $('#stats');
  const sheet = $('#sheet');
  const sheetBody = $('#sheetBody');
  const mapWrap = $('#mapWrap');
  const btnView = $('#btnView');

  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function fmtDist(km) {
    if (km == null || Number.isNaN(km)) return '—';
    if (km < 1) return `${Math.round(km * 1000)} م`;
    return `${km.toFixed(1)} كم`;
  }

  function hasProgram(p, key) {
    return p[key] === true;
  }

  function matchesMine(p) {
    if (state.subs.waffarha && hasProgram(p, 'waffarha')) return true;
    if (state.subs.xclusives && hasProgram(p, 'xclusives')) return true;
    if (state.subs.waffarx && hasProgram(p, 'waffarx')) return true;
    return false;
  }

  function shortOffer(p) {
    if (state.subs.waffarha && p.waffarhaOffer) return p.waffarhaOffer;
    if (state.subs.waffarx && p.waffarxOffer) return p.waffarxOffer;
    if (state.subs.xclusives && p.xclusivesOffer) return p.xclusivesOffer;
    if (p.waffarhaOffer) return p.waffarhaOffer;
    if (p.waffarxOffer) return p.waffarxOffer;
    if (p.xclusivesOffer) return p.xclusivesOffer;
    return '';
  }

  function filtered() {
    return state.places
      .map((p) => {
        const dist =
          p.lat != null && p.lng != null
            ? haversineKm(ORIGIN, { lat: p.lat, lng: p.lng })
            : null;
        return { ...p, _dist: dist };
      })
      .filter((p) => {
        if (state.category !== 'الكل' && p.categoryChip !== state.category) return false;
        if (state.filter === 'all') return true;
        if (state.filter === 'mine') return matchesMine(p);
        if (state.filter === 'waffarha') return hasProgram(p, 'waffarha');
        if (state.filter === 'xclusives') return hasProgram(p, 'xclusives');
        if (state.filter === 'waffarx') return hasProgram(p, 'waffarx');
        return true;
      })
      .sort((a, b) => {
        if (a._dist == null && b._dist == null) return a.name.localeCompare(b.name, 'ar');
        if (a._dist == null) return 1;
        if (b._dist == null) return -1;
        return a._dist - b._dist;
      });
  }

  function badgesHtml(p) {
    const bits = [];
    if (hasProgram(p, 'waffarha')) bits.push('<span class="badge waffarha">وفرها</span>');
    if (hasProgram(p, 'xclusives')) bits.push('<span class="badge xclusives">Xclusives</span>');
    if (hasProgram(p, 'waffarx')) bits.push('<span class="badge waffarx">WaffarX</span>');
    if (!bits.length) bits.push('<span class="badge none">مفيش خصم معروف</span>');
    return bits.join('');
  }

  function renderList() {
    const rows = filtered();
    const mineCount = state.places.filter(matchesMine).length;
    statsEl.textContent = `${rows.length} مكان · خصوماتي حسب الاشتراك: ${mineCount} · مرتّبين بالمسافة من وسط التجمع`;

    if (!rows.length) {
      listEl.innerHTML = '<div class="empty">مفيش أماكن مطابقة للفلتر ده. جرّب تغيّر الاشتراكات أو التصنيف.</div>';
      updateMap([]);
      return;
    }

    listEl.innerHTML = rows
      .map((p) => {
        const offer = shortOffer(p);
        const offerHtml = offer
          ? `<div class="offer">${escapeHtml(truncate(offer, 110))}</div>`
          : '';
        return `
        <article class="place-card" role="listitem" data-id="${escapeAttr(p.id)}" tabindex="0">
          <div class="row">
            <div>
              <h3>${escapeHtml(p.name)}</h3>
              <div class="meta">
                <span>${escapeHtml(p.categoryChip || p.category)}</span>
                <span>${escapeHtml(p.area || '')}</span>
              </div>
            </div>
            <div class="dist">${fmtDist(p._dist)}</div>
          </div>
          <div class="badges">${badgesHtml(p)}</div>
          ${offerHtml}
        </article>`;
      })
      .join('');

    listEl.querySelectorAll('.place-card').forEach((el) => {
      el.addEventListener('click', () => openSheet(el.dataset.id));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openSheet(el.dataset.id);
        }
      });
    });

    updateMap(rows);
  }

  function truncate(s, n) {
    const t = (s || '').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function openSheet(id) {
    const p = state.places.find((x) => x.id === id);
    if (!p) return;
    state.selectedId = id;
    const dist = p.lat != null ? haversineKm(ORIGIN, { lat: p.lat, lng: p.lng }) : null;
    const maps =
      p.mapsUrl ||
      (p.lat != null
        ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' التجمع الخامس')}`);
    const phone = (p.phone || '').trim();
    const tel = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';

    const dealRows = [];
    if (hasProgram(p, 'waffarha')) {
      dealRows.push(detail('وفرها', p.waffarhaOffer || 'مشترك (تفاصيل العرض مش متاحة في الشيت)'));
    }
    if (hasProgram(p, 'xclusives')) {
      dealRows.push(
        detail(
          'Xclusives',
          p.xclusivesOffer || 'البراند مذكور في الشبكة (الفرع/النسبة قد تحتاج تأكيد)'
        )
      );
    }
    if (hasProgram(p, 'waffarx')) {
      dealRows.push(detail('WaffarX', p.waffarxOffer || 'كاش باك متاح'));
    }
    if (!dealRows.length) {
      dealRows.push(detail('الخصومات', 'مفيش برنامج معروف في البيانات الحالية'));
    }

    sheetBody.innerHTML = `
      <h2>${escapeHtml(p.name)}</h2>
      <p class="addr">${escapeHtml(p.address || 'العنوان غير مكتمل')} · ${fmtDist(dist)}</p>
      <div class="badges">${badgesHtml(p)}</div>
      <div class="detail-grid">
        ${detail('التصنيف', p.category)}
        ${detail('حالة التحقق', p.verification || '—')}
        ${detail('آخر تحقق', p.verifiedAt || '—')}
        ${phone ? detail('التليفون', phone) : ''}
        ${dealRows.join('')}
        ${p.notes ? detail('ملاحظات', p.notes) : ''}
        ${p.sourceUrl ? detail('المصدر', `<a href="${escapeAttr(p.sourceUrl.split(';')[0].trim())}" target="_blank" rel="noopener">فتح الرابط</a>`) : ''}
        ${detail('دقة الموقع', p.geoSource === 'nominatim' ? 'Nominatim (تقريبي)' : 'تقريبي حسب الحي للديمو')}
      </div>
      <div class="actions">
        <a class="btn primary" href="${escapeAttr(maps)}" target="_blank" rel="noopener">افتح في الخريطة</a>
        ${tel ? `<a class="btn ghost" href="${escapeAttr(tel)}">اتصل</a>` : ''}
        <button type="button" class="btn ghost" id="closeSheetBtn">إغلاق</button>
      </div>
    `;
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    $('#closeSheetBtn')?.addEventListener('click', closeSheet);
  }

  function detail(k, v) {
    return `<div class="detail-item"><div class="k">${escapeHtml(k)}</div><div class="v">${typeof v === 'string' && v.includes('<') ? v : escapeHtml(v)}</div></div>`;
  }

  function closeSheet() {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function ensureMap() {
    if (state.map) return;
    state.map = L.map('map', { zoomControl: false }).setView([ORIGIN.lat, ORIGIN.lng], 13);
    L.control.zoom({ position: 'bottomleft' }).addTo(state.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(state.map);
    L.circleMarker([ORIGIN.lat, ORIGIN.lng], {
      radius: 8,
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(state.map)
      .bindPopup('موقعك الافتراضي (وسط التجمع)');
  }

  function updateMap(rows) {
    if (!state.map) return;
    state.markers.forEach((m) => m.remove());
    state.markers = [];
    const bounds = [[ORIGIN.lat, ORIGIN.lng]];
    rows.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const color = hasProgram(p, 'waffarha')
        ? '#ea580c'
        : hasProgram(p, 'xclusives')
          ? '#6d28d9'
          : hasProgram(p, 'waffarx')
            ? '#be123c'
            : '#64748b';
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 1,
      })
        .addTo(state.map)
        .bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>${fmtDist(p._dist)}`);
      m.on('click', () => openSheet(p.id));
      state.markers.push(m);
      bounds.push([p.lat, p.lng]);
    });
    if (bounds.length > 1) {
      try {
        state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
      } catch (_) {}
    }
  }

  function setView(view) {
    state.view = view;
    if (view === 'map') {
      listEl.classList.add('hidden');
      mapWrap.classList.remove('hidden');
      btnView.textContent = '📋';
      btnView.title = 'عرض القائمة';
      ensureMap();
      setTimeout(() => {
        state.map.invalidateSize();
        updateMap(filtered());
      }, 50);
    } else {
      mapWrap.classList.add('hidden');
      listEl.classList.remove('hidden');
      btnView.textContent = '🗺️';
      btnView.title = 'عرض الخريطة';
    }
  }

  // events
  $('#subsChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sub]');
    if (!btn) return;
    const key = btn.dataset.sub;
    state.subs[key] = !state.subs[key];
    btn.classList.toggle('on', state.subs[key]);
    btn.setAttribute('aria-pressed', String(state.subs[key]));
    renderList();
  });

  $('#dealFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    $('#dealFilters').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === btn));
    renderList();
  });

  $('#catFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.category = btn.dataset.cat;
    $('#catFilters').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === btn));
    renderList();
  });

  btnView.addEventListener('click', () => setView(state.view === 'list' ? 'map' : 'list'));
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  fetch('places.json')
    .then((r) => {
      if (!r.ok) throw new Error('places.json missing');
      return r.json();
    })
    .then((data) => {
      state.meta = data.meta;
      state.places = data.places || [];
      renderList();
    })
    .catch((err) => {
      statsEl.textContent = 'تعذّر تحميل البيانات';
      listEl.innerHTML = `<div class="empty">خطأ: ${escapeHtml(err.message)}</div>`;
    });
})();
