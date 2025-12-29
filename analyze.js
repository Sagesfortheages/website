import { loadAllSagesNames } from './supabase/sagesWithDwellingsNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';


let markers = []; // Will be loaded from API
let visibleMarkers = [];
let visibleMarkersPeople = [];
let backgrounds = [];
let expertises = [];
let uniqueness = false;
let birthPlace = false;
let start = Date.now();
const legendItems = ['sefarad', 'ashkenaz', 'provence', 'chassidic', 'litvish', 'gaon', 'italian'];
const infoText = `This page provides geographic information about our sages through the years.<br><br>Search for a sage in the search bar to see where that sage lived.<br><br>As you type, the map will update to display only sages which match the typed text.<br><br>Alternatively, filter the sages by background, by clicking on one or more items in the background section. <br><br>You can also filter by the focus of a sage's work by clicking on one or more items in the focus section. <br><br>Lastly, you can filter by time using the slider at the bottom of the screen.<br><br>The background, focus and time filters all work together, while the search tab operates independently.<br><br>As the map updates, the Who You're Seeing list will update.<br><br> Hover over a marker to see which sage it is and when.<br><br>To learn more about a sage, click on him/her in the Who You're Seeing list, to see his/her biography page.`

// ... some code you want to measure ...

window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

document.getElementById('info-button').addEventListener('click', function () {
    showCustomAlert(infoText, '2.0vmin');
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

// ========== NEW: FETCH + INITIALIZE ==========

async function loadMarkers() {
    try {
        const { data, error } = await loadAllSagesNames()

        if (error) throw error;
        markers = data || [];

        initializeUI();
        await loadMusic(supabaseClient, "StockTune-Epic Voyage Through Time_1765329202.mp3");
        displayMarkers(markers, visibleMarkers, visibleMarkersPeople);

    } catch (error) {
        console.error('Error loading markers:', error);
    }

    const page = await trackPageView();
    if(page.isFirstVisit) {
        showCustomAlert(infoText, '2.0vmin')
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

    const suggestionsList = document.getElementById('search-results');
    const allPeople = [...new Map(markers.map(item => [item['person'], item])).values()];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));
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
    document.addEventListener('mousemove', (event) => {
        popup.style.left = event.pageX + 10 + "px";
        popup.style.top = event.pageY - 28 + "px";
    });
    document.addEventListener('mouseout', (event) => {
        if (event.target.classList.contains('popup-button')) {
            popup.classList.remove('visible');
        }
    });
}

// ========== RUN FETCH ON LOAD ==========
document.addEventListener('DOMContentLoaded', loadMarkers);
let end = Date.now();
console.log("Elapsed time: " + (end - start) + " ms");