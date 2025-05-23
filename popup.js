let allCookies = [];

function groupCookiesByDomain(cookies) {
  const grouped = {};
  for (const c of cookies) {
    if (!grouped[c.domain]) grouped[c.domain] = [];
    grouped[c.domain].push(c);
  }
  return grouped;
}

function countCookieAttributes(cookies, currentUrl) {
  const currentDomain = new URL(currentUrl).hostname;
  let firstPartyCookies = 0;
  let thirdPartyCookies = 0;
  let locationTrackingCookies = 0;
  let secureCookies = 0;
  let httpOnlyCookies = 0;
  let sameSiteCookies = 0;
  let sessionCookies = 0;
  let persistentCookies = 0;

  const locationKeywords = /geo|loc|gps|position|latitude|longitude/i;

  for (const cookie of cookies) {
    const cookieDomain = cookie.domain.replace(/^\./, '');
    if (currentDomain.includes(cookieDomain)) {
      firstPartyCookies++;
    } else {
      thirdPartyCookies++;
    }
    if (locationKeywords.test(cookie.name) || locationKeywords.test(cookie.value) || locationKeywords.test(cookie.domain) || locationKeywords.test(cookie.path)) {
      locationTrackingCookies++;
    }
    if (cookie.secure) secureCookies++;
    if (cookie.httpOnly) httpOnlyCookies++;
    if (cookie.sameSite && cookie.sameSite !== 'no_restriction') sameSiteCookies++;
    if (!cookie.expirationDate) {
      sessionCookies++;
    } else {
      persistentCookies++;
    }
  }

  document.getElementById('firstPartyCookieCount').textContent = firstPartyCookies;
  document.getElementById('thirdPartyCookieCount').textContent = thirdPartyCookies;
  document.getElementById('locationTrackingCookieCount').textContent = locationTrackingCookies;
  document.getElementById('secureCookieCount').textContent = secureCookies;
  document.getElementById('httpOnlyCookieCount').textContent = httpOnlyCookies;
  document.getElementById('sameSiteCookieCount').textContent = sameSiteCookies;
  document.getElementById('sessionCookieCount').textContent = sessionCookies;
  document.getElementById('persistentCookieCount').textContent = persistentCookies;
}

function renderCookies(cookies, currentUrl) {
  const grouped = groupCookiesByDomain(cookies);
  const currentDomain = new URL(currentUrl).hostname;
  const locationKeywords = /geo|loc|gps|position|latitude|longitude/i;

  const cookieListEl = document.getElementById('cookieList');
  if (!cookieListEl) return;

  if (cookies.length === 0) {
    // If no cookies are found, display this message
    cookieListEl.innerHTML = '<p>No cookies found.</p>';
    return;
  }

  let html = '';

  // Loop through each domain and its associated cookies
  Object.entries(grouped).forEach(([domain, items]) => {
    html += `<div class="domain-group">
      <h4 style="font-size: 1.5em;">${domain} <span class="count">(${items.length} cookies)</span></h4>

      <ul class="cookie-list">`;

    // Loop through each cookie and generate HTML for it
    items.forEach(c => {
      const isFirstParty = currentDomain.includes(c.domain.replace(/^\./, ''));
      const isLocation = locationKeywords.test(c.name) || locationKeywords.test(c.value) || locationKeywords.test(c.domain) || locationKeywords.test(c.path);
      const isSession = !c.expirationDate;

      html += `<li class="cookie-item">
        <div class="cookie-name">${c.name}</div>
        <div class="cookie-value">${c.value}</div>
        <div class="cookie-tags">`;

      if (isFirstParty) {
        html += `<span class="tag first-party">1st Party</span>`;
      } else {
        html += `<span class="tag third-party">3rd Party</span>`;
      }

      if (isLocation) {
        html += `<span class="tag location">Location</span>`;
      }

      if (c.secure) {
        html += `<span class="tag secure">Secure</span>`;
      }

      if (c.httpOnly) {
        html += `<span class="tag http-only">HttpOnly</span>`;
      }

      if (c.sameSite && c.sameSite !== 'no_restriction') {
        html += `<span class="tag same-site">SameSite: ${c.sameSite}</span>`;
      }

      if (isSession) {
        html += `<span class="tag session">Session</span>`;
      } else {
        html += `<span class="tag persistent">Persistent</span>`;
      }

      html += `</div></li>`;
    });

    html += `</ul></div>`;
  });

  cookieListEl.innerHTML = html;
}

/*******  976cbdda-cd63-4359-954c-41ccecc2c709  *******/


async function loadCookies() {
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  allCookies = await chrome.cookies.getAll({});
  renderCookies(allCookies, currentTab.url);
  countCookieAttributes(allCookies, currentTab.url);
  const counts = getCategoryCounts(allCookies, currentTab.url);
  renderBubbleMap(counts);
}

function getActiveFilters() {
  // Return filters only if they exist, otherwise default to true or false
  const getChecked = id => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };
  return {
    firstParty: getChecked('filter1stParty'),
    thirdParty: getChecked('filter3rdParty'),
    location: getChecked('filterLocation'),
    secure: getChecked('filterSecure'),
    httpOnly: getChecked('filterHttpOnly'),
    sameSite: getChecked('filterSameSite'),
    session: getChecked('filterSession'),
    persistent: getChecked('filterPersistent'),
  };
}

function filterCookies(cookies, query, currentUrl, filters) {
  const currentDomain = new URL(currentUrl).hostname;
  const locationKeywords = /geo|loc|gps|position|latitude|longitude/i;
  return cookies.filter(c => {
    const isFirstParty = currentDomain.includes(c.domain.replace(/^\./, ''));
    const isThirdParty = !isFirstParty;
    const isLocation = locationKeywords.test(c.name) || locationKeywords.test(c.value) || locationKeywords.test(c.domain) || locationKeywords.test(c.path);
    const isSession = !c.expirationDate;
    const isPersistent = !!c.expirationDate;
    const matchesQuery = c.domain.toLowerCase().includes(query) || c.name.toLowerCase().includes(query);
    return matchesQuery &&
      ((filters.firstParty && isFirstParty) || (filters.thirdParty && isThirdParty)) &&
      (!filters.location || isLocation || !filters.location) &&
      (!filters.secure || c.secure) &&
      (!filters.httpOnly || c.httpOnly) &&
      (!filters.sameSite || (c.sameSite && c.sameSite !== 'no_restriction')) &&
      (!filters.session || isSession) &&
      (!filters.persistent || isPersistent);
  });
}

let bubbleSimulation = null;

function renderBubbleMap(counts) {
  // D3 force simulation for interactive bubbles
  const width = 400, height = 140;
  const svgEl = document.getElementById('bubbleMap');
  if (!svgEl) return;
  svgEl.innerHTML = '';

  // Remove any old D3 svg
  let svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const categories = [
    { key: 'firstParty', label: '1st Party', color: '#4CAF50', count: counts.firstParty },
    { key: 'thirdParty', label: '3rd Party', color: '#F44336', count: counts.thirdParty },
    { key: 'location', label: 'Location', color: '#2196F3', count: counts.location },
    { key: 'secure', label: 'Secure', color: '#FF9800', count: counts.secure },
    { key: 'httpOnly', label: 'HttpOnly', color: '#9C27B0', count: counts.httpOnly },
    { key: 'sameSite', label: 'SameSite', color: '#00BCD4', count: counts.sameSite },
    { key: 'session', label: 'Session', color: '#607D8B', count: counts.session },
    { key: 'persistent', label: 'Persistent', color: '#FFC107', count: counts.persistent },
  ];
  const bubbles = categories.filter(c => c.count > 0);
  if (bubbles.length === 0) return;

  // Calculate radii (min 20, max 60)
  const maxCount = Math.max(...bubbles.map(b => b.count), 1);
  bubbles.forEach(b => {
    b.radius = 20 + 40 * (b.count / maxCount);
  });

  // Assign home positions in a horizontal cluster
  let x = 30, y = height / 2, spacing = 10;
  bubbles.forEach((b, i) => {
    if (i > 0) x += bubbles[i - 1].radius + b.radius + spacing;
    b.homeX = x;
    b.homeY = y;
    b.x = x;
    b.y = y;
  });
  let totalWidth = bubbles.length > 0 ? (bubbles[bubbles.length - 1].homeX + bubbles[bubbles.length - 1].radius) : 0;
  let scale = totalWidth > width ? width / totalWidth : 1;
  if (scale < 1) {
    bubbles.forEach(b => {
      b.homeX *= scale;
      b.radius *= scale;
      b.x = b.homeX;
    });
  }

  // Stop previous simulation if running
  if (bubbleSimulation) bubbleSimulation.stop();

  // D3 force simulation
  bubbleSimulation = d3.forceSimulation(bubbles)
    .force('collide', d3.forceCollide().radius(d => d.radius + 2).strength(1))
    .force('x', d3.forceX().x(d => d.homeX).strength(0.12))
    .force('y', d3.forceY().y(d => d.homeY).strength(0.12))
    .force('center', d3.forceCenter(width/2, height/2).strength(0.01))
    .alphaDecay(0.07);

  // D3 drag behavior
  function dragstarted(event, d) {
    if (!event.active) bubbleSimulation.alphaTarget(0.35).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) bubbleSimulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Draw bubbles as groups
  let groups = svg.selectAll('g.bubble')
    .data(bubbles, d => d.key)
    .join('g')
    .attr('class', 'bubble')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    );

  groups.append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', '#222')
    .attr('stroke-width', 1.5);

  groups.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '.3em')
    .attr('fill', '#fff')
    .attr('font-size', d => Math.max(12, d.radius/2.5))
    .text(d => d.count);

  groups.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.radius + 14)
    .attr('fill', '#333')
    .attr('font-size', '11')
    .text(d => d.label);

  // Update positions on every tick
  bubbleSimulation.on('tick', () => {
    groups.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Clean up simulation if popup closes
  window.addEventListener('unload', () => {
    if (bubbleSimulation) bubbleSimulation.stop();
  });
}


function getCategoryCounts(cookies, currentUrl) {
  const currentDomain = new URL(currentUrl).hostname;
  let firstParty = 0, thirdParty = 0, location = 0, secure = 0, httpOnly = 0, sameSite = 0, session = 0, persistent = 0;
  const locationKeywords = /geo|loc|gps|position|latitude|longitude/i;
  for (const c of cookies) {
    const isFirstParty = currentDomain.includes(c.domain.replace(/^\./, ''));
    if (isFirstParty) firstParty++; else thirdParty++;
    if (locationKeywords.test(c.name) || locationKeywords.test(c.value)
      || locationKeywords.test(c.domain) || locationKeywords.test(c.path)) location++;
    if (c.secure) secure++;
    if (c.httpOnly) httpOnly++;
    if (c.sameSite && c.sameSite !== 'no_restriction') sameSite++;
    if (!c.expirationDate) session++; else persistent++;
  }
  return { firstParty, thirdParty, location, secure, httpOnly, sameSite, session, persistent };
}

function updateDisplay() {
  const searchInput = document.getElementById('search');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    const filters = getActiveFilters();
    const filteredCookies = filterCookies(allCookies, query, tab.url, filters);
    renderCookies(filteredCookies, tab.url);
    const counts = getCategoryCounts(filteredCookies, tab.url);
    renderBubbleMap(counts);
    countCookieAttributes(filteredCookies, tab.url);
  });
}

// Safe event listener setup
function setupEventListeners() {
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', updateDisplay);
  }

  const filterCheckboxes = document.querySelectorAll('#cookieFilters input[type=checkbox]');
  if (filterCheckboxes.length) {
    filterCheckboxes.forEach(cb => cb.addEventListener('change', updateDisplay));
  }
}

// Initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadCookies();
});

// php - template
// Copy
// Edit


loadCookies();
