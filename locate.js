import { loadAllCities } from './supabase/cities.js';
import { loadAllSagesNames } from './supabase/sagesWithDwellingsNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';


// =====================
// Utility: Get country codes to get flags
// =====================
function getCountryCode(countryName) {
    const countryCodes = {
        'France': 'fr',
        'Germany': 'de',
        'USA': 'us',
        'Spain': 'es',
        'Italy': 'it',
        'England': 'gb',
        'Ukraine': 'ua',
        'Poland': 'pl',
        'Russia': 'ru',
        'Czech Republic': 'cz',
        'Slovenia': 'si',
        'Lithuania': 'lt',
        'Austria': 'at',
        'Switzerland': 'ch',
        'Algeria': 'dz',
        'Bosnia': 'ba',
        'Portugal': 'pt',
        'Belarus': 'by',
        'Bulgaria': 'bg',
        'Croatia': 'hr',
        'Egypt': 'eg',
        'Greece': 'gr',
        'Hungary': 'hu',
        'Iraq': 'iq',
        'Israel': 'il',
        'Kazakhstan': 'kz',
        'Morocco': 'ma',
        'Romania': 'ro',
        'Serbia': 'rs',
        'Slovakia': 'sk',
        'Syria': 'sy',
        'Latvia': 'lv',
        'Uzbekistan': 'uz',
        'Brazil': 'br',
        'Netherlands': 'nl',
        'Tunisia': 'tn',
        'Turkey': 'tr',
        'Georgia': 'ge',
        'Yemen': 'ye',
        'Libya': 'ly'
        // Add more mappings as needed
    };
    return countryCodes[countryName] || 'xx';
}

// =====================
// Global variables
// =====================
let cities = [];
let markers = [];
let visibleCities = [];
let occupantsList = document.getElementById("occupant-list-content");
let occupantsListHeading = document.getElementById("occupant-list-heading");
let countriesList = document.getElementById('country-list');

const infoText = `This page contains information about all the cities that sages have lived in through the years.<br><br>Search for a city in the search bar to find out more about which sages lived there and when. <br><br>As you type, the map will update to display only cities which match the typed text.<br><br>Click on a city name to filter out all the other cities.<br><br>Click on a country to isolate the cities in that country. <br><br> Hover over a marker to see the city and country.<br><br>Pick a city to see which sage lived there and when. You can pick a city by clicking on a city name, or clicking on a city marker, or using the search bar.<br><br>Click on a sage to see his biography page.`
document.getElementById('info-button').addEventListener('click', function () {
    showCustomAlert(infoText, '2.0vmin');
});
// =====================
// Fetch cities and markers from DB
// =====================

async function loadData() {
    try {
        // Fetch cities and sages in parallel
        const [citiesRes, markersRes] = await Promise.all([
            loadAllCities(),
            loadAllSagesNames()
        ]);

        // Process cities
        cities = citiesRes.data || [];

        // Process sages/markers
        markers = markersRes.data || [];

        // Initialize your UI with the loaded data
        initUI();
    } catch (err) {
        console.error("Error loading data:", err);
    }
    const page = await trackPageView();
    if(page.isFirstVisit) {
        showCustomAlert(infoText, '2.0vmin')
    }
}

// =====================
// Initialize UI after data load
// =====================
function initUI() {
    const uniqueCountries = [...new Set(cities.map(city => city.country))].sort();

    countriesList.innerHTML = '';
    uniqueCountries.forEach(country => {
        const li = document.createElement('li');
        li.innerHTML = `<img src="https://flagcdn.com/w20/${getCountryCode(country)}.png" 
                          alt="${country} Flag" width="20" height="13" 
                          style="margin-right: 8px; vertical-align: middle;"> ${country}`;
        li.classList.add("country");
        li.addEventListener('click', () => {
            handleCountryClick(country, cities);
            occupantsList.innerHTML = '';
            occupantsListHeading.innerHTML = `Who Lived There And When`;
        });
        countriesList.appendChild(li);
    });

    const uniqueCities = extractCityNames(cities);

    displayCities(cities, visibleCities);

    const suggestionsList = document.getElementById('search-results');
    const allCityNames = [...new Map(cities.map(item => [item['city'], item])).values()];
    suggestionsList.innerHTML = '';
    allCityNames.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.city;
        li.classList.add('city');
        li.addEventListener('click', () => {
            handleCityClick(result.city, cities);
        });
        suggestionsList.appendChild(li);
    });

    document.getElementById('search-input').addEventListener('input', function (event) {
        handleCityInput(event, cities, uniqueCities);
    });

    document.getElementById('country-search').addEventListener('input', function (event) {
        handleCountryInput(event, cities, uniqueCountries);
    });
}

// =====================
// Original functions
// =====================
function displayCities(citiesData, visibleCities) {
    visibleCities.forEach(marker => marker.remove());
    citiesData.forEach((city) => {
        const el = document.createElement('div');
        el.classList.add('city', 'popup-button');
        el.dataset.message = `${city.city}, ${city.country}`;
        el.dataset.city = `${city.city}`;
        const newCityMarker = new mapboxgl.Marker(el)
            .setLngLat([city.longitude, city.latitude])
            .addTo(map);
        visibleCities.push(newCityMarker);
        if (citiesData.length === 1) {
            fillPeopleDetails(citiesData);
        }
    });
}

function fillPeopleDetails(citiesData) {
    let filteredCitiesArray = citiesData.map(city => city.city);
    const filteredMarkersUnsorted = markers.filter(marker => filteredCitiesArray.includes(marker.city));
    const filteredMarkers = filteredMarkersUnsorted.sort((a, b) => a.from - b.from);
    occupantsListHeading.innerHTML = `Who Lived In <u>${filteredCitiesArray[0]}</u> And When`;
    occupantsList.innerHTML = '';
    console.log(filteredMarkers)
    filteredMarkers.forEach(marker => {
        let li = document.createElement("li");
        li.innerHTML = `<span style="color: ${getColor(marker.background)}">${marker.person}</span>, <span style="font-size: 2vmin;">${marker.from}-${marker.to}</span>`;
        li.classList.add("clickable");
        occupantsList.appendChild(li);
        li.addEventListener('click', function () {
            linkToProfile(marker);
        });
    });
}

function extractCityNames(data) {
    let uniqueCities = [];
    let seen = {};
    data.forEach(datum => {
        console.log(datum)
        if (!seen[datum.city]) {
            seen[datum.city] = true;
            console.log("Adding city:", datum.city);
            uniqueCities.push(datum.city.toLowerCase());
            if (datum.akas.length > 0) {
                datum.akas.forEach(aka => uniqueCities.push(aka.trim().toLowerCase()));
            }
        }
    });
    return uniqueCities;
}

function handleCityInput(event, cities, uniqueCities) {
    occupantsList.innerHTML = "";
    occupantsListHeading.innerHTML = "Who Lived There And When";
    let searchValue;
    if (event.inputType !== undefined) {
        searchValue = event.target.value.trim().toLowerCase();
    } else if (event.type == 'click') {
        searchValue = searchValue.toLowerCase();
    }
    const searchResults = cities.filter(city =>
        city.city.toLowerCase().includes(searchValue) || city.akas.some(aka => aka.toLowerCase().includes(searchValue))

    );
    const uniqueSearchResults = [...new Map(searchResults.map(item => [item['city'], item])).values()];
    const suggestionsList = document.getElementById('search-results');
    suggestionsList.innerHTML = '';
    uniqueSearchResults.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.city;
        li.classList.add("city");
        li.addEventListener('click', () => {
            handleCityClick(result.city, cities);
        });
        suggestionsList.appendChild(li);
    });
    if (uniqueSearchResults.length === 0) {
        var closestMatch = findClosestMatch(searchValue, uniqueCities);
        const closestResults = cities.filter(city =>
            (city.city || '').toLowerCase().includes(closestMatch) || (city.aka || '').toLowerCase().includes(closestMatch)
        );
        const uniqueClosestResults = [...new Map(closestResults.map(item => [item['city'], item])).values()];
        uniqueClosestResults.forEach(result => {
            const li = document.createElement('li');
            li.textContent = "Did you mean " + result.city + '?';
            li.classList.add("city");
            li.addEventListener('click', () => {
                handleCityClick(result.city, cities);
            });
            suggestionsList.appendChild(li);
        });
    }
    if (searchValue === '') {
        displayCities(cities, visibleCities);
    } else {
        const filteredCityMarkers = cities.filter(city =>
            uniqueSearchResults.map(r => r.city).includes(city.city)
        );
        displayCities(filteredCityMarkers, visibleCities);
    }
}

function handleCountryInput(event, cities, uniqueCountries) {
    let searchValue;
    if (event.inputType !== undefined) {
        searchValue = event.target.value.trim().toLowerCase();
    } else if (event.type == 'click') {
        searchValue = searchValue.toLowerCase();
    }
    const searchResults = uniqueCountries.filter(country => country.toLowerCase().includes(searchValue));
    const suggestionsList = document.getElementById('country-list');
    suggestionsList.innerHTML = '';
    searchResults.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result;
        li.classList.add("country");
        li.addEventListener('click', () => {
            handleCountryClick(result, cities);
        });
        suggestionsList.appendChild(li);
    });
    if (searchResults.length === 0) {
        var closestMatch = findClosestMatch(searchValue, uniqueCountries);
        const closestResults = uniqueCountries.filter(country =>
            country.toLowerCase().includes(closestMatch.toLowerCase())
        );
        closestResults.forEach(result => {
            const li = document.createElement('li');
            li.textContent = "Did you mean " + result + '?';
            li.classList.add("country");
            li.addEventListener('click', () => {
                handleCountryClick(result, cities);
            });
            suggestionsList.appendChild(li);
        });
    }
}

function handleCityClick(selectedCity, cities, filterDisplay = true) {
    document.getElementById('search-input').value = "";
    const filteredCities = cities.filter(city => city.city.toLowerCase() === selectedCity.toLowerCase());
    if (filterDisplay) {
        displayCities(filteredCities, visibleCities);
    } else {
        fillPeopleDetails(filteredCities);
    }
    map.flyTo({
        center: [filteredCities[0].longitude, filteredCities[0].latitude],
        duration: 4000,
        essential: true,
        zoom: 5
    });
    for (let item of document.getElementById('country-list').getElementsByTagName('li')) {
        item.classList.remove('selected');
    }
    const suggestionsList = document.getElementById('search-results');
    const suggestionItems = suggestionsList.getElementsByTagName('li');
    for (let item of suggestionItems) {
        if (item.textContent.toLowerCase() === selectedCity.toLowerCase()) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
}

let currentAudio = null;

function playAnthem(selectedCountry) {
    // Stop any audio already playing
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    // Create and play new audio
    const audio = new Audio('Anthems/' + selectedCountry + '.mp3');
    currentAudio = audio;

    audio.play();

    setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
    }, 10000); // adjust duration
}

function handleCountryClick(selectedCountry, cities) {
    document.getElementById('search-input').value = "";
    const filteredCities = cities.filter(city => city.country.toLowerCase() === selectedCountry.toLowerCase());
    displayCities(filteredCities, visibleCities);
    for (let item of document.getElementById('search-results').getElementsByTagName('li')) {
        item.classList.remove('selected');
    }
    map.flyTo({
        center: [filteredCities[0].longitude, filteredCities[0].latitude],
        duration: 4000,
        essential: true,
        zoom: 4
    });
    const countryItems = document.getElementById('country-list').getElementsByTagName('li');
    for (let item of countryItems) {
        if (item.textContent.trim().toLowerCase() === selectedCountry.toLowerCase()) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
    playAnthem(selectedCountry);
}

// =====================
// Popup hover events
// =====================
window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');
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
document.addEventListener('click', (event) => {
    if (event.target.dataset.message) {
        handleCityClick(event.target.dataset.city, cities, false);
    }
});

// =====================
// Kick off data loading
// =====================
loadData();
