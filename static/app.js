const $ = s => document.querySelector(s), P = ['#365b7d', '#27805b', '#71879a', '#a86e1e', '#506b82', '#8a9baa', '#426b5b', '#5b7182'];
const F = { n: v => Math.round(v).toLocaleString('en-US'), m: v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(0),
  p: v => `${v.toFixed(2)}%`, s: v => `${v.toFixed(1)}s`, r: v => F.m(v), d: v => v.toFixed(2), pos: v => v.toFixed(2) };
const LBL = { traffic_source: 'Traffic Source', keyword: 'Keyword', device: 'Device', user_type: 'User Type', landing_page: 'Landing Page', country: 'Country', exit_page: 'Exit Page', month: 'Month' };
Chart.defaults.font.family = '"DM Sans", Inter, system-ui, sans-serif'; Chart.defaults.font.size = 11; Chart.defaults.color = '#68748c'; Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 18; Chart.defaults.plugins.legend.labels.boxWidth = 9;
Chart.defaults.animation.duration = 650; Chart.defaults.plugins.tooltip.backgroundColor = '#202a49'; Chart.defaults.plugins.tooltip.titleFont = { weight: '700' }; Chart.defaults.plugins.tooltip.bodyFont = { weight: '500' }; Chart.defaults.plugins.tooltip.padding = 12; Chart.defaults.plugins.tooltip.cornerRadius = 9;
const charts = {}; let D = null, active = 'home';
const sorted = (rows, k) => [...rows].sort((a, b) => b[k] - a[k]);
const topBy = (rows, key, ascending = false) => [...rows].sort((a, b) => ascending ? a[key] - b[key] : b[key] - a[key])[0];
const cap = s => String(s).replace(/\b\w/g, c => c.toUpperCase());
const displayDimension = (dim, value) => dim === 'month'
  ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
  : cap(value);
const SOURCE_COLORS = { 'direct': '#365b7d', 'email': '#71879a', 'organic search': '#27805b', 'paid search': '#a86e1e', 'referral': '#506b82', 'social media': '#8a9baa' };
const CATEGORY_COLORS = {
  traffic_source: SOURCE_COLORS,
  device: { desktop: '#365b7d', mobile: '#27805b', tablet: '#71879a' },
  user_type: { new: '#365b7d', returning: '#71879a' },
  country: { india: '#365b7d', usa: '#27805b', uk: '#71879a', canada: '#506b82', australia: '#8a9baa', germany: '#a86e1e', uae: '#426b5b', singapore: '#9aabb8' }
};
const dimensionColor = (dim, value, index) => CATEGORY_COLORS[dim]?.[String(value).toLowerCase()] || P[index % P.length];
const precise = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const setError = message => {
  const box = $(active === 'home' ? '#app-error' : '#dashboard-error');
  box.textContent = message;
  box.hidden = false;
};
const clearErrors = () => { $('#app-error').hidden = true; $('#dashboard-error').hidden = true; };

// ---- chart builders ----------------------------------------------------------------------------
const ds = (rows, dim, defs, type = 'bar') => {
  const horizontal = type === 'bar' && defs.length === 1;
  const mixed = defs.some(def => def[5] === 'y1');
  const valueFormatter = (value, index) => (defs[index]?.[2] || F.n)(value);
  const tooltipFormatter = (value, index) => {
    const label = defs[index]?.[1].toLowerCase() || '';
    if (label.includes('revenue')) return precise(value);
    if (['sessions', 'clicks', 'impressions', 'exits'].some(metric => label.includes(metric))) return F.n(value);
    return valueFormatter(value, index);
  };
  const datasets = defs.map(([key, label, , color, datasetType, axis], index) => ({
    label,
    data: rows.map(row => row[key]),
    type: datasetType,
    yAxisID: axis || 'y',
    backgroundColor: color || (datasetType === 'line' ? P[index] + '22' : P[index]),
    borderColor: color || P[index],
    borderRadius: 6,
    borderWidth: datasetType === 'line' ? 2.5 : 0,
    order: datasetType === 'line' ? 0 : 1,
    tension: .32,
    pointRadius: datasetType === 'line' ? 3.5 : 0,
    pointHoverRadius: datasetType === 'line' ? 5 : 0,
    pointBackgroundColor: color || P[index],
    fill: false
  }));
  const valueScale = {
    type: 'linear',
    beginAtZero: true,
    grid: { color: '#edf0f5', drawTicks: false },
    border: { display: false },
    ticks: { maxTicksLimit: 6, padding: 8, callback: value => valueFormatter(value, 0) },
    title: { display: true, text: defs[0][1], color: '#707b92', font: { size: 10, weight: '600' } }
  };
  const categoryScale = {
    type: 'category',
    grid: { display: false },
    border: { display: false },
    ticks: { padding: 7, autoSkip: !horizontal, maxRotation: 0, minRotation: 0 }
  };
  const valueScale1 = mixed ? {
    type: 'linear',
    position: 'right',
    beginAtZero: true,
    grid: { drawOnChartArea: false },
    border: { display: false },
    ticks: { maxTicksLimit: 6, padding: 8, callback: value => valueFormatter(value, defs.findIndex(def => def[5] === 'y1')) },
    title: { display: true, text: defs.find(def => def[5] === 'y1')[1], color: '#707b92', font: { size: 10, weight: '600' } }
  } : undefined;
  return {
    type,
    data: { labels: rows.map(row => displayDimension(dim, row[dim])), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: horizontal ? 'nearest' : 'index', intersect: false, axis: horizontal ? 'y' : 'x' },
      layout: { padding: { left: horizontal ? 4 : 0, right: mixed && !horizontal ? 2 : 8, top: 4, bottom: 0 } },
      plugins: {
        legend: { display: defs.length > 1, position: 'bottom' },
        tooltip: {
          mode: horizontal ? 'nearest' : 'index',
          intersect: false,
          callbacks: {
            title: items => {
              const row = rows[items[0]?.dataIndex];
              return row ? displayDimension(dim, row[dim]) : '';
            },
            label: item => ` ${item.dataset.label}: ${tooltipFormatter(item.raw, item.datasetIndex)}`
          }
        }
      },
      scales: horizontal
        ? { x: { ...valueScale, title: { ...valueScale.title, display: false } }, y: categoryScale }
        : { x: categoryScale, y: { ...valueScale, title: { display: false } }, ...(valueScale1 ? { y1: valueScale1 } : {}) }
    }
  };
};
const hbar = (rows, dim, k, label, fmt) => { const c = ds(rows, dim, [[k, label, fmt]]); c.options.indexAxis = 'y';
  c.options.scales.x.ticks.callback = v => fmt(v);
  c.options.plugins.legend = { display: false }; c.data.datasets[0].backgroundColor = rows.map((row, i) => dimensionColor(dim, row[dim], i)); return c; };
const donut = (rows, dim, key) => {
  const total = rows.reduce((sum, row) => sum + row[key], 0);
  return {
    type: 'doughnut',
    data: { labels: rows.map(row => displayDimension(dim, row[dim])), datasets: [{ data: rows.map(row => row[key]), backgroundColor: rows.map((row, i) => dimensionColor(dim, row[dim], i)), borderWidth: 3, borderColor: '#fff', hoverOffset: 7 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: items => items[0]?.label || '',
            label: item => ` ${F.n(item.raw)} ${key.replaceAll('_', ' ')}`,
            afterLabel: item => `Share of total: ${total ? (100 * item.raw / total).toFixed(1) : '0.0'}%`
          }
        }
      }
    }
  };
};

function table(rows, dim, cols) {
  const maxima = cols.map(([key]) => Math.max(...rows.map(row => Number(row[key]) || 0), 1e-9));
  return `<div class="scroll"><table><tr><th>${LBL[dim]}</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr>` + rows.map(row => `<tr><td>${cap(row[dim])}</td>` +
    cols.map(([key, , format], index) => {
      const value = Number(row[key]) || 0;
      const fill = Math.max(0, Math.min(100, 100 * value / maxima[index])).toFixed(0);
      return `<td style="background:linear-gradient(90deg,#eaf0f5 ${fill}%,#fff ${fill}%)">${format(value)}</td>`;
    }).join('') + '</tr>').join('') + '</table></div>';
}
function heat(rows, rowK, colK, val) {
  const rs = [...new Set(rows.map(r => r[rowK]))], cs = [...new Set(rows.map(r => r[colK]))], g = {}; rows.forEach(r => g[r[rowK] + '|' + r[colK]] = r[val]);
  const v = rows.map(r => r[val]), lo = Math.min(...v), hi = Math.max(...v), heatColors = ['#edf2f6', '#d2dee8', '#a9bfd0', '#7597b1', '#365b7d'];
  return `<div class="scroll"><table class="heat"><tr><th>Source ↓</th>${cs.map(c => `<th style="text-align:center">${c}</th>`).join('')}</tr>` + rs.map(r => `<tr><td>${r}</td>` + cs.map(c => {
    const x = g[r + '|' + c], t = hi === lo ? .5 : (x - lo) / (hi - lo), shade = heatColors[Math.round(t * (heatColors.length - 1))]; return `<td style="background:${shade};color:#283651">${x?.toFixed(2) ?? '–'}%</td>`; }).join('') + '</tr>').join('') + '</table></div>';
}
const insights = d => {
  const k = d.kpis, S = d.source, top = (a, key) => sorted(a, key)[0], pct = (a, key) => 100 * top(a, key)[key] / a.reduce((t, r) => t + r[key], 0);
  const ts = top(S, 'sessions'), bc = top(S, 'conv_rate'), er = top(S, 'rev_per_session'), c = top(d.country, 'revenue'), lp = top(d.landing, 'conv_rate'), wd = [...d.device].sort((a, b) => a.sessions - b.sessions)[0], u = top(d.user, 'sessions');
  const keyword = top(d.keyword, 'ctr');
  return [`<b>${ts.traffic_source}</b> drives the most traffic (${F.n(ts.sessions)} sessions) and ${F.r(ts.revenue)} revenue, but <b>${bc.traffic_source}</b> converts best at ${F.p(bc.conv_rate)}.`,
    `<b>${er.traffic_source}</b> earns the highest revenue per session (${F.d(er.rev_per_session)}) – efficiency matters as much as size.`,
    `<b>${c.country}</b> is the #1 market with ${pct(d.country, 'revenue').toFixed(1)}% of revenue; ${top(d.country, 'conv_rate').country} converts best (${F.p(top(d.country, 'conv_rate').conv_rate)}).`,
    `<b>${u.user_type}</b> users make up ${pct(d.user, 'sessions').toFixed(1)}% of sessions; <b>${wd.device}</b> is the weakest device (${F.n(wd.sessions)} sessions) – a UX review candidate.`,
    `<b>${F.p(k.bounce_rate)}</b> of sessions bounce – the largest engagement gap. <b>${top(d.landing, 'bounce_rate').landing_page}</b> bounces most (${F.p(top(d.landing, 'bounce_rate').bounce_rate)}).`,
    `<b>${lp.landing_page}</b> is the best converting landing page (${F.p(lp.conv_rate)}); ${keyword ? `<b>${keyword.keyword}</b> has the strongest keyword CTR.` : 'No keyword data is available for this filter selection.'}`];
};
const dashboardInsightItems = {
    traffic: d => {
      const volume = topBy(d.source, 'sessions'), conversion = topBy(d.source, 'conv_rate'), efficiency = topBy(d.source, 'rev_per_session');
      return [`<b>${volume.traffic_source}</b> brings the most visits (${F.n(volume.sessions)} sessions).`,
        `<b>${conversion.traffic_source}</b> leads conversion at ${F.p(conversion.conv_rate)}.`,
        `<b>${efficiency.traffic_source}</b> leads revenue per session (${F.d(efficiency.rev_per_session)}).`];
    },
    seo: d => {
      if (!d.keyword.length) return ['No keyword data is available for this filter selection.'];
      const visibility = topBy(d.keyword, 'impressions'), ctr = topBy(d.keyword, 'ctr'), position = topBy(d.keyword, 'weighted_position', true);
      return [`<b>${visibility.keyword}</b> has the most visibility (${F.n(visibility.impressions)} impressions).`,
        `<b>${ctr.keyword}</b> earns the highest CTR at ${F.p(ctr.ctr)}.`,
        `<b>${position.keyword}</b> ranks best by impression-weighted position (${F.pos(position.weighted_position)}; lower is better).`];
    },
    users: d => {
      const volume = topBy(d.device, 'sessions'), conversion = topBy(d.device, 'conv_rate'), audience = topBy(d.user, 'sessions');
      return [`<b>${volume.device}</b> accounts for the most sessions (${F.n(volume.sessions)}).`,
        `<b>${conversion.device}</b> converts best at ${F.p(conversion.conv_rate)}.`,
        `<b>${audience.user_type}</b> visitors are the larger audience (${F.n(audience.sessions)} sessions).`];
    },
    landing: d => {
      const conversion = topBy(d.landing, 'conv_rate'), bounce = topBy(d.landing, 'bounce_rate'), volume = topBy(d.landing, 'sessions');
      return [`<b>${conversion.landing_page}</b> converts best at ${F.p(conversion.conv_rate)}.`,
        `<b>${bounce.landing_page}</b> has the highest bounce rate (${F.p(bounce.bounce_rate)}); consider reviewing its first-visit experience.`,
        `<b>${volume.landing_page}</b> attracts the most visits (${F.n(volume.sessions)} sessions).`];
    },
    engage: d => {
      const bounce = topBy(d.landing, 'bounce_rate'), duration = topBy(d.device, 'avg_duration'), depth = topBy(d.device, 'avg_pages');
      return [`<b>${bounce.landing_page}</b> has the highest landing-page bounce rate (${F.p(bounce.bounce_rate)}).`,
        `<b>${duration.device}</b> has the longest average session (${F.s(duration.avg_duration)}).`,
        `<b>${depth.device}</b> visitors view the most pages per session (${F.d(depth.avg_pages)}).`];
    },
    geo: d => {
      const revenue = topBy(d.country, 'revenue'), conversion = topBy(d.country, 'conv_rate'), bounce = topBy(d.country, 'bounce_rate', true);
      return [`<b>${revenue.country}</b> contributes the most revenue (${F.r(revenue.revenue)}).`,
        `<b>${conversion.country}</b> has the highest conversion rate (${F.p(conversion.conv_rate)}).`,
        `<b>${bounce.country}</b> has the lowest bounce rate (${F.p(bounce.bounce_rate)}).`];
    },
    conv: d => {
      const device = topBy(d.heat_device, 'conv_rate'), country = topBy(d.heat_country, 'conv_rate');
      return [`<b>${device.traffic_source}</b> × <b>${device.device}</b> is the strongest source/device pair (${F.p(device.conv_rate)}).`,
        `<b>${country.traffic_source}</b> × <b>${country.country}</b> is the strongest source/country pair (${F.p(country.conv_rate)}).`,
        'Use the heatmaps to compare conversion rates across the remaining combinations.'];
    }
};
const dashboardInsights = (key, d) => {
  const items = dashboardInsightItems[key](d);
  return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
};

// ---- dashboard definitions (mirror the 7 Excel dashboards + executive summary) -------------------
const V = {
  overview: ['Executive Summary', [
    ['Sessions & Revenue by Month', 'Monthly traffic volume against revenue', 'w8', d => ds(d.month, 'month', [['sessions', 'Sessions', F.n, '#365b7d'], ['revenue', 'Revenue', F.r, '#27805b', 'line', 'y1']])],
    ['Traffic Share', 'Sessions by source', 'w4', d => donut(d.source, 'traffic_source', 'sessions')],
    ['Revenue by Country', 'Top geographic markets', 'w4', d => hbar(d.country, 'country', 'revenue', 'Revenue', F.r)],
    ['Conversion Rate by Source', 'Which channels convert best', 'w4', d => hbar(sorted(d.source, 'conv_rate'), 'traffic_source', 'conv_rate', 'Conv %', F.p)],
    ['Device Mix', 'Sessions by device', 'w4', d => donut(d.device, 'device', 'sessions')],
    ['Executive Insights', 'Auto-generated from the filtered data', 'w12 insights', d => `<ul>${insights(d).map(t => `<li>${t}</li>`).join('')}</ul>`]]],
  traffic: ['Traffic Source Performance', [
    ['Sessions by Source', 'Volume leaders', '', d => hbar(d.source, 'traffic_source', 'sessions', 'Sessions', F.n)],
    ['Revenue by Source', 'Where the money comes from', '', d => hbar(sorted(d.source, 'revenue'), 'traffic_source', 'revenue', 'Revenue', F.r)],
    ['Conversion Rate vs Revenue / Session', 'Efficiency of each channel', 'w12', d => ds(d.source, 'traffic_source', [['conv_rate', 'Conversion %', F.p, '#27805b'], ['rev_per_session', 'Revenue / session', F.d, '#365b7d', 'line', 'y1']])],
    ['Source Scorecard', '', 'w12', d => table(d.source, 'traffic_source', [['sessions', 'Sessions', F.n], ['revenue', 'Revenue', F.r], ['conv_rate', 'Conv %', F.p], ['rev_per_session', 'Rev/Session', F.d], ['bounce_rate', 'Bounce %', F.p]])],
    ['Traffic Insights', 'Highlights from the current filters', 'w12 insights', d => dashboardInsights('traffic', d)]]],
  seo: ['SEO & Keyword Performance', [
    ['Impressions vs Organic Clicks', 'Keyword visibility and traffic', 'w8', d => ds(d.keyword, 'keyword', [['impressions', 'Impressions', F.m, '#71879a'], ['clicks', 'Clicks', F.m, '#365b7d']])],
    ['CTR by Keyword', 'Click-through rate', 'w4', d => hbar(sorted(d.keyword, 'ctr'), 'keyword', 'ctr', 'CTR', F.p)],
    ['Search Position by Keyword', 'Impression-weighted average position · lower is better', 'w8', d => hbar([...d.keyword].sort((a, b) => a.weighted_position - b.weighted_position), 'keyword', 'weighted_position', 'Weighted Avg Position', F.pos)],
    ['SEO Insights', 'Search opportunities in the current filters', 'w4 insights', d => dashboardInsights('seo', d)],
    ['Keyword Table', 'Search position is weighted by impressions; lower is better', 'w12', d => table(d.keyword, 'keyword', [['impressions', 'Impressions', F.n], ['clicks', 'Clicks', F.n], ['ctr', 'CTR', F.p], ['weighted_position', 'Weighted Avg Pos', F.pos], ['conv_rate', 'Conv %', F.p]])]]],
  users: ['User & Device Performance', [
    ['New vs Returning', 'Share of sessions', 'w4', d => donut(d.user, 'user_type', 'sessions')],
    ['Device Sessions & Revenue', '', 'w8', d => ds(d.device, 'device', [['sessions', 'Sessions', F.n, '#365b7d'], ['revenue', 'Revenue', F.r, '#27805b', 'line', 'y1']])],
    ['Device Scorecard', '', '', d => table(d.device, 'device', [['sessions', 'Sessions', F.n], ['revenue', 'Revenue', F.r], ['conv_rate', 'Conv %', F.p], ['avg_pages', 'Pages', F.d]])],
    ['User Type Scorecard', '', '', d => table(d.user, 'user_type', [['sessions', 'Sessions', F.n], ['revenue', 'Revenue', F.r], ['conv_rate', 'Conv %', F.p], ['avg_duration', 'Duration', F.s]])],
    ['Audience Insights', 'Highlights from the current filters', 'w12 insights', d => dashboardInsights('users', d)]]],
  landing: ['Landing Page Performance', [
    ['Sessions by Landing Page', '', '', d => hbar(d.landing, 'landing_page', 'sessions', 'Sessions', F.n)],
    ['Conversion Rate by Page', '', '', d => hbar(sorted(d.landing, 'conv_rate'), 'landing_page', 'conv_rate', 'Conv %', F.p)],
    ['Landing Page Scorecard', '', 'w12', d => table(d.landing, 'landing_page', [['sessions', 'Sessions', F.n], ['revenue', 'Revenue', F.r], ['conv_rate', 'Conv %', F.p], ['avg_duration', 'Duration', F.s], ['bounce_rate', 'Bounce %', F.p]])],
    ['Landing Page Insights', 'Highlights from the current filters', 'w12 insights', d => dashboardInsights('landing', d)]]],
  engage: ['Website Engagement & Bounce Rate', [
    ['Bounce Rate by Landing Page', 'Pages to review first', '', d => hbar(sorted(d.landing, 'bounce_rate'), 'landing_page', 'bounce_rate', 'Bounce %', F.p)],
    ['Bounce Rate by Source', '', '', d => hbar(sorted(d.source, 'bounce_rate'), 'traffic_source', 'bounce_rate', 'Bounce %', F.p)],
    ['Pages & Duration by Device', '', '', d => ds(d.device, 'device', [['avg_pages', 'Pages / session', F.d, '#365b7d'], ['avg_duration', 'Duration (s)', F.s, '#27805b', 'line', 'y1']])],
    ['Top Exit Pages', 'Where visits end', '', d => hbar(d.exit, 'exit_page', 'sessions', 'Exits', F.n)],
    ['Engagement Insights', 'Highlights from the current filters', 'w12 insights', d => dashboardInsights('engage', d)]]],
  geo: ['Geographic Performance', [
    ['Sessions & Revenue by Country', '', 'w8', d => ds(d.country, 'country', [['sessions', 'Sessions', F.n, '#365b7d'], ['revenue', 'Revenue', F.r, '#27805b', 'line', 'y1']])],
    ['Conversion Rate by Country', '', 'w4', d => hbar(sorted(d.country, 'conv_rate'), 'country', 'conv_rate', 'Conv %', F.p)],
    ['Country Scorecard', '', 'w12', d => table(d.country, 'country', [['sessions', 'Sessions', F.n], ['revenue', 'Revenue', F.r], ['conv_rate', 'Conv %', F.p], ['avg_duration', 'Duration', F.s], ['bounce_rate', 'Bounce %', F.p]])],
    ['Geographic Insights', 'Highlights from the current filters', 'w12 insights', d => dashboardInsights('geo', d)]]],
  conv: ['Conversion Lab', [
    ['Conversion % · Source × Device', 'Darker = better converting combination', 'w12', d => heat(d.heat_device, 'traffic_source', 'device', 'conv_rate')],
    ['Conversion % · Source × Country', 'Spot the best channel/market pairs', 'w12', d => heat(d.heat_country, 'traffic_source', 'country', 'conv_rate')],
    ['Conversion Insights', 'Highlights from the current filters', 'w12 insights', d => dashboardInsights('conv', d)]]]
};

const HOME_CARDS = [
  ['overview', '00', 'Executive Summary', 'A decision-ready snapshot of sessions, revenue and conversion.', 'hero', '#365b7d'],
  ['traffic', '01', 'Traffic Source Performance', 'Compare channel reach, conversion efficiency and revenue.', 'traffic', '#365b7d'],
  ['seo', '02', 'SEO & Keyword Performance', 'See which searches earn impressions, clicks and visibility.', 'seo', '#365b7d'],
  ['users', '03', 'User & Device Performance', 'Understand new and returning visitors across devices.', 'users', '#365b7d'],
  ['geo', '04', 'Geographic Performance', 'Explore the markets and locations behind results.', 'geo', '#365b7d'],
  ['landing', '05', 'Landing Page Performance', 'Find the pages that attract and convert visitors.', 'landing', '#365b7d'],
  ['engage', '06', 'Website Engagement & Bounce Rate', 'Review session depth, engagement and exit behavior.', 'engage', '#365b7d'],
  ['conv', '07', 'Conversion Lab', 'Compare conversion patterns across channels, devices and markets.', 'conversion', '#365b7d']
];

// ---- rendering -----------------------------------------------------------------------------------
function build() {
  $('#nav').innerHTML = '<button data-k="home">Project Home</button><div class="nav-label">Explore dashboards</div>' +
    Object.entries(V).map(([k, v]) => `<button data-k="${k}">${v[0]}</button>`).join('');
  $('#dashboard-cards').innerHTML = HOME_CARDS.map(([k, n, title, description, art, accent]) =>
    `<button class="dashboard-card" style="--accent:${accent}" type="button" data-dashboard="${k}" aria-label="Open ${title}">
      <svg class="dashboard-card-art" viewBox="0 0 240 180" aria-hidden="true"><use href="img/analytics-art.svg#${art}"></use></svg>
      <span class="dashboard-card-copy"><span class="dashboard-number">${n} / DASHBOARD</span><h3>${title}</h3><p>${description}</p><span class="dashboard-link">Explore dashboard <span aria-hidden="true">↗</span></span></span>
    </button>`).join('');
  $('#views').innerHTML = Object.entries(V).map(([k, [, cards]]) => `<section class="view" id="v_${k}">` + cards.map((c, i) =>
    `<div class="card ${c[2]}"><h3>${c[0]}</h3><p class="d">${c[1]}</p><div id="c_${k}_${i}"></div></div>`).join('') + '</section>').join('');
  $('#nav').onclick = e => {
    const button = e.target.closest('button[data-k]');
    if (button) show(button.dataset.k);
  };
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-dashboard]');
    if (!button) return;
    e.preventDefault();
    show(button.dataset.dashboard);
  });
}
function show(k) {
  if (k === 'home') {
    $('#home').hidden = false;
    $('#dashboard').hidden = true;
  } else if (V[k]) {
    active = k;
    $('#home').hidden = true;
    $('#dashboard').hidden = false;
    $('#title').textContent = V[k][0];
  } else return;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v_' + k));
  if (k !== 'home') render();
}
function render() {
  if (!D || !D.kpis.sessions) { $('#kpis').innerHTML = '<div class="card w12">No sessions match these filters.</div>'; return; }
  const k = D.kpis;
  $('#kpis').innerHTML = [['Total Sessions', F.n(k.sessions)], ['Total Revenue', F.r(k.revenue)], ['Avg Session Duration', F.s(k.avg_duration)], ['Conversion Rate', F.p(k.conv_rate)], ['Bounce Rate', F.p(k.bounce_rate)]]
    .map(([a, b], i) => `<div class="kpi" style="animation-delay:${i * 70}ms"><small>${a}</small><b>${b}</b></div>`).join('');
  V[active][1].forEach((c, i) => {
    const id = `c_${active}_${i}`, out = c[3](D), box = $('#' + id);
    if (typeof out === 'string') { charts[id]?.destroy(); delete charts[id]; box.innerHTML = out; return; }
    if (!box.firstChild) box.innerHTML = `<div class="cv"><canvas></canvas></div>`;
    charts[id]?.destroy(); charts[id] = new Chart(box.querySelector('canvas'), out);
  });
}
const q = () => new URLSearchParams({ date_from: $('#f_from').value, date_to: $('#f_to').value, source: $('#f_source').value, device: $('#f_device').value, user_type: $('#f_user').value, country: $('#f_country').value });
async function load() {
  $('#loader').classList.remove('off');
  let data;
  try {
    const response = await fetch('/api/dashboard?' + q());
    if (!response.ok) throw new Error(`Dashboard data request failed (${response.status})`);
    data = await response.json();
  } catch (e) {
    setError(`Dashboard data could not be loaded: ${e.message}`);
    if (active !== 'home') $('#kpis').textContent = 'The dashboard is temporarily unavailable.';
    $('#loader').classList.add('off');
    return;
  }
  D = data;
  if (D.kpis.sessions) $('#rowcount').textContent = F.n(D.kpis.sessions);
  clearErrors();
  try {
    if (active !== 'home') render();
  } catch (e) {
    setError(`Dashboard charts could not be rendered: ${e.message}`);
    console.error(e);
  } finally { $('#loader').classList.add('off'); }
}
(async function init() {
  build(); show('home');
  try {
    const response = await fetch('/api/meta');
    if (!response.ok) throw new Error(`Analytics metadata request failed (${response.status})`);
    const m = await response.json();
    const opt = (id, label, arr) => $(id).innerHTML = `<option value="">All ${label}</option>` + arr.map(x => `<option>${x}</option>`).join('');
    opt('#f_source', 'sources', m.traffic_source); opt('#f_device', 'devices', m.device); opt('#f_user', 'users', m.user_type); opt('#f_country', 'countries', m.country);
    Object.assign($('#f_from'), { min: m.min_date, max: m.max_date }); Object.assign($('#f_to'), { min: m.min_date, max: m.max_date });
    document.querySelectorAll('#filters input,#filters select').forEach(el => el.onchange = load);
    $('#reset').onclick = () => { document.querySelectorAll('#filters input,#filters select').forEach(el => el.value = ''); load(); };
    await load();
  } catch (e) {
    setError(`Analytics could not be initialized: ${e.message}`);
    $('#loader').classList.add('off');
  }
})();
