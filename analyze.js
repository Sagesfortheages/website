import { loadAllSagesNames } from './supabase/sagesWithDwellingsNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';


let markers = []; // Will be loaded from API
let visibleMarkers = [];
let visibleMarkersPeople = [];
let backgrounds = [];
let expertises = [];
let uniqueNames = [];
let uniqueness = false;
let birthPlace = false;
let start = Date.now();
const legendItems = ['sefarad', 'ashkenaz', 'provence', 'chassidic', 'litvish', 'gaon', 'italian'];
const infoText = `This page provides geographic information about our sages through the years.<br><br>Search for a sage in the search bar to see where that sage lived.<br><br>As you type, the map will update to display only sages which match the typed text.<br><br>Alternatively, filter the sages by background, by clicking on one or more items in the background section. <br><br>You can also filter by the focus of a sage's work by clicking on one or more items in the focus section. <br><br>Lastly, you can filter by time using the slider at the bottom of the screen.<br><br>The background, focus and time filters all work together, while the search tab operates independently.<br><br>As the map updates, the Who You're Seeing list will update.<br><br> Hover over a marker to see which sage it is and when.<br><br>To learn more about a sage, click on him/her in the Who You're Seeing list, to see his/her biography page.`

// ... some code you want to measure ...

window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

document.getElementById('info-button').addEventListener('click', function () {
    startTour()
})

// ========== ORIGINAL FUNCTIONS (UNCHANGED) ==========

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
        var closestMatch = findClosestMatch(searchValue, uniqueNames);
        console.log(closestMatch)
        console.log(uniqueNames)
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
        filterMarkers(markers, visibleMarkers, backgrounds, expertises, uniqueness, birthPlace);
    } else {
        const filteredMarkers = markers.filter(marker =>
            uniqueSearchResults.map(r => r.person).includes(marker.person)
        );
        displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople = visibleMarkersPeople);
    }
}

function handleCityClick(person, markers) {
    document.getElementById('search-input').value = "";
    const filteredMarkers = markers.filter(marker => marker.person.toLowerCase() === person.toLowerCase());
    displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople, true);

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

function haveCommonElements(list1, list2) {
    for (let element of list1) {
        if (list2.includes(element)) {
            return true;
        }
    }
    return false;
}

function filterMarkers(markers, visibleMarkers, visibleMarkersPeople = false, backgrounds, expertises = [], unique = false, birthPlace = true) {
    const timeValueStart = document.getElementById('year-slider').noUiSlider.get()[0];
    const timeValueEnd = document.getElementById('year-slider').noUiSlider.get()[1];

    if (backgrounds.length === 0) {
        backgrounds = legendItems.map(element => capitalizeWords(element));
    }

    if (expertises.length === 0) {
        var filteredMarkers = markers.filter(marker =>
            backgrounds.includes(marker.background) &&
            marker.from <= timeValueEnd &&
            marker.to >= timeValueStart
        );
        if (unique) {
            if (birthPlace) {
                filteredMarkers = filteredMarkers.filter(marker => marker.from === marker.birth);
            } else {
                filteredMarkers = filteredMarkers.filter(marker => marker.to === marker.passing);
            }
        }
        displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople);
        return;
    }

    var filteredMarkers = markers.filter(marker =>
        backgrounds.includes(marker.background) &&
        marker.from <= timeValueEnd &&
        marker.to >= timeValueStart &&
        haveCommonElements(expertises, (marker.expertise || '').split(', '))
    );
    if (unique) {
        if (birthPlace) {
            filteredMarkers = filteredMarkers.filter(marker => marker.from === marker.birth);
        } else {
            filteredMarkers = filteredMarkers.filter(marker => marker.to === marker.passing);
        }
    }
    displayMarkers(filteredMarkers, visibleMarkers, visibleMarkersPeople);
}

function handleLegendClick(markers, visibleMarkers, visibleMarkersPeople = false, legendId, filterName) {
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

function resetAllFilters() {
  // ----- 1) Reset state vars -----
  backgrounds = [];
  expertises = [];
  uniqueness = false;
  birthPlace = false; // set to whatever your "default" is; you currently start false
  // NOTE: visibleMarkers / visibleMarkersPeople are managed by displayMarkers(), so we don't manually clear them here.

  // ----- 2) Reset UI: background legends -----
  legendItems.forEach((item) => {
    const el = document.getElementById(item + "-legend");
    if (el) el.classList.remove("filter-clicked");
  });

  // ----- 3) Reset UI: expertise buttons -----
  const expertiseItems = [
    "tanach", "talmud", "halacha", "responsa", "kabbalah",
    "chassidus", "mussar", "philosophy", "linguistics",
    "poetry", "history"
  ];
  expertiseItems.forEach((item) => {
    const el = document.getElementById(item + "-expertise");
    if (el) el.classList.remove("filter-clicked");
  });

  // ----- 4) Reset UI: uniqueness button -----
  const uniqBtn = document.getElementById("uniqueness-button");
  if (uniqBtn) uniqBtn.classList.remove("filter-clicked");

  // ----- 5) Reset UI: search input + suggestions highlight -----
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";

  const suggestionsList = document.getElementById("search-results");
  if (suggestionsList) {
    // remove any "selected" highlight you add in handleCityClick
    suggestionsList.querySelectorAll("li.selected").forEach(li => li.classList.remove("selected"));

    // optional: if you want the list to look like initial load (full list),
    // you can also clear and rebuild it. If you DON'T need that, delete this block.
    // (Rebuild uses markers already loaded.)
    suggestionsList.innerHTML = "";
    const allPeople = [...new Map(markers.map(item => [item["person"], item])).values()];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));
    allPeople.forEach(result => {
      const li = document.createElement("li");
      li.textContent = result.person;
      li.addEventListener("click", () => handleCityClick(result.person, markers));
      suggestionsList.appendChild(li);
    });
  }

  // ----- 6) Reset UI: year slider -----
  const yearSlider = document.getElementById("year-slider");
  if (yearSlider && yearSlider.noUiSlider) {
    // match your initial 'start: [900, 2000]'
    yearSlider.noUiSlider.set([900, 2000]);
  }

  // ----- 7) Hide popup if visible -----
  if (window.popup) window.popup.classList.remove("visible");

  // ----- 8) Show ALL markers again -----
  // This is the key: ensure everything is visible, regardless of filter state.
  displayMarkers(markers, visibleMarkers, visibleMarkersPeople);
}


// ========== NEW: FETCH + INITIALIZE ==========

async function loadMarkers() {
    try {
        const { data, error } = await loadAllSagesNames()

        if (error) throw error;
        markers = data || [];

        initializeUI();
        await loadMusic(supabaseClient, "StockTune-Epic Voyage Through Time_1765329202.mp3");
        filterMarkers(markers, visibleMarkers, visibleMarkersPeople, backgrounds, expertises, uniqueness, birthPlace);

    } catch (error) {
        console.error('Error loading markers:', error);
    }

    const page = await trackPageView();
    console.log(page)
    // if(page.isFirstVisit) {
    //     startTour()
    // }
}

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
                You can pan and zoom freely. Hover a marker to see more information.
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
                Type a name to filter for a person/people with that name. As you type, the map will update. Alternatively, click on a person to filter for them.
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
                element: '#visible-container',
                intro: `
                <h3>👁️ Currently Visible</h3>
                These are the sages matching your filters.
                Click on one to be taken to their profile page.
                `
            },
            {
                element: '#uniqueness-button',
                intro: `
                <h3>🥇 Uniqueness</h3>
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
function applyFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);

    // supports:
    // ?focus=Tanach
    // ?focus=Tanach,Halacha
    // ?focus=Tanach&focus=Halacha
    const rawFocusParams = params.getAll('focus');
    const focusValues = rawFocusParams
        .flatMap(value => value.split(','))
        .map(value => value.trim())
        .filter(Boolean);

    // supports:
    // ?background=Litvish
    // ?background=Litvish,Chassidic
    // ?background=Litvish&background=Chassidic
    const rawBackgroundParams = params.getAll('background');
    const backgroundValues = rawBackgroundParams
        .flatMap(value => value.split(','))
        .map(value => value.trim())
        .filter(Boolean);

    const expertiseItems = [
        'tanach', 'talmud', 'halacha', 'responsa', 'kabbalah',
        'chassidus', 'mussar', 'philosophy', 'linguistics',
        'poetry', 'history'
    ];

    const backgroundItems = [
        'sefarad', 'ashkenaz', 'provence', 'chassidic',
        'litvish', 'gaon', 'italian'
    ];

    focusValues.forEach(focus => {
        const normalizedFocus = focus.toLowerCase();

        const matchedItem = expertiseItems.find(item => item.toLowerCase() === normalizedFocus);
        if (!matchedItem) return;

        const filterName = matchedItem.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
        const expertiseId = matchedItem + '-expertise';
        const button = document.getElementById(expertiseId);

        if (!button) return;

        button.classList.add('filter-clicked');

        if (!expertises.includes(filterName)) {
            expertises.push(filterName);
        }
    });

    backgroundValues.forEach(background => {
        const normalizedBackground = background.toLowerCase();

        const matchedItem = backgroundItems.find(item => item.toLowerCase() === normalizedBackground);
        if (!matchedItem) return;

        const filterName = matchedItem.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
        const legendId = matchedItem + '-legend';
        const button = document.getElementById(legendId);

        if (!button) return;

        button.classList.add('filter-clicked');

        if (!backgrounds.includes(filterName)) {
            backgrounds.push(filterName);
        }
    });

    // only run filtering if at least one URL filter was supplied
    if (focusValues.length || backgroundValues.length) {
        filterMarkers(
            markers,
            visibleMarkers,
            visibleMarkersPeople,
            backgrounds,
            expertises,
            uniqueness,
            birthPlace
        );
    }
}

function initializeUI() {
    document.getElementById('search-input').addEventListener('input', function (event) {
        handleInput(event, markers);
    });

    // const song = document.getElementById('song');
    // if (song) {
    //     song.play();
    // }

    

    legendItems.forEach(function (item) {
    const legendId = item + '-legend';
    const filterName = item.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
    document.getElementById(legendId).addEventListener('click', function () {
        handleLegendClick(markers, visibleMarkers, visibleMarkersPeople, legendId, filterName);
        
    });
    });

    const expertiseItems = ['tanach', 'talmud', 'halacha', 'responsa', 'kabbalah', 'chassidus', 'mussar', 'philosophy',
        'linguistics', 'poetry', 'history'];
    expertiseItems.forEach(function (item) {
        const expertiseId = item + '-expertise';
        const filterName = item.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
        document.getElementById(expertiseId).addEventListener('click', function () {
            handleExpertiseClick(markers, visibleMarkers, visibleMarkersPeople, expertiseId, filterName);
        });
    });

    document.getElementById('uniqueness-button').addEventListener('click', function () {
        handleUniquenessClick(markers, visibleMarkers, visibleMarkersPeople);
    });

    
    document.getElementById('reset-filters-button').addEventListener('click', function () {
        resetAllFilters()
    });

    const suggestionsList = document.getElementById('search-results');
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
        ])
    
    allPeople.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.person;
        li.addEventListener('click', () => {
            handleCityClick(result.person, markers);
        });
        suggestionsList.appendChild(li);
    });

    var yearSlider = document.getElementById('year-slider');
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

    document.addEventListener('mouseover', handleHoverPopup);
    document.addEventListener('mousemove', handleHoverPopup);
    document.addEventListener('mouseout', (event) => {
        if (event.target.classList.contains('popup-button')) {
            popup.classList.remove('visible');
        }
    });

    applyFiltersFromUrl();
}



// ========== RUN FETCH ON LOAD ==========
document.addEventListener('DOMContentLoaded', loadMarkers);
let end = Date.now();
console.log("Elapsed time: " + (end - start) + " ms");

