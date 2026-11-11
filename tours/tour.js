import { getTour, getTourSages } from '../supabase/tour.js';
import { trackPageView } from '../supabase/supabaseFunctions.js';
import { supabaseClient } from '../supabase/supabaseClient.js';

const TOUR_NAME = 'Major Chumash Commentaries';

// Per-sage descriptive text (biography, names, years), keyed by person.
// Loaded from the `sage` table during init and read by goToSage().
let sageInfo = new Map();

let visibleMarkers = [];
let visibleMarkersPeople = [];
let pauses = [];
let markers = [];
let sages = []

// Load sages / markers
async function loadTour() {
  try {
    const result = await getTourSages({ tour: TOUR_NAME });


    markers = result.data || [];
    sages = result.sageIds


    return result;
  } catch (err) {
    console.error('Failed to load tour sages:', err);
    markers = [];
    sages = [];
    return { data: [], meta: { duration_seconds: '0.0000', count: 0 } };
  }
}

function getYearRange(markers) {
  if (!markers || markers.length === 0) {
    return { min: 0, max: 0 };
  }

  let min = Infinity;
  let max = -Infinity;

  markers.forEach(marker => {
    const from = Number(marker.from);
    const to = Number(marker.to);

    if (!isNaN(from)) min = Math.min(min, from);
    if (!isNaN(to)) max = Math.max(max, to);
  });

  return { min, max };
}

function generateCenturyTicks(min, max) {
  const ticks = [];

  // round min DOWN to nearest 100
  let start = Math.ceil(min / 100) * 100;

  // round max UP to nearest 100
  let end = Math.ceil(max / 100) * 100;

  for (let year = start; year <= end; year += 100) {
    ticks.push(year);
  }

  return ticks;
}

// Load pause points
async function fetchPauses() {
  try {
    const result = await getTour({ tour: TOUR_NAME });


    pauses = (result.data || [])
      .slice()
      .sort((a, b) => Number(a.year) - Number(b.year));


    return result;
  } catch (err) {
    console.error('Failed to fetch pauses:', err);
    pauses = [];
    return { data: [], meta: { duration_seconds: '0.0000', count: 0 } };
  }
}

// Function to display markers filtered by year during animation
function displayMarkersByTimeAnimate(
  markersData,
  visibleMarkers,
  visibleMarkersPeople,
  useDurationSizing = false,
  annotation = false
) {
  const timeValue = Number(document.getElementById('year-slider').noUiSlider.get());

  const currentMarkersData = markersData.filter(
    marker => Number(marker.from) <= timeValue && Number(marker.to) >= timeValue
  );

  currentMarkersData.forEach(marker => {
    marker.fromYear = Number(marker.from) === timeValue;
    marker.toYear = Number(marker.to) === timeValue;
    marker.birthYear = Number(marker.birth) === timeValue;
    marker.passYear = Number(marker.passing) === timeValue;
  });

  displayMarkers(currentMarkersData, visibleMarkers, false, useDurationSizing, annotation);
}

// Initialize the year slider
const yearSlider = document.getElementById('year-slider');



// Popup hover setup
window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

// handleHoverPopup (global.js) places the popup beside the hovered element
// and keeps it on screen, so it no longer follows the cursor.
document.addEventListener('mouseover', handleHoverPopup);

document.addEventListener('mouseout', event => {
  if (event.target.classList.contains('popup-button')) {
    popup.classList.remove('visible');
  }
});

// There is no Play button any more; the page moves only with Previous/Next.
// global.js displayMarkers() still reads playButton.checked to decide whether
// to animate birth/passing markers, so keep a stand-in that is "checked"
// only while the timeline is zipping between stops.
window.playButton = { checked: false };

// ── Timeline motion ──
let zipFrame = null;   // requestAnimationFrame id of the running timeline zip

function sliderYear() {
  return Number(yearSlider.noUiSlider.get());
}

// Stop any zip still running from an earlier click
function cancelMotion() {
  if (zipFrame) cancelAnimationFrame(zipFrame);
  zipFrame = null;
  playButton.checked = false;
}

// Slide the timeline quickly from its current year to `target`, redrawing the
// map markers as each year passes. Longer jumps take a little longer, capped.
function zipToYear(target, onDone) {
  const slider = yearSlider.noUiSlider;
  const from = sliderYear();
  const duration = Math.min(3500, Math.max(1200, Math.abs(target - from) * 15));
  const start = performance.now();
  let lastYear = null;

  playButton.checked = true;

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // fast start, gentle landing
    const year = Math.round(from + (target - from) * eased);

    if (year !== lastYear) {
      slider.set(year);
      displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople, false, true);
      lastYear = year;
    }

    if (t < 1) {
      zipFrame = requestAnimationFrame(frame);
    } else {
      zipFrame = null;
      playButton.checked = false;
      if (onDone) onDone();
    }
  }

  zipFrame = requestAnimationFrame(frame);
  return duration;
}

// ── Previous / Next: step through the tour's timeline events ──
// currentEventIndex is the event on screen. After a chapter card jumps to a
// sage, it sits halfway between two events (k - 0.5), so Next goes to the
// first event at or after that sage and Previous to the one before.
let currentEventIndex = -1;

function nextEventIndex() { return Math.floor(currentEventIndex) + 1; }
function prevEventIndex() { return Math.ceil(currentEventIndex) - 1; }

function updateNavButtons() {
  const usingEvents = pauses.length > 0;
  const total = usingEvents ? pauses.length : sages.length;
  const cur = usingEvents ? currentEventIndex : currentSageIndex;
  const next = usingEvents ? nextEventIndex() : currentSageIndex + 1;
  const prev = usingEvents ? prevEventIndex() : currentSageIndex - 1;

  if (prevButton) prevButton.disabled = prev < 0;
  if (nextButton) {
    nextButton.disabled = false;
    nextButton.textContent = next >= total && cur >= 0
      ? 'Explore The Sages →'
      : 'Next Stop →';
  }
}

function goToEvent(index) {
  if (!pauses.length || !yearSlider.noUiSlider) return;
  cancelMotion();

  currentEventIndex = Math.max(0, Math.min(index, pauses.length - 1));
  const ev = pauses[currentEventIndex];
  const year = Number(ev.year);

  const icon = document.getElementById('icon-space');
  const name = document.getElementById('name-content');
  const copy = document.querySelector('.stop-copy');
  const quote = document.querySelector('.quote-box');

  // Heading: place and year of the event; the text fills in once we arrive
  const place = ev.city?.city ? `${ev.city.city}, ` : '';
  if (icon) icon.textContent = String(currentEventIndex + 1);
  if (name) name.textContent = `${place}${year}`;
  if (copy) {
    copy.innerHTML = '';
    copy.classList.add('event-text'); // larger, more prominent styling
  }
  if (quote) quote.style.display = 'none';
  setActiveChapter(-1);
  updateNavButtons();

  const duration = zipToYear(year, () => {
    if (icon && ev.icon) icon.innerHTML = ev.icon;
    if (copy) copy.innerHTML = ev.text || '';
  });

  // Fly the map alongside the timeline so both arrive together
  if (window.map && ev.city?.latitude != null && ev.city?.longitude != null) {
    window.map.flyTo({
      center: [Number(ev.city.longitude), Number(ev.city.latitude)],
      zoom: ev.zoom ?? 4,
      duration: duration + 600,
      essential: true
    });
  }
}

// Previous / Next: step through the module's sages in order
let currentSageIndex = -1;

// Pick a representative marker (earliest dwelling) for a sage
function sageRepMarker(person) {
  const ms = markers.filter(m => m.person === person);
  if (!ms.length) return null;
  return ms.slice().sort((a, b) => Number(a.from) - Number(b.from))[0];
}

function goToSage(index) {
  if (!sages.length) return;

  currentSageIndex = Math.max(0, Math.min(index, sages.length - 1));
  const person = sages[currentSageIndex];

  cancelMotion();

  const slider = document.getElementById('year-slider');
  const marker = sageRepMarker(person);
  const year = marker ? Number(marker.from) : null;

  if (slider?.noUiSlider && year != null && !isNaN(year)) {
    // Sit between the events either side of this sage (see currentEventIndex)
    currentEventIndex = pauses.filter(p => Number(p.year) < year).length - 0.5;

    zipToYear(year, () => {
      // Label only the sage being discussed; contemporaries stay as plain
      // markers (their names still show in the hover popup).
      document.querySelectorAll('#map .annotation').forEach(a => {
        if (a.textContent.trim() !== person) a.remove();
      });
    });
  }

  // fly the map to the sage's location
  if (window.map && marker && marker.latitude != null && marker.longitude != null) {
    window.map.flyTo({
      center: [Number(marker.longitude), Number(marker.latitude)],
      zoom: 4,
      speed: 0.8
    });
  }

  // update the "Current Stop" panel with this sage's text (shown instantly)
  const icon = document.getElementById('icon-space');
  const name = document.getElementById('name-content');
  const copy = document.querySelector('.stop-copy');
  const quote = document.querySelector('.quote-box');
  const info = sageInfo.get(person);

  if (icon) icon.textContent = String(currentSageIndex + 1);
  if (name) name.textContent = person;
  if (copy) {
    copy.textContent = info?.biography || '';
    copy.classList.remove('event-text');
  }

  // Repurpose the quote box as a caption showing the sage's years of life
  if (quote) {
    const years = info?.birth ? `${info.birth}–${info.passing ?? ''}` : '';
    if (years) {
      quote.textContent = years;
      quote.classList.add('caption');
      quote.style.display = '';
    } else {
      quote.style.display = 'none';
    }
  }

  // highlight the chapter card for the sage being discussed
  setActiveChapter(currentSageIndex);

  updateNavButtons();
}

// Highlight the chapter card that matches the current sage
function setActiveChapter(index) {
  document.querySelectorAll('.chapter-card').forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });
}

// Build one chapter card per sage, in module order, and wire up clicks
function renderChapterCards(sageIds) {
  const container = document.querySelector('.chapter-cards');
  if (!container || !sageIds || sageIds.length === 0) return;

  container.style.setProperty('--chapter-count', sageIds.length);

  // No card starts highlighted; setActiveChapter() marks the current one
  // as soon as the visitor navigates to a stop.
  container.innerHTML = sageIds.map((person, i) => {
    const safe = person.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div class="chapter-card" data-index="${i}">
        <div class="chapter-num">${i + 1}</div>
        <div class="chapter-name">${safe}</div>
        <div class="chapter-flourish">❧</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.chapter-card').forEach(card => {
    card.addEventListener('click', () => goToSage(Number(card.dataset.index)));
  });
}

const prevButton = document.querySelector('.nav-button');
const nextButton = document.getElementById('next-button');

// Disabled until the tour data has loaded
if (prevButton) prevButton.disabled = true;
if (nextButton) nextButton.disabled = true;

// Previous/Next walk the timeline events. If a tour has no events,
// they fall back to stepping through its sages.
if (prevButton) prevButton.addEventListener('click', () => {
  if (pauses.length) goToEvent(prevEventIndex());
  else goToSage(currentSageIndex - 1);
});

// After the last stop the next button opens the sage profiles in course mode,
// stepping through this tour's sages in chronological order. (linkToProfile in
// global.js always sends courseModeActive=false, so build the URL here, the
// same way tour_chabad.html does.)
function exploreSagesAsCourse() {
  const encodedCourse = encodeURIComponent(JSON.stringify(sages));
  const encodedSelected = encodeURIComponent(JSON.stringify({ person: sages[0] }));
  window.location.href =
    `../discover.html?course=${encodedCourse}` +
    `&courseIndex=0` +
    `&selected=${encodedSelected}` +
    `&courseModeActive=true`;
}

if (nextButton) nextButton.addEventListener('click', () => {
  const total = pauses.length || sages.length;
  const next = pauses.length ? nextEventIndex() : currentSageIndex + 1;
  if (total && next >= total) {
    exploreSagesAsCourse();
  } else if (pauses.length) {
    goToEvent(next);
  } else {
    goToSage(next);
  }
});

// Render the module's sages with real portraits from the database
function portraitUrl(picture) {
  const path = picture ? `sages/${picture}` : 'sages/sage';
  const { data } = supabaseClient.storage.from('public_images').getPublicUrl(`${path}.webp`);
  return data?.publicUrl || '';
}

// Load each sage's descriptive text once, so goToSage can show it instantly
async function loadSageInfo(sageIds) {
  if (!sageIds || sageIds.length === 0) return;

  const { data, error } = await supabaseClient
    .from('sage')
    .select('person, name, hebrew_name, biography, birth, passing')
    .in('person', sageIds);

  if (error) {
    console.error('Failed to load sage info:', error);
    return;
  }

  sageInfo = new Map((data || []).map(s => [s.person, s]));
}

async function renderSageStrip(sageIds) {
  const strip = document.querySelector('.sage-strip');
  if (!strip || !sageIds || sageIds.length === 0) return;

  const { data, error } = await supabaseClient
    .from('sage')
    .select('person, picture')
    .in('person', sageIds);

  if (error) {
    console.error('Failed to load sage portraits:', error);
    return;
  }

  const pictureByPerson = new Map((data || []).map(s => [s.person, s.picture]));

  // Balance the portraits into even rows of at most 5 (e.g. 9 sages → 5 + 4)
  const rows = Math.ceil(sageIds.length / 5);
  strip.style.setProperty('--sage-per-row', Math.ceil(sageIds.length / rows));

  strip.innerHTML = sageIds.map(person => {
    const url = portraitUrl(pictureByPerson.get(person));
    const safe = person.replace(/"/g, '&quot;');
    return `
      <div class="sage-mini">
        <div class="sage-portrait">
          <img src="${url}" alt="${safe}" loading="lazy" onerror="this.style.display='none'">
        </div>
        ${person}
      </div>`;
  }).join('');

  // Hovering a portrait shows the sage's biography in the shared popup
  // (handleHoverPopup in global.js reads .popup-button and data-message).
  strip.querySelectorAll('.sage-portrait').forEach((el, i) => {
    const person = sageIds[i];
    const info = sageInfo.get(person);
    const years = info?.birth ? `${info.birth}–${info.passing ?? ''}` : '';
    const bio = info?.biography || 'No biography yet.';

    el.classList.add('popup-button');
    el.style.backgroundColor = '#e9d9b6'; // popup tint; hidden under the portrait
    el.dataset.message =
      `<strong>${escapeHtml(person)}</strong>` +
      (years ? ` <span class="popup-years">(${escapeHtml(years)})</span>` : '') +
      `<div class="popup-bio">${escapeHtml(bio)}</div>`;
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Full page initialization
async function initializeTourPage() {
  try {
    console.log('Initializing tour page...');

    trackPageView(TOUR_NAME);

    const [tourSagesResult, pausesResult] = await Promise.all([
      loadTour(),
      fetchPauses()
    ]);

    await loadSageInfo(sages);

    // Order the module chronologically: by birth year, falling back to the
    // sage's earliest dwelling on the map. Chapter cards, portraits and the
    // Previous/Next Stop buttons all follow this order.
    const sageYear = person => {
      const birth = Number(sageInfo.get(person)?.birth);
      if (!isNaN(birth) && birth !== 0) return birth;
      const marker = sageRepMarker(person);
      const from = marker ? Number(marker.from) : NaN;
      return isNaN(from) ? Infinity : from;
    };
    sages.sort((a, b) => sageYear(a) - sageYear(b));

    renderSageStrip(sages);
    renderChapterCards(sages);

    const { min, max } = getYearRange(markers);

    console.log('Year range:', min, max);

    noUiSlider.create(yearSlider, {
  start: min,
  connect: [true, false],
  range: {
    min: min,
    max: max
  },
  step: 1,
  tooltips: true,
  format: {
    to: function (value) {
      return Math.round(value);
    },
    from: function (value) {
      return Number(value);
    }
  },
  pips: {
    mode: 'values',
    values: generateCenturyTicks(min, max),
    density: 9,
    format: {
      to: function (value) {
        return value.toString();
      }
    }
  }
});

    // The timeline is display-only: it moves via the Previous/Next Stop
    // buttons and the chapter cards. Disabling blocks dragging and keyboard input
    // (CSS pointer-events: none covers clicks; programmatic .set() still works).
    yearSlider.setAttribute('disabled', 'true');

    // Show the markers for the starting year, then enable navigation
    displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople, false, true);
    updateNavButtons();

    console.log('Tour page initialization complete.');
  } catch (err) {
    console.error('Failed during page initialization:', err);
  }
}

document.addEventListener('DOMContentLoaded', initializeTourPage);