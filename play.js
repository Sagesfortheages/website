import { loadAllSages } from './supabase/sagesWithNames.js';
import { trackGameStart, trackPageView, updateGameResult, trackGuess, countSolvedGames } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';

// Global variables
let markers = [];
let uniqueNames = [];
let correctAnswer = null;
let wrongGuessesNum = 0;
let wrongGuesses = [];
let hints = 0;
const infoText = `Your goal is to guess the unknown sage. <br><br> Get more clues by guessing sages in the guess bar.<br><br>Each sage you guess will have a place of passing, areas of focus and a place in the timeline.<br><br>The closer your guess's place of passing is to the mystery sage's place of passing, the hotter it will glow.<br><br>Similarly, the closer your guess's spot in the timeline to the mystery sage's place in the timeline.<br><br> There is also a wheel of focus. Each time you guess a sage, his/her name will appear on the outside of the wheel, along with that guess's areas of focus. If an area of a focus of a guess aligns with one of the mystery sage's, the inner wheel will glow green. If it doesn't align, the inner wheel will glow red.<br><br>Click on the question mark to see the answer.<br><br>You have 12 guesses.<br><br> Good luck!`;
const maxGuesses = 12;
const difficultyLevel = JSON.parse(sessionStorage.getItem('difficulty')) || 'medium';
const scale = { 'Very Easy': 1, 'Easy': 2, 'Medium': 3, 'Hard': 4, 'Very Hard': 5 };
const maxDifficulty = scale[difficultyLevel] ?? 5;
let gameId = null;
let gameReady = false;
let isRevealRunning = false;

const params = new URLSearchParams(window.location.search);
const assignmentId = params.get('assignment_id');
let currentAssignment = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

document.getElementById("info-button").addEventListener("click", startTour);

window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

const playContainer = document.getElementById('play-container');
const revealOverlay = document.getElementById('reveal-overlay');
const revealStatus = document.getElementById('reveal-status');

const searchPanel = document.querySelector('.top-left-container');
const timelinePanel = document.querySelector('.top-right-container');
const wheelPanel = document.querySelector('.bottom-left-container');
const mapPanel = document.querySelector('.bottom-right-container');

function normalizeExpertiseArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => typeof item === 'string' ? item.trim() : item?.expertise?.trim())
        .filter(Boolean);
}

function beginReveal(message = 'Processing guess...') {
    if (playContainer) playContainer.classList.add('revealing');
    if (revealOverlay) revealOverlay.classList.add('active');
    if (revealStatus) {
        revealStatus.textContent = message;
        revealStatus.classList.add('show');
    }
}

function updateRevealStatus(message) {
    if (revealStatus) {
        revealStatus.textContent = message;
    }
}

function endReveal() {
    if (playContainer) playContainer.classList.remove('revealing');
    if (revealOverlay) revealOverlay.classList.remove('active');
    if (revealStatus) revealStatus.classList.remove('show');
    clearPanelFocus();
}

function clearPanelFocus() {
    [searchPanel, timelinePanel, wheelPanel, mapPanel].forEach(panel => {
        if (!panel) return;
        panel.classList.remove('reveal-focus', 'reveal-dim');
    });
}

function focusOnePanel(activePanel) {
    [searchPanel, timelinePanel, wheelPanel, mapPanel].forEach(panel => {
        if (!panel) return;
        if (panel === activePanel) {
            panel.classList.add('reveal-focus');
            panel.classList.remove('reveal-dim');
        } else {
            panel.classList.add('reveal-dim');
            panel.classList.remove('reveal-focus');
        }
    });
}

function pulseRing(id) {
    const ring = document.getElementById(id);
    if (!ring) return;
    ring.classList.remove('reveal-ring');
    void ring.offsetWidth;
    ring.classList.add('reveal-ring');
}

async function fetchMarkersFromDatabase() {
    try {
        const allMarkers = await loadAllSages();

        if (!allMarkers || allMarkers.length === 0) {
            console.warn("No markers found in database");
            return [];
        }

        await loadMusic(supabaseClient, "climb_city_morning.mp3");

        markers = allMarkers
            .filter(sage => sage.difficulty <= maxDifficulty)
            .filter(sage => sage.expertise.length > 0);

        console.log(`Fetched ${markers.length} markers from Supabase (difficulty <= ${maxDifficulty})`);
        return markers;

    } catch (error) {
        console.error('Error loading markers from Supabase:', error);
        return [];
    }
}

function processMarkersData(markersData) {
    const processedMarkers = markersData.map(marker => {
        if (typeof marker.expertise === 'string') {
            marker.expertise = marker.expertise.split(',').map(item => item.trim());
        } else if (!Array.isArray(marker.expertise)) {
            marker.expertise = [];
        }

        marker.aka = marker.aka || '';
        marker.name = marker.name || marker.person;
        marker.city_of_passing = marker.city_of_passing || {};
        marker.country_of_passing = marker.country_of_passing || 'Unknown';
        marker.background = marker.background || '';
        marker.major_works = marker.major_works || '0';
        marker.biography = marker.biography || '';

        marker.birth = Number(marker.birth) || 0;
        marker.passing = Number(marker.passing) || 0;
        marker.latitude_of_passing = Number(marker.latitude_of_passing) || 0;
        marker.longitude_of_passing = Number(marker.longitude_of_passing) || 0;

        marker.expertise = normalizeExpertiseArray(marker.expertise);

        return marker;
    });

    const names = processedMarkers.map(marker => {
        const allNames = [marker.person, marker.name];
        if (marker.aka) {
            allNames.push(...marker.aka.split(',').map(name => name.trim()));
        }
        return allNames;
    }).flat();

    uniqueNames = [...new Set(names.filter(name => name && name !== 'undefined'))];
    return processedMarkers;
}

async function initializeGame() {
    try {
        const circleContainer = document.querySelector(".circle-container");
        if (circleContainer) {
            circleContainer.innerHTML = '<div>Loading game data...</div>';
        }

        const markersData = await fetchMarkersFromDatabase();

        if (markersData.length === 0) {
            throw new Error('No markers data available');
        }

        markers = processMarkersData(markersData);

        await startNewGame();
        setupGameUI();

        console.log('Game initialized successfully');

    } catch (error) {
        console.error('Failed to initialize game:', error);

        const circleContainer = document.querySelector(".circle-container");
        if (circleContainer) {
            circleContainer.innerHTML = `
                <div style="color: #a9443b; text-align: center;">
                    <p>Failed to load game. Please refresh the page to try again.</p>
                    <button onclick="initializeGame()" style="margin-top: 10px;">Retry</button>
                </div>
            `;
        }
    }

    const page = await trackPageView(difficultyLevel);
    if (page.isFirstVisit) {
        startTour();
    }
}

function startTour() {
    const intro = introJs();

    intro.setOptions({
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: false,
        exitOnEsc: true,
        disableInteraction: false,
        scrollToElement: false,
        steps: [
            {
                element: '.play-page',
                intro: `<h3>👋 Welcome</h3>Your job is to guess the mystery sage. As you guess, you will receive more clues to hone your next guess.`
            },
            {
                element: '#textbox',
                intro: `<h3>🔎 Guess</h3>Guess a sage by inputting their name here.`
            },
            {
                element: '#search-results',
                intro: `<h3>👤 Sages</h3>You can also guess by clicking a sage here.`
            },
            {
                element: '.circle-container',
                intro: `<h3>👥 Guesses</h3>You have 12 guesses. As you play, hover over a circle to see what you guessed.`
            },
            {
                element: '.target',
                intro: `<h3>🎯 Wheel of Focus</h3>This is called the Wheel of Focus. With each guess, you learn more about the areas of focus of the mystery sage.`
            },
            {
                element: '#ring1',
                intro: `<h3>◎ Guess's Focus</h3>If your guess focused on Talmud, the outer ring will glow green in the Talmud section. This will then reveal whether the mystery sage focused on Talmud.`
            },
            {
                element: '#ring2',
                intro: `<h3>◉ Mystery Focus</h3>If he also focused on Talmud, the inner ring will glow green by Talmud. If not, it will glow pink. If it remains grey, find a guess with that area of focus to reveal another clue.`
            },
            {
                element: '#guessLabel',
                intro: `<h3>🗨 Guess Label</h3>Here you can find the name of your most recent guess.`
            },
            {
                element: '.gradient-wrapper',
                intro: `<h3>🌡️ Hot and Cold</h3>Here is a heatmap to help you with the other clues that are revealed as you progress through the game. Blue means your current guess is far from the mystery guess. Red means it is close.`
            },
            {
                element: '#timeline-container',
                intro: `<h3>⏳ Timeline</h3>Your guess's life span will appear. The closer your guess's life span is to the mystery sage's, the more red it will appear. As you play, hover over a sage's lifespan to see more details.`
            },
            {
                element: '#map',
                intro: `<h3>🌍 Map</h3>Your guess's last place of activity will appear here. The closer your guess's last place is to the mystery sage's last place, the more red it will appear. As you play, hover to see more details.`
            },
            {
                element: '#correctLabel',
                intro: `<h3>👁️ Reveal the Sage</h3>Click here to reveal the mystery sage.`
            },
            {
                element: '#hint-button',
                intro: `<h3>💡 Hint</h3>Click here to receive a hint.`
            },
            {
                element: '#restart-button-main',
                intro: `<h3>🔄 Restart</h3>Click here to restart the game with a new mystery sage.`
            },
            {
                element: '#info-button',
                intro: `<h3>🚶 Restart Tour</h3>Click this button to see this tour again.`
            }
        ]
    });

    intro.start();
}

function setupGameUI() {
    setRingColor('ring1', [], [], 'var(--paper)');
    setRingColor('ring2', [], [], 'lightgray');

    const circleContainer = document.querySelector(".circle-container");
    createCircles(circleContainer, maxGuesses);

    setupSuggestionsList();
    setupEventListeners();
}

function handleSearchResultClick(e) {
    if (!gameReady || isRevealRunning) return;
    const li = e.currentTarget;
    evaluateAnswer(correctAnswer, li._result);
}

function setupSuggestionsList() {
    const suggestionsList = document.getElementById('search-results');
    if (!suggestionsList) return;

    suggestionsList.innerHTML = '';

    const allPeople = [...new Map(markers.map(item => [item.person, item])).values()];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));

    allPeople.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.person;
        li._result = result;
        li.addEventListener('click', handleSearchResultClick);
        suggestionsList.appendChild(li);
    });
}

function setupEventListeners() {
    const restartButton = document.getElementById('restart-button-main');
    if (restartButton) {
        restartButton.addEventListener('click', function() {
            if (isRevealRunning) return;
            hideCustomAlert();
            restartGame();
        });
    }

    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.addEventListener('click', handleHintClick);
    }

    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.addEventListener('keypress', handleEnter);
    }

    const correctLabel = document.getElementById('correctLabel');
    if (correctLabel) {
        correctLabel.addEventListener('click', function() {
            if (isRevealRunning) return;
            if (this.textContent.includes('?')) {
                evaluateAnswer(correctAnswer, correctAnswer, false);
            } else {
                linkToProfile(correctAnswer);
            }
        });
    }

    const suggestion = document.getElementById('suggestion');
    if (suggestion) {
        suggestion.addEventListener('click', handleSuggestionClick);
    }

    document.addEventListener('mouseover', handleHoverPopup);
    document.addEventListener('mousemove', handleHoverPopup);
    document.addEventListener('mouseout', handleMouseOut);
}

async function loadAssignedCorrectAnswer() {
    if (!assignmentId) return null;

    const { data: assignment, error } = await supabaseClient
        .from('assignments')
        .select('id, title, activity_type, target_sage_person, status')
        .eq('id', assignmentId)
        .eq('status', 'active')
        .single();

    if (error || !assignment) {
        console.error('Assignment load error:', error);
        throw new Error('Assigned activity not found.');
    }

    currentAssignment = assignment;

    const targetPerson = assignment.target_sage_person?.trim().toLowerCase();

    const assignedAnswer = markers.find(marker =>
        marker.person?.trim().toLowerCase() === targetPerson
    );

    if (!assignedAnswer) {
        throw new Error(`Assigned sage not found in game data: ${assignment.target_sage_person}`);
    }

    return assignedAnswer;
}

async function startNewGame() {
    gameReady = false;

    if (markers.length === 0) {
        console.error('No markers available to start game');
        return;
    }

    const assignedCorrectAnswer = await loadAssignedCorrectAnswer();

    if (assignedCorrectAnswer) {
        correctAnswer = assignedCorrectAnswer;
    } else {
        correctAnswer = pickRandomMarker(markers, difficultyLevel);
    }

    correctAnswer.expertise = normalizeExpertiseArray(correctAnswer.expertise);

    correctAnswer.expertise = normalizeExpertiseArray(correctAnswer.expertise);

    if (!correctAnswer) {
        console.error('Failed to pick random marker');
        return;
    }

    gameId = await trackGameStart(correctAnswer.person, maxDifficulty);

    wrongGuessesNum = 0;
    wrongGuesses = [];
    hints = 0;
    isRevealRunning = false;

    const correctLabel = document.getElementById('correctLabel');
    if (correctLabel) {
        correctLabel.textContent = '';
        correctLabel.innerHTML = '<button>?</button>';
        correctLabel.classList.remove('clickable');
    }

    const guessLabel = document.getElementById('guessLabel');
    if (guessLabel) {
        guessLabel.textContent = '';
    }

    clearPanelFocus();
    endReveal();

    gameReady = true;
}

function handleHintClick() {
    if (!correctAnswer || isRevealRunning) return;

    if (hints < 1) {
        showCustomAlert(`This sage's background was ${correctAnswer.background}.`, "5vmin", false, true);
        hints += 1;
    } else if (hints < 2) {
        if (correctAnswer.major_works !== '0') {
            const works = correctAnswer.major_works.split(',');
            if (works[0] !== correctAnswer.person && !correctAnswer.aka.split(',')[0].includes(works[0])) {
                showCustomAlert(`This sage's background was ${correctAnswer.background}.<br><br>One of this sage's major works was ${works[0]}.`, "5vmin", false, true);
            } else if (works.length > 1) {
                showCustomAlert(`This sage's background was ${correctAnswer.background}.<br><br>One of this sage's major works was ${works[1]}.`, "5vmin", false, true);
            } else {
                showCustomAlert(`This sage's background was ${correctAnswer.background}.<br><br>No more hints are available.`, "5vmin", false, true);
            }
        } else {
            showCustomAlert(`This sage's background was ${correctAnswer.background}.<br><br>No more hints are available.`, "5vmin", false, true);
        }
        hints += 1;
    }
}

function handleSuggestionClick() {
    if (isRevealRunning) return;

    const suggestionDiv = document.getElementById('suggestion');
    if (!suggestionDiv) return;

    const suggestedName = suggestionDiv.getAttribute('data-suggestion');
    const suggestedMarker = pickMarkerByName(markers, suggestedName);

    if (suggestedMarker) {
        evaluateAnswer(correctAnswer, suggestedMarker);
    }

    suggestionDiv.style.visibility = "hidden";
    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.value = "";
    }
}

function handleEnter(event) {
    if (event.key !== 'Enter') return;
    if (!gameReady || isRevealRunning) return;

    const guess = pickMarkerByName(markers, this.value);

    if (guess !== null) {
        this.value = "";
        const suggestion = document.getElementById('suggestion');
        if (suggestion) {
            suggestion.style.visibility = "hidden";
        }

        evaluateAnswer(correctAnswer, guess);
    }
}

function handleMouseOut(event) {
    if (event.target.classList.contains('popup-button')) {
        const popup = document.getElementById('popup');
        if (popup) {
            popup.classList.remove('visible');
        }
    }
}

window.restartGame = async function() {
    if (markers.length === 0 || isRevealRunning) {
        return;
    }

    showCustomAlert('Loading new game...', "5vmin", false, false);

    const circleContainer = document.querySelector(".circle-container");
    if (circleContainer) {
        for (let circle of circleContainer.children) {
            circle.style.backgroundColor = "";
            circle.classList.remove('popup-button');
            delete circle.dataset.message;
        }
    }

    const suggestionsList = document.getElementById('search-results');
    const items = suggestionsList.querySelectorAll('li');
    items.forEach(li => {
        li.addEventListener('click', handleSearchResultClick);
    });

    setRingColor('ring1', [], [], 'var(--paper)');
    setRingColor('ring2', [], [], 'lightgray');

    document.querySelectorAll(".timeline-rectangle").forEach(div => div.remove());
    document.querySelectorAll(".mapboxgl-marker").forEach(div => div.remove());

    await startNewGame();
    hideCustomAlert();

    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.addEventListener('keypress', handleEnter);
    }
};

function createCircles(container, numCircles) {
    if (!container) {
        console.error('Circle container not found');
        return;
    }

    container.innerHTML = "";

    for (let i = 1; i <= numCircles; i++) {
        const circle = document.createElement("div");
        circle.classList.add("circle");
        circle.textContent = i;
        circle.id = "circle" + i;
        container.appendChild(circle);
    }
}

function setRingColor(ringId, greens, reds, baseColor = "white") {
    const greensSet = new Set(greens);
    const redsSet = new Set(reds);

    const colorsDict = {
        'empty': [baseColor, '0deg 15deg'],
        'Tanach': [baseColor, '15deg 45deg'],
        'Talmud': [baseColor, '45deg 75deg'],
        'Halacha': [baseColor, '75deg 105deg'],
        'Responsa': [baseColor, '105deg 135deg'],
        'Kabbalah': [baseColor, '135deg 165deg'],
        'Chassidus': [baseColor, '165deg 195deg'],
        'Mussar': [baseColor, '195deg 225deg'],
        'Philosophy': [baseColor, '225deg 255deg'],
        'Linguistics': [baseColor, '255deg 285deg'],
        'Poetry': [baseColor, '285deg 315deg'],
        'History': [baseColor, '315deg 345deg'],
        'empty-end': [baseColor, '345deg 360deg']
    };

    for (let key in colorsDict) {
        const checkKey = key === 'empty-end' ? 'empty' : key;
        if (greensSet.has(checkKey)) {
            colorsDict[key][0] = '#AEF359';
        }
    }

    for (let key in colorsDict) {
        const checkKey = key === 'empty-end' ? 'empty' : key;
        if (redsSet.has(checkKey)) {
            colorsDict[key][0] = 'rgb(255, 182, 193)';
        }
    }

    const gradientString = 'conic-gradient(' + Object.values(colorsDict).map(colorArray => {
        const color = colorArray[0];
        const angle = colorArray[1];
        return `${color} ${angle}`;
    }).join(', ') + ')';

    const ring = document.getElementById(ringId);
    if (ring) {
        ring.style.background = gradientString;
    }
}

function extractRingColor(ringId, colorToFind) {
    const list = ['empty', 'Tanach', 'Talmud', 'Halacha', 'Responsa', 'Kabbalah', 'Chassidus', 'Mussar', 'Philosophy', 'Linguistics', 'Poetry', 'History', 'empty-end'];
    const ring = document.getElementById(ringId);

    if (!ring || !ring.style.background) {
        return [];
    }

    const gradientString = ring.style.background;
    const colorRegex = /rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)|lightgray/g;
    const colors = gradientString.match(colorRegex);

    if (!colors) return [];

    const filteredColors = colors.filter((_, index) => index % 2 === 0);
    const indices = [];

    filteredColors.forEach((color, index) => {
        if (color.includes(colorToFind)) {
            indices.push(index);
        }
    });

    return indices.map(index => list[index]);
}

function yearToPercentage(year) {
    return ((((year - 900) / 1100) * 90) + 5);
}

function createRectangle(birthYear, passingYear, color, height, name) {
    const rectangles = document.querySelectorAll('.timeline-rectangle');
    rectangles.forEach(rectangle => {
        rectangle.classList.remove('animate');
    });

    const timelineContainer = document.querySelector('#timeline-container');
    if (!timelineContainer) {
        console.error('Timeline container not found');
        return null;
    }

    const rectangle = document.createElement('div');
    rectangle.classList.add('timeline-rectangle', 'animate', 'reveal-enter');

    const startLeft = yearToPercentage(birthYear) + '%';
    const width = (yearToPercentage(passingYear) - yearToPercentage(birthYear)) + '%';

    rectangle.style.left = startLeft;
    rectangle.style.width = width;
    rectangle.style.backgroundColor = color;
    rectangle.style.height = height;
    rectangle.classList.add('popup-button');
    rectangle.dataset.message = `<strong>${name}</strong>: ${birthYear} - ${passingYear}`;

    timelineContainer.appendChild(rectangle);

    setTimeout(() => {
        rectangle.classList.remove('reveal-enter');
    }, 720);

    return rectangle;
}

function calculateDistance(person1, person2) {
    return Math.sqrt(
        Math.pow(person1.city_of_passing.longitude - person2.city_of_passing.longitude, 2) +
        Math.pow(person1.city_of_passing.latitude - person2.city_of_passing.latitude, 2)
    );
}

function pickMarkerByName(markersList, name) {
    const searchName = name.toLowerCase();
    let marker = null;

    if (searchName !== 'nan' && searchName !== '') {
        marker = markersList.find(marker =>
            marker.person.toLowerCase() === searchName ||
            marker.name.toLowerCase() === searchName ||
            marker.aka.split(',').some(aka => aka.trim().toLowerCase() === searchName)
        ) || null;
    }

    if (marker === null && searchName !== '') {
        const suggestion = suggestAlternative(searchName, uniqueNames);
        const suggestionDiv = document.getElementById('suggestion');

        if (suggestionDiv) {
            suggestionDiv.textContent = 'Did you mean ' + capitalizeWords(suggestion) + '?';
            suggestionDiv.setAttribute('data-suggestion', suggestion);
            suggestionDiv.style.visibility = 'visible';
        }
    }

    return marker;
}

const colors = [
  '#2b2a58',
  '#3a3b74',
  '#54579a',
  '#7a7fb8',
  '#a8add3',
  'rgba(255, 248, 230, 0.88)',
  '#e1b3a6',
  '#d59482',
  '#c87863',
  '#b85f4b',
  '#9f4738'
];

const bins = [
    [90,160.22],[36.05, 89.99], [27.70, 36.04], [22.58, 27.69],
    [18.48, 22.57], [14.99, 18.47], [11.80, 14.98], [8.74, 11.79], [6.20, 8.73],
    [3.84, 6.19], [0, 3.83]
];

function getColorByDistance(value) {
    for (let i = 0; i < bins.length; i++) {
        const [min, max] = bins[i];
        if (value >= min && value <= max) {
            return colors[i];
        }
    }
    return '#000000';
}

function getColorByPercentage(percentage) {
    if (percentage < 0 || percentage > 1) {
        throw new Error("Percentage must be between 0 and 1.");
    }

    const index = Math.min(Math.floor(percentage * colors.length), colors.length - 1);
    return colors[index];
}

async function revealTimelineStep(currentAnswer, timelineColor, timelineHeight) {
    updateRevealStatus(`When · ${currentAnswer.birth}–${currentAnswer.passing}`);
    focusOnePanel(timelinePanel);
    createRectangle(
        currentAnswer.birth,
        currentAnswer.passing,
        timelineColor,
        timelineHeight,
        currentAnswer.person
    );
    await sleep(650);
    await sleep(500);
}

async function revealMapStep(correctAnswer, currentAnswer) {
    updateRevealStatus(`Where · ${currentAnswer.city_of_passing.city}, ${currentAnswer.city_of_passing.country}`);
    focusOnePanel(mapPanel);

    const mapMarkers = document.querySelectorAll('.mapboxgl-marker');
    mapMarkers.forEach(marker => marker.classList.remove('animate'));

    if (typeof mapboxgl !== 'undefined' && window.map) {
        window.map.flyTo({
            center: [currentAnswer.city_of_passing.longitude, currentAnswer.city_of_passing.latitude],
            duration: 1200,
            essential: true,
            zoom: 2
        });
    }

    await sleep(950);

    const markerElement = document.createElement('div');
    markerElement.style.background = getColorByDistance(calculateDistance(correctAnswer, currentAnswer));
    markerElement.style.border = '2px solid black';
    markerElement.style.width = '30px';
    markerElement.style.height = '30px';
    markerElement.classList.add('popup-button');
    markerElement.dataset.message = `<strong>${currentAnswer.person}</strong>: ${currentAnswer.city_of_passing.city}, ${currentAnswer.city_of_passing.country}`;

    if (typeof mapboxgl !== 'undefined' && window.map) {
        new mapboxgl.Marker({ element: markerElement })
            .setLngLat([currentAnswer.city_of_passing.longitude, currentAnswer.city_of_passing.latitude])
            .addTo(window.map);
    }

    await sleep(700);
    await sleep(450);
}

async function revealWheelStep(correctAnswer, currentAnswer) {
    updateRevealStatus(`What · ${currentAnswer.expertise}`);
    focusOnePanel(wheelPanel);

    const guessLabel = document.getElementById('guessLabel');
    if (
        guessLabel &&
        currentAnswer.person.trim().toLowerCase() !== correctAnswer.person.trim().toLowerCase()
    ) {
        guessLabel.textContent = currentAnswer.person;
    }

    const currentExpertise = normalizeExpertiseArray(currentAnswer.expertise);
    const normalizedCorrectExpertise = normalizeExpertiseArray(correctAnswer.expertise);

    // Stage 1: guessed sage's outer ring
    setRingColor('ring1', currentExpertise, [], 'white');
    pulseRing('ring1');
    await sleep(800);

    // Stage 2: mystery ring resolves
    let redsExisting = extractRingColor('ring2', 'rgb(255, 182, 193)');
    let greensExisting = extractRingColor('ring2', 'rgb(174, 243, 89)');

    currentExpertise.forEach(expertise => {
        if (normalizedCorrectExpertise.includes(expertise)) {
            greensExisting.push(expertise);
        } else {
            redsExisting.push(expertise);
        }
    });

    setRingColor('ring2', greensExisting, redsExisting, 'lightgray');
    pulseRing('ring2');
    await sleep(850);
    await sleep(500);
}

async function evaluateAnswer(correctAnswerArg, currentAnswer, guess = true) {
    if (isRevealRunning || !correctAnswerArg || !currentAnswer) {
        return;
    }

    const normalizedCorrectAnswer = {
        ...correctAnswerArg,
        expertise: normalizeExpertiseArray(correctAnswerArg.expertise)
    };

    const normalizedCurrentAnswer = {
        ...currentAnswer,
        expertise: normalizeExpertiseArray(currentAnswer.expertise)
    };

    if (
        guess &&
        normalizedCurrentAnswer.person.trim().toLowerCase() !== normalizedCorrectAnswer.person.trim().toLowerCase() &&
        wrongGuesses.some(guess => guess.person.trim().toLowerCase() === normalizedCurrentAnswer.person.trim().toLowerCase())
    ) {
        showCustomAlert('You already guessed ' + normalizedCurrentAnswer.person + '. Try again.', "5vmin", false);
        return;
    }

    isRevealRunning = true;
    gameReady = false;

    try {
        beginReveal(`Processing ${normalizedCurrentAnswer.person}...`);
        await sleep(220);

        const correctMidpoint = (normalizedCorrectAnswer.birth + normalizedCorrectAnswer.passing) / 2;
        const guessMidpoint = (normalizedCurrentAnswer.birth + normalizedCurrentAnswer.passing) / 2;
        const offBy = Math.abs(correctMidpoint - guessMidpoint);
        const percentage = (1100 - offBy) / 1100;

        const timelineColor = getColorByPercentage(percentage);
        const timelineHeight = percentage * 80 + '%';

        await revealTimelineStep(normalizedCurrentAnswer, timelineColor, timelineHeight);
        await sleep(150);

        await revealMapStep(normalizedCorrectAnswer, normalizedCurrentAnswer);
        await sleep(160);

        await revealWheelStep(normalizedCorrectAnswer, normalizedCurrentAnswer);
        await sleep(180);

        clearPanelFocus();

        const isCorrect =
            normalizedCurrentAnswer.person.trim().toLowerCase() ===
            normalizedCorrectAnswer.person.trim().toLowerCase();

        if (isCorrect) {
            if (guess) {
                const rightCircle = document.getElementById('circle' + (wrongGuessesNum + 1));
                if (rightCircle) {
                    rightCircle.style.backgroundColor = '#6f8f4a';
                    rightCircle.classList.add('popup-button');
                    rightCircle.dataset.message = `<strong>${normalizedCurrentAnswer.person}</strong>`;
                }

                await trackGuess(normalizedCurrentAnswer.person, true, wrongGuessesNum + 1, gameId);

                await updateGameResult(gameId, true, wrongGuessesNum + 1).catch(err => {
                    console.error('Failed to update game result:', err);
                });

                const cheerSound = document.getElementById('cheer-sound');
                if (cheerSound) {
                    cheerSound.play();
                }

                const solvedNumber = await countSolvedGames();
                maybeShowCongrats(solvedNumber);

                showCustomAlert(
                    `Well done! 🎉<br> The correct answer is ${normalizedCorrectAnswer.person}. <br>
                    (${normalizedCorrectAnswer.birth} - ${normalizedCorrectAnswer.passing})${normalizedCorrectAnswer.biography ? ` <br> <span style="font-size: 3vmin;">${normalizedCorrectAnswer.biography}</span>` : ''}`,
                    "2.5vmin",
                    true,
                    true
                );
            } else {
                showCustomAlert(
                    `The correct answer is ${normalizedCorrectAnswer.person}. <br>
                    (${normalizedCorrectAnswer.birth} - ${normalizedCorrectAnswer.passing})${normalizedCorrectAnswer.biography ? ` <br> <span style="font-size: 3vmin;">${normalizedCorrectAnswer.biography}</span>` : ''}`,
                    "2.5vmin",
                    true,
                    true
                );
            }

            finishGame(normalizedCorrectAnswer);
            return;
        }

        wrongGuessesNum += 1;
        wrongGuesses.push(normalizedCurrentAnswer);

        await trackGuess(normalizedCurrentAnswer.person, false, wrongGuessesNum, gameId);

        const wrongCircle = document.getElementById('circle' + wrongGuessesNum);
        if (wrongCircle) {
            wrongCircle.style.backgroundColor = '#a9443b';
            wrongCircle.classList.add('popup-button');
            wrongCircle.dataset.message = `<strong>${normalizedCurrentAnswer.person}</strong>`;
        }

        if (wrongGuessesNum === maxGuesses) {
            updateGameResult(gameId, false, wrongGuessesNum).catch(err => {
                console.error('Failed to update game result:', err);
            });

            setTimeout(() => {
                evaluateAnswer(normalizedCorrectAnswer, normalizedCorrectAnswer, false);
            }, 500);
        }

    } finally {
        endReveal();
        isRevealRunning = false;
        if (!document.getElementById('correctLabel')?.classList.contains('clickable')) {
            gameReady = true;
        }
    }
}

function finishGame(finalCorrectAnswer) {
    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.removeEventListener('keypress', handleEnter);
    }

    const correctLabel = document.getElementById('correctLabel');
    if (correctLabel) {
        correctLabel.textContent = finalCorrectAnswer.person;
        correctLabel.classList.add('clickable');
    }

    const guessLabel = document.getElementById('guessLabel');
    if (guessLabel) {
        guessLabel.textContent = '';
    }

    const suggestionsList = document.getElementById('search-results');
    const items = suggestionsList.querySelectorAll('li');

    items.forEach(li => {
        li.removeEventListener('click', handleSearchResultClick);
    });

    gameReady = false;
}

const congratsMessages = {
  1: 'Congratulations on your first win',
  10: 'This is your 10th win. Well done.'
};

function maybeShowCongrats(answer) {
    const message = congratsMessages[answer];
    if (!message) return;

    const toast = document.getElementById('toast-overlay');
    const text = document.getElementById('toast-text');

    text.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
}

document.addEventListener('DOMContentLoaded', async function() {
    await initializeGame();
});

function enableMusic() {
    const music = document.getElementById('song');
    if (!music) return;

    music.play().catch(() => {});

    document.removeEventListener('click', enableMusic);
    document.removeEventListener('keydown', enableMusic);
    document.removeEventListener('touchstart', enableMusic);
    document.removeEventListener('mousedown', enableMusic);
}

document.addEventListener('click', enableMusic);
document.addEventListener('keydown', enableMusic);
document.addEventListener('touchstart', enableMusic);
document.addEventListener('mousedown', enableMusic);

window.initializeGame = initializeGame;