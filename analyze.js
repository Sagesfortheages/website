import { loadAllSagesNames } from './supabase/sagesWithDwellingsNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';

// global.js checks a play button that does not exist on this page.
// Define a stub so displayMarkers never throws if a marker has a birthYear.
window.playButton ??= { checked: false };

let markers = []; // Will be loaded from API
let visibleMarkers = [];
let visibleMarkersPeople = [];
let backgrounds = [];
let expertises = [];
let uniqueNames = [];
let uniqueness = false;
let birthPlace = false;
const legendItems = ['sefarad', 'ashkenaz', 'provence', 'chassidic', 'litvish', 'gaon', 'italian'];
const expertiseItems = ['tanach', 'talmud', 'halacha', 'responsa', 'kabbalah', 'chassidus', 'mussar', 'philosophy',
    'linguistics', 'poetry', 'history'];
const infoText = `This page provides geographic information about our sages through the years.<br><br>Search for a sage in the search bar to see where that sage lived.<br><br>As you type, the map will update to display only sages which match the typed text. A search turns off the other filters.<br><br>Alternatively, filter the sages by background, by clicking on one or more items in the background section. <br><br>You can also filter by the focus of a sage's work by clicking on one or more items in the focus section. <br><br>Lastly, you can filter by time using the slider at the bottom of the screen.<br><br>The background, focus and time filters all work together, while the search operates independently.<br><br>The line at the top of the map shows which filters are on and how many sages match.<br><br>As the map updates, the Sages Found list will update.<br><br>Hover over a marker to see the sage's portrait and a link to their profile.<br><br>To learn more about a sage, click on him/her in the Sages Found list to open their biography page.`;

// "Try This" questions. Each one sets the filters and shows how many sages match.
const PRESETS = {
    'provence-rishonim': {
        label: 'Rishonim of Provence',
        bgs: ['Provence'], exps: [], years: [1100, 1350]
    },
    'ashkenaz-talmudists': {
        label: 'Talmudists of Ashkenaz',
        bgs: ['Ashkenaz'], exps: ['Talmud'], years: [900, 2000]
    },
    'spain-poets': {
        label: 'Poets of the Golden Age of Spain',
        bgs: ['Sefarad'], exps: ['Poetry'], years: [900, 1100]
    },
    'kabbalists-16th': {
        label: 'Kabbalists of the 16th Century',
        bgs: [], exps: ['Kabbalah'], years: [1500, 1599]
    }
};

window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

document.getElementById('info-button').addEventListener('click', function () {
    startTour();
});

// ========== HELPERS ==========

// "sefarad" -> "Sefarad", "reset" -> "Reset"
function cap(word) {
    return word.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
}

function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function yearRange() {
    return document.getElementById('year-slider').noUiSlider.get().map(Number);
}

// Picture names live on the `sage` table (not the map view), keyed by person
let pictureByPerson = new Map();
async function loadPictureNames() {
    const { data, error } = await supabaseClient.from('sage').select('person, picture');
    if (error) {
        console.error('Could not load picture names:', error);
        return;
    }
    pictureByPerson = new Map((data || []).map(s => [s.person, s.picture]));
}

// Same lookup as discover.js: public_images/sages/<picture>.webp, with a generic portrait if none
function portraitUrl(picture) {
    const name = picture ? String(picture).replace(/\.webp$/i, '') : '';
    const path = name ? `sages/${name}` : 'sages/sage';
    const { data } = supabaseClient.storage.from('public_images').getPublicUrl(`${path}.webp`);
    return data.publicUrl;
}

// Same profile link the rest of the site uses (discover.html?selected=...)
function profileUrl(person) {
    const name = typeof person === 'string' ? person : person.person;
    let url = `discover.html?selected=${encodeURIComponent(JSON.stringify(name))}&courseModeActive=false`;
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
        url += '&preview=1';
    }
    return url;
}

function openProfile(person) {
    window.location.href = profileUrl(person);
}

// Clicking a name in "Sages Found" goes straight to the profile
window.linkToProfile = function (person) {
    openProfile(person);
};

// Hover popup content: portrait, place and years, and a link to the full profile
function sageHoverHtml(person, sage) {
    const place = sage ? [sage.city, sage.country].filter(Boolean).join(', ') : '';
    const years = sage ? `${sage.from ?? '?'}–${sage.to ?? '?'}` : '';
    const pictureName = pictureByPerson.get(person) ?? sage?.picture;
    // No picture on file: say so, rather than showing a silhouette. A failed image load does the same.
    const portrait = pictureName
        ? `<img src="${esc(portraitUrl(pictureName))}" alt="Portrait of ${esc(person)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="hover-noportrait" style="display:none">No portrait available</span>`
        : `<span class="hover-noportrait">No portrait available</span>`;
    return `<div class="hover-sage">
        ${portrait}
        <div><strong>${esc(person)}</strong><br>${esc(place)}${place && years ? '<br>' : ''}${esc(years)}</div>
    </div>
    <a class="hover-profile" href="${esc(profileUrl(person))}">Open profile →</a>`;
}

// ========== SEARCH ==========

// Function to handle search input or chart click
function handleInput(event, markers, searchValue = null) {
    if (event.inputType !== undefined) {
        searchValue = event.target.value.trim().toLowerCase();
    } else if (event.type == 'click') {
        searchValue = searchValue.toLowerCase();
    }

    const searchResults = markers.filter(marker =>
        (marker.person || '').toLowerCase().includes(searchValue) ||
        (marker.aka || '').toLowerCase().includes(searchValue) ||
        (marker.name || '').toLowerCase().includes(searchValue)
    );

    const uniqueSearchResults = [...new Map(searchResults.map(item => [item['person'], item])).values()];

    const suggestionsList = document.getElementById('search-results');
    suggestionsList.innerHTML = '';

    uniqueSearchResults.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.person;
        li.addEventListener('click', () => {
            handleCityClick(result.person, markers);
        });
        suggestionsList.appendChild(li);
    });

    if (uniqueSearchResults.length === 0) {
        const closestMatch = findClosestMatch(searchValue, uniqueNames);
        const closestResults = markers.filter(marker =>
            (marker.person || '').toLowerCase().includes(closestMatch) ||
            (marker.aka || '').toLowerCase().includes(closestMatch) ||
            (marker.name || '').toLowerCase().includes(closestMatch)
        );

        const uniqueClosestResults = [...new Map(closestResults.map(item => [item['person'], item])).values()];

        uniqueClosestResults.forEach(result => {
            const li = document.createElement('li');
            li.textContent = "Did you mean " + result.person + '?';
            li.addEventListener('click', () => {
                handleCityClick(result.person, markers);
            });
            suggestionsList.appendChild(li);
        });
    }

    if (searchValue === '') {
        filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
    } else {
        // A search replaces the filters, so turn them off rather than leave them looking active
        clearFilterState();
        document.getElementById('question-text').textContent = 'Pick a question to see the sages that match it.';
        const filteredMarkers = markers.filter(marker =>
            uniqueSearchResults.map(r => r.person).includes(marker.person)
        );
        displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople);
        updateFilterChip();
    }
}

function handleCityClick(person, markers) {
    clearFilterState();
    document.getElementById('search-input').value = "";
    const filteredMarkers = markers.filter(marker => marker.person.toLowerCase() === person.toLowerCase());
    displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople, true);
    updateFilterChip(person);

    const suggestionsList = document.getElementById('search-results');
    const suggestionItems = suggestionsList.getElementsByTagName('li');
    for (let item of suggestionItems) {
        if (item.textContent.toLowerCase() === person.toLowerCase()) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
}

// Rebuilds the full, sorted list of sages in the search panel
function rebuildSearchList() {
    const suggestionsList = document.getElementById('search-results');
    suggestionsList.innerHTML = '';
    const allPeople = [...new Map(markers.map(item => [item['person'], item])).values()];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));
    allPeople.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.person;
        li.addEventListener('click', () => handleCityClick(result.person, markers));
        suggestionsList.appendChild(li);
    });
}

// Picking a filter clears the search, so the map matches the chip
function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    rebuildSearchList();
}

// Turns off every background, focus, one-per-person and year filter, and clears their highlights.
// Does not redraw the map; the caller does that.
function clearFilterState() {
    backgrounds = [];
    expertises = [];
    uniqueness = false;
    legendItems.forEach(item => document.getElementById(item + '-legend')?.classList.remove('filter-clicked'));
    expertiseItems.forEach(item => document.getElementById(item + '-expertise')?.classList.remove('filter-clicked'));
    document.getElementById('uniqueness-button').classList.remove('filter-clicked');
    document.getElementById('year-slider').noUiSlider.set([900, 2000]);
}

// ========== FILTER CHIP ==========

// Shows the active filters and how many sages are on the map
function updateFilterChip(override = null) {
    const chip = document.getElementById('filter-chip');
    if (!chip) return;

    const count = new Set([...document.querySelectorAll('#visible-list li')].map(li => li.textContent)).size;
    const searchText = document.getElementById('search-input').value.trim();

    let label;
    if (override) {
        label = override;
    } else if (searchText) {
        label = `Search: "${searchText}"`;
    } else {
        const parts = [];
        if (backgrounds.length) parts.push(backgrounds.join(' + '));
        if (expertises.length) parts.push(expertises.join(' + '));
        if (uniqueness) parts.push('one per person');
        const [from, to] = yearRange();
        if (from !== 900 || to !== 2000) parts.push(`${from}–${to}`);
        label = parts.length ? parts.join(' · ') : 'All sages';
    }

    const prefix = !override && searchText ? '' : 'Showing: ';
    const empty = count === 0 ? ' · No sages match. Try removing a filter.' : '';
    chip.textContent = `${prefix}${label} · ${count} sage${count === 1 ? '' : 's'}${empty}`;
}

// ========== FILTERS ==========

function haveCommonElements(list1, list2) {
    for (let element of list1) {
        if (list2.includes(element)) {
            return true;
        }
    }
    return false;
}

function filterMarkers(markers, visibleMarkers, visibleMarkersPeople = false, backgrounds, expertises = [], unique = false, birthPlace = true) {
    const [timeValueStart, timeValueEnd] = yearRange();

    if (backgrounds.length === 0) {
        backgrounds = legendItems.map(cap);
    }

    let filteredMarkers = markers.filter(marker =>
        backgrounds.includes(marker.background) &&
        marker.from <= timeValueEnd &&
        marker.to >= timeValueStart &&
        (expertises.length === 0 || haveCommonElements(expertises, (marker.expertise || '').split(', ')))
    );

    if (unique) {
        if (birthPlace) {
            filteredMarkers = filteredMarkers.filter(marker => marker.from === marker.birth);
        } else {
            filteredMarkers = filteredMarkers.filter(marker => marker.to === marker.passing);
        }
    }

    displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople);
    updateFilterChip();
    // A manual filter change makes any earlier "Try This" result out of date
    document.getElementById('question-text').textContent = 'Pick a question to see the sages that match it.';
}

function handleLegendClick(markers, visibleMarkers, visibleMarkersPeople = false, legendId, filterName) {
    clearSearch();
    const legendClicked = document.getElementById(legendId);
    if (!legendClicked.classList.contains('filter-clicked')) {
        legendClicked.classList.add('filter-clicked');
        backgrounds.push(filterName);
    } else {
        legendClicked.classList.remove('filter-clicked');
        backgrounds.splice(backgrounds.indexOf(filterName), 1);
    }
    filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
}

function handleExpertiseClick(markers, visibleMarkers, visibleMarkersPeople = false, expertiseId, filterName) {
    clearSearch();
    const expertiseClicked = document.getElementById(expertiseId);
    if (!expertiseClicked.classList.contains('filter-clicked')) {
        expertiseClicked.classList.add('filter-clicked');
        expertises.push(filterName);
    } else {
        expertiseClicked.classList.remove('filter-clicked');
        expertises.splice(expertises.indexOf(filterName), 1);
    }
    filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
}

function handleUniquenessClick(markers, visibleMarkers, visibleMarkersPeople = false) {
    clearSearch();
    const uniquenessClicked = document.getElementById('uniqueness-button');
    if (!uniquenessClicked.classList.contains('filter-clicked')) {
        uniquenessClicked.classList.add('filter-clicked');
        uniqueness = true;
    } else {
        uniquenessClicked.classList.remove('filter-clicked');
        uniqueness = false;
    }
    filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
}

// Sets every filter at once (used by "Try This" questions)
function setFilters({ bgs = [], exps = [], years = [900, 2000] } = {}) {
    backgrounds = [...bgs];
    expertises = [...exps];
    uniqueness = false;

    legendItems.forEach(item => {
        const el = document.getElementById(item + '-legend');
        if (el) el.classList.toggle('filter-clicked', bgs.includes(cap(item)));
    });
    expertiseItems.forEach(item => {
        const el = document.getElementById(item + '-expertise');
        if (el) el.classList.toggle('filter-clicked', exps.includes(cap(item)));
    });
    document.getElementById('uniqueness-button').classList.remove('filter-clicked');

    document.getElementById('year-slider').noUiSlider.set(years);
    clearSearch();
    filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
}

function resetAllFilters() {
    setFilters({});
}

// ========== TRY THIS ==========

function applyPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;
    setFilters({ bgs: preset.bgs, exps: preset.exps, years: preset.years });
    const count = new Set([...document.querySelectorAll('#visible-list li')].map(li => li.textContent)).size;
    document.getElementById('question-text').textContent =
        `${preset.label}: ${count} sage${count === 1 ? '' : 's'} match. Check "Sages Found" to see who.`;
}

// ========== URL FILTERS ==========

function applyFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);

    // supports:
    // ?focus=Tanach
    // ?focus=Tanach,Halacha
    // ?focus=Tanach&focus=Halacha
    const focusValues = params.getAll('focus')
        .flatMap(value => value.split(','))
        .map(value => value.trim())
        .filter(Boolean);

    // supports:
    // ?background=Litvish
    // ?background=Litvish,Chassidic
    // ?background=Litvish&background=Chassidic
    const backgroundValues = params.getAll('background')
        .flatMap(value => value.split(','))
        .map(value => value.trim())
        .filter(Boolean);

    // supports ?from=1300&to=1500
    const hasYears = params.has('from') || params.has('to');
    if (hasYears) {
        const a = Number(params.get('from')) || 900;
        const b = Number(params.get('to')) || 2000;
        document.getElementById('year-slider').noUiSlider.set([Math.min(a, b), Math.max(a, b)]);
    }

    focusValues.forEach(focus => {
        const matchedItem = expertiseItems.find(item => item.toLowerCase() === focus.toLowerCase());
        if (!matchedItem) return;

        const filterName = cap(matchedItem);
        const button = document.getElementById(matchedItem + '-expertise');
        if (!button) return;

        button.classList.add('filter-clicked');
        if (!expertises.includes(filterName)) {
            expertises.push(filterName);
        }
    });

    backgroundValues.forEach(background => {
        const matchedItem = legendItems.find(item => item.toLowerCase() === background.toLowerCase());
        if (!matchedItem) return;

        const filterName = cap(matchedItem);
        const button = document.getElementById(matchedItem + '-legend');
        if (!button) return;

        button.classList.add('filter-clicked');
        if (!backgrounds.includes(filterName)) {
            backgrounds.push(filterName);
        }
    });

    // only run filtering if at least one URL filter was supplied
    if (focusValues.length || backgroundValues.length || hasYears) {
        filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
    }
}

// ========== TOUR ==========

function startTour() {
    const intro = introJs();

    intro.setOptions({
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: false,
        exitOnEsc: true,
        disableInteraction: true,
        scrollToElement: false,
        steps: [
            {
                element: 'body',
                intro: `
                <h3>👋 Welcome</h3>
                This page lets you explore sages across time and space.
                Let’s take a quick tour.
                `
            },
            {
                element: '#map',
                intro: `
                <h3>📍 The Map</h3>
                This map shows where figures lived and moved throughout their lives.
                You can pan and zoom freely. Hover a marker to see the sage's portrait and a link to their profile.
                `
            },
            {
                element: '#filter-chip',
                intro: `
                <h3>🧭 What You're Seeing</h3>
                This line lists the filters you have on and how many sages match them.
                `
            },
            {
                element: '.legend-container',
                intro: `
                <h3>🏷️ Background</h3>
                The color of the marker indicates the background of that sage. Click a background to filter for sages with that background.
                `
            },
            {
                element: '.expertise-container',
                intro: `
                <h3>📖 Focus</h3>
                Click an area of focus to filter for sages with that area of focus.
                `
            },
            {
                element: '.search-container',
                intro: `
                <h3>🕵️ Search</h3>
                Type a name to filter for a person/people with that name. A search turns off the other filters. Alternatively, click on a person to see them.
                `
            },
            {
                element: '#year-slider',
                intro: `
                <h3>📅 Timeline</h3>
                Drag this slider to filter by historical period.
                `
            },
            {
                element: '#question-card',
                intro: `
                <h3>💡 Try This</h3>
                Pick a question to see the sages that match it.
                `
            },
            {
                element: '#visible-container',
                intro: `
                <h3>👁️ Sages Found</h3>
                These are the sages matching your filters.
                Click on one to open their profile page.
                `
            },
            {
                element: '#uniqueness-button',
                intro: `
                <h3>🥇 One per person</h3>
                Click here to see a single marker per person (the last known place of that person).
                `
            },
            {
                element: '#reset-filters-button',
                intro: `
                <h3>🗑️ Reset Filters</h3>
                Click here to reset all filters and see all sages again.
                `
            },
            {
                element: '#info-button',
                intro: `
                <h3>🚶 Tour</h3>
                Click here to see this tour again.
                `
            }
        ]
    });

    intro.start();
}

// ========== INITIALIZE ==========

function initializeUI() {
    document.getElementById('search-input').addEventListener('input', function (event) {
        handleInput(event, markers);
    });

    legendItems.forEach(function (item) {
        const legendId = item + '-legend';
        const filterName = cap(item);
        document.getElementById(legendId).addEventListener('click', function () {
            handleLegendClick(markers, visibleMarkers, visibleMarkersPeople, legendId, filterName);
        });
    });

    expertiseItems.forEach(function (item) {
        const expertiseId = item + '-expertise';
        const filterName = cap(item);
        document.getElementById(expertiseId).addEventListener('click', function () {
            handleExpertiseClick(markers, visibleMarkers, visibleMarkersPeople, expertiseId, filterName);
        });
    });

    document.getElementById('uniqueness-button').addEventListener('click', function () {
        handleUniquenessClick(markers, visibleMarkers, visibleMarkersPeople);
    });

    document.getElementById('reset-filters-button').addEventListener('click', function () {
        resetAllFilters();
    });

    const allPeople = [...new Map(markers.map(item => [item['person'], item])).values()];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));
    uniqueNames = allPeople.flatMap((p) => [
        p.person.toLowerCase(),
        (p.name || "").toLowerCase(),
        ...((p.aka || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => s.toLowerCase()))
    ]);
    rebuildSearchList();

    const yearSlider = document.getElementById('year-slider');
    noUiSlider.create(yearSlider, {
        start: [900, 2000],
        connect: [false, true, false],
        range: { 'min': 900, 'max': 2000 },
        step: 1,
        tooltips: true,
        format: {
            to: value => Math.round(value),
            from: value => Number(value)
        },
        pips: {
            mode: 'values',
            values: [900, 1100, 1300, 1500, 1700, 1900],
            density: 10,
            format: { to: value => value.toString() }
        }
    });

    yearSlider.noUiSlider.on('change', function () {
        filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
    });

    // Hover a marker: the popup shows the portrait, facts and a profile link.
    // This capture listener runs before global.js's handler, so the popup is sized to the new content.
    document.addEventListener('mouseover', (event) => {
        const marker = event.target;
        if (!marker.classList || !marker.classList.contains('popup-button')) return;
        cancelPopupHide();
        // Keep the original text once, so the years can be read after the popup has been rewritten
        if (marker.dataset.plain === undefined) marker.dataset.plain = marker.dataset.message || '';
        const plain = marker.dataset.plain;
        const match = /<strong>(.*?)<\/strong>/.exec(plain);
        if (!match) return;
        // Use this dot's own city and years, not the first record for the person
        const years = /<br>\s*(\d+)-(\d+)/.exec(plain);
        marker.dataset.message = sageHoverHtml(match[1], {
            city: marker.dataset.city,
            country: marker.dataset.country,
            from: years?.[1],
            to: years?.[2]
        });
    }, true);
    document.addEventListener('mouseover', handleHoverPopup);
    document.addEventListener('mousemove', handleHoverPopup);

    // The popup stays open while the pointer is on it, so the profile link can be clicked
    let hideTimer = null;
    function cancelPopupHide() { clearTimeout(hideTimer); }
    function schedulePopupHide() { hideTimer = setTimeout(() => popup.classList.remove('visible'), 250); }
    document.addEventListener('mouseout', (event) => {
        if (event.target.classList && event.target.classList.contains('popup-button')) schedulePopupHide();
    });
    popup.addEventListener('mouseenter', cancelPopupHide);
    popup.addEventListener('mouseleave', () => popup.classList.remove('visible'));

    // "Try This" toggle and question buttons
    const tryToggle = document.getElementById('try-toggle');
    const tryCard = document.getElementById('question-card');
    tryToggle.addEventListener('click', () => {
        const open = tryCard.classList.toggle('open');
        tryToggle.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    applyFiltersFromUrl();
}

// ========== FETCH + RUN ON LOAD ==========

async function loadMarkers() {
    try {
        const { data, error } = await loadAllSagesNames();
        if (error) throw error;
        markers = data || [];
        await loadPictureNames();

        initializeUI();
        filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);
    } catch (error) {
        console.error('Error loading markers:', error);
        document.getElementById('filter-chip').textContent = 'Sages could not load. Please refresh the page.';
    }

    await trackPageView();
}

document.addEventListener('DOMContentLoaded', loadMarkers);
