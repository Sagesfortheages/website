import { loadAllSages } from './supabase/sagesWithNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';



// Global variables
let markers = []; // Will be populated from database
let uniqueNames = []; // Will be populated from markers
let correctAnswer = null;
let wrongGuessesNum = 0;
let wrongGuesses = [];
let hints = 0;
const infoText = `Your goal is to guess the unknown sage. <br><br> Get more clues by guessing sages in the guess bar.<br><br>Each sage you guess will have a place of passing, areas of focus and a place in the timeline.<br><br>The closer your guess's place of passing is to the mystery sage's place of passing, the hotter it will glow.<br><br>Similarly, the closer your guess's spot in the timeline to the mystery sage's place in the timeline.<br><br> There is also a wheel of focus. Each time you guess a sage, his/her name will appear on the outside of the wheel, along with that guess's areas of focus. If an area of a focus of a guess aligns with one of the mystery sage's, the inner wheel will glow green. If it doesn't align, the inner wheel will glow red.<br><br>Click on the question mark to see the answer.<br><br>You have 12 guesses.<br><br> Good luck!`
const maxGuesses = 12;
const difficultyLevel = JSON.parse(sessionStorage.getItem('difficulty')) || 'medium';
const scale = { 'Very Easy': 1, 'Easy': 2, 'Medium': 3, 'Hard': 4, 'Very Hard': 5 };
const maxDifficulty = scale[difficultyLevel] ?? 5;
console.log(difficultyLevel)

document.getElementById('info-button').addEventListener('click', function () {
    showCustomAlert(infoText, '2.25vmin');
})

window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

async function fetchMarkersFromDatabase() {
    try {
        // Load all sages from Supabase
        const allMarkers = await loadAllSages();

        if (!allMarkers || allMarkers.length === 0) {
            console.warn("No markers found in database");
            return [];
        }
        
        await loadMusic(supabaseClient, "climb_city_morning.mp3");

        // Filter by difficulty
        markers = allMarkers.filter(sage => sage.difficulty <= maxDifficulty).filter(sage => sage.expertise.length > 0);

        console.log(`Fetched ${markers.length} markers from Supabase (difficulty <= ${maxDifficulty})`);

        return markers;

    } catch (error) {
        console.error('Error loading markers from Supabase:', error);
    }
}

function processMarkersData(markersData) {
    // Process and validate markers data
    const processedMarkers = markersData.map(marker => {
        // Ensure expertise is an array
        if (typeof marker.expertise === 'string') {
            marker.expertise = marker.expertise.split(',').map(item => item.trim());
        } else if (!Array.isArray(marker.expertise)) {
            marker.expertise = [];
        }

        // Set default values for optional fields
        marker.aka = marker.aka || '';
        marker.name = marker.name || marker.person;
        marker.city_of_passing = marker.city_of_passing || 'Unknown';
        marker.country_of_passing = marker.country_of_passing || 'Unknown';
        marker.background = marker.background || '';
        marker.major_works = marker.major_works || '0';
        marker.biography = marker.biography || '';

        // Ensure numeric fields are numbers
        marker.birth = Number(marker.birth) || 0;
        marker.passing = Number(marker.passing) || 0;
        marker.latitude_of_passing = Number(marker.latitude_of_passing) || 0;
        marker.longitude_of_passing = Number(marker.longitude_of_passing) || 0;

        return marker;
    });

    // Generate unique names for suggestions
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

// Game initialization function
async function initializeGame() {
    try {
        // Show loading state
        const circleContainer = document.querySelector(".circle-container");
        if (circleContainer) {
            circleContainer.innerHTML = '<div>Loading game data...</div>';
        }

        // Fetch markers from database
        const markersData = await fetchMarkersFromDatabase();
        
        if (markersData.length === 0) {
            throw new Error('No markers data available');
        }

        // Process the data
        markers = processMarkersData(markersData);
        
        // Initialize game UI
        setupGameUI();
        
        // Start the game
        startNewGame();
        
        console.log('Game initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
        
        // Show error to user
        const circleContainer = document.querySelector(".circle-container");
        if (circleContainer) {
            circleContainer.innerHTML = `
                <div style="color: red; text-align: center;">
                    <p>Failed to load game. Please refresh the page to try again.</p>
                    <button onclick="initializeGame()" style="margin-top: 10px;">Retry</button>
                </div>
            `;
        }
    }
    const page = await trackPageView();
    if(page.isFirstVisit) {
        showCustomAlert(infoText, '2.0vmin')
    }
}

function setupGameUI() {
    // Initialize focus wheels
    setRingColor('ring1', [], [], 'white');
    setRingColor('ring2', [], [], 'lightgray');

    // Get the container for circles and create them
    const circleContainer = document.querySelector(".circle-container");
    createCircles(circleContainer, maxGuesses);

    // Setup suggestions list
    setupSuggestionsList();
    
    // Setup event listeners
    setupEventListeners();
}

function handleSearchResultClick(e) {
    const li = e.currentTarget;
    evaluateAnswer(correctAnswer, li._result);
}

function setupSuggestionsList() {
    const suggestionsList = document.getElementById('search-results');
    if (!suggestionsList) return;

    // Clear existing suggestions
    suggestionsList.innerHTML = '';

    // Get unique people and sort them
    const allPeople = [...new Map(markers.map(item => [item['person'], item])).values()];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));

    // Display suggestions
    allPeople.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.person;
        li._result = result;   // or use dataset (see below)
        li.addEventListener('click', handleSearchResultClick);
        suggestionsList.appendChild(li);
    });

    
}

function setupEventListeners() {
    // Restart button
    const restartButton = document.getElementById('restart-button-main');
    if (restartButton) {
        restartButton.addEventListener('click', function() {
            hideCustomAlert();
            restartGame();
        });
    }

    // Hint button
    const hintButton = document.getElementById('hint-button');
    if (hintButton) {
        hintButton.addEventListener('click', handleHintClick);
    }

    // Text input
    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.addEventListener('keypress', handleEnter);
    }

    // Correct label click
    const correctLabel = document.getElementById('correctLabel');
    if (correctLabel) {
        correctLabel.addEventListener('click', function() {
            if (this.textContent.includes('?')) {
                evaluateAnswer(correctAnswer, correctAnswer, false);
            } else {
                linkToProfile(correctAnswer);
            }
        });
    }

    // Suggestion click
    const suggestion = document.getElementById('suggestion');
    if (suggestion) {
        suggestion.addEventListener('click', handleSuggestionClick);
    }

    // Popup events
    document.addEventListener('mouseover', handleHoverPopup);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseout', handleMouseOut);
}

function startNewGame() {
    if (markers.length === 0) {
        console.error('No markers available to start game');
        return;
    }

    // Pick a random marker based on difficulty
    correctAnswer = pickRandomMarker(markers, difficultyLevel);
    correctAnswer.expertise = correctAnswer.expertise.map(obj => obj.expertise)
    
    if (!correctAnswer) {
        console.error('Failed to pick random marker');
        return;
    }

    // Reset game state
    wrongGuessesNum = 0;
    wrongGuesses = [];
    hints = 0;

    // Reset UI
    const correctLabel = document.getElementById('correctLabel');
    if (correctLabel) {
        correctLabel.textContent = '';
        correctLabel.innerHTML += '<button>?</button>';
        correctLabel.classList.remove('clickable');
    }

    const guessLabel = document.getElementById('guessLabel');
    if (guessLabel) {
        guessLabel.textContent = '';
    }

    console.log('New game started with:', correctAnswer.person);
}

// Event handlers
function handleHintClick() {
    if (!correctAnswer) return;

    if (hints < 1) {
        showCustomAlert(`This sage's background was ${correctAnswer.background}.`, "5vmin", false, true);
        hints += 1;
    } else if (hints < 2) {
        if (correctAnswer.major_works != '0') {
            const works = correctAnswer.major_works.split(',');
            if (works[0] != correctAnswer.person && !correctAnswer.aka.split(',')[0].includes(works[0])) {
                showCustomAlert(`This sage's background was ${correctAnswer.background}.<br><br>One of this sage's major works was ${works[0]}.`, fontSize="5vmin", restartButtonOn=false, true);
            } else if (works.length > 1) {
                showCustomAlert(`This sage's background was ${correctAnswer.background}.<br><br>One of this sage's major works was ${works[1]}.`, fontSize="5vmin", restartButtonOn=false, true);
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
    const suggestionDiv = document.getElementById('suggestion');
    if (!suggestionDiv) return;

    const suggestedName = suggestionDiv.getAttribute('data-suggestion');
    const suggestedMarker = pickMarkerByName(markers, suggestedName);
    
    if (suggestedMarker) {
        evaluateAnswer(correctAnswer, suggestedMarker);
    }
    
    // Clear suggestion and textbox
    suggestionDiv.style.visibility = "hidden";
    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.value = "";
    }
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        const guess = pickMarkerByName(markers, this.value);
    
        if (guess !== null) {
            // Clear textbox and suggestion if valid guess
            this.value = "";
            const suggestion = document.getElementById('suggestion');
            if (suggestion) {
                suggestion.style.visibility = "hidden";
            }
            
            evaluateAnswer(correctAnswer, guess);
        }
    }
}

function handleMouseMove(event) {
    const popup = document.getElementById('popup');
    if (popup) {
        popup.style.left = event.pageX + 10 + "px";
        popup.style.top = event.pageY - 28 + "px";
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

window.restartGame = function() {
    if (markers.length === 0) {
        console.error('No markers available for restart');
        return;
    }

    const circleContainer = document.querySelector(".circle-container");
    
    // Reset circles
    if (circleContainer) {
        for (let circle of circleContainer.children) {
            circle.style.backgroundColor = "";
            if (circle.classList.contains('popup-button')) {
                circle.classList.remove('popup-button');
            }
        }
    }

    const suggestionsList = document.getElementById('search-results');
    const items = suggestionsList.querySelectorAll('li');

    items.forEach(li => {
        li.addEventListener('click', handleSearchResultClick);
    });

    // Clear focus wheels
    setRingColor('ring1', [], [], 'white');
    setRingColor('ring2', [], [], 'lightgray');
    
    // Remove rectangles and markers
    document.querySelectorAll(".timeline-rectangle").forEach(div => div.remove());
    document.querySelectorAll(".mapboxgl-marker").forEach(div => div.remove());

    // Start new game
    startNewGame();
    
    // Re-enable textbox event listener
    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.addEventListener('keypress', handleEnter);
    }
}

// Modified existing functions to work with database data

function createCircles(container, numCircles) {
    if (!container) {
        console.error('Circle container not found');
        return;
    }

    // Clear existing circles
    container.innerHTML = "";

    for (let i = 1; i <= numCircles; i++) {
        // Create a circle div
        const circle = document.createElement("div");
        circle.classList.add("circle");
        circle.textContent = i; // Add number to circle
        circle.id = "circle" + i; // Add id to circle

        // Append circle to container
        container.appendChild(circle);
    }
}

function setRingColor(ringId, greens, reds, baseColor = "white") {
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
        if (greens.includes(checkKey)) {
            colorsDict[key][0] = '#AEF359';
        }
    }

    for (let key in colorsDict) {
        const checkKey = key === 'empty-end' ? 'empty' : key;
        if (reds.includes(checkKey)) {
            colorsDict[key][0] = 'rgb(255, 182, 193)';
        }
    }

    // Rest stays the same...
    const gradientString = 'conic-gradient(' + Object.values(colorsDict).map(colorArray => {
        const color = colorArray[0];
        const angle = colorArray[1];
        return `${color} ${angle}`;
    }).join(', ') + ')';

    console.log(gradientString)

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
        if (rectangle.classList.contains('animate')) {
            rectangle.classList.remove('animate');
        }
    });

    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) {
        console.error('Timeline container not found');
        return;
    }

    const rectangle = document.createElement('div');
    rectangle.classList.add('timeline-rectangle');
    rectangle.classList.add('animate');
    
    const startLeft = yearToPercentage(birthYear) + '%';
    const width = yearToPercentage(passingYear) - yearToPercentage(birthYear) + '%';
    
    rectangle.style.left = startLeft;
    rectangle.style.width = width;
    rectangle.style.backgroundColor = color;
    rectangle.style.height = height;
    rectangle.classList.add('popup-button');
    rectangle.dataset.message = `<strong>${name}</strong>: ${birthYear} - ${passingYear}`;

    timelineContainer.appendChild(rectangle);
}

function calculateDistance(person1, person2) {
    return Math.sqrt(Math.pow(person1.city_of_passing.longitude - person2.city_of_passing.longitude, 2) + 
                    Math.pow(person1.city_of_passing.latitude - person2.city_of_passing.latitude, 2));
}

function pickMarkerByName(markers, name) {
    const searchName = name.toLowerCase();
    let marker = null;

    if (searchName !== 'nan' && searchName !== '') {
        marker = markers.find(marker => 
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

// Define colors and bins (keeping existing color logic)

const colors = [
  '#2222CC',
  '#4444FF',
  '#8888FF',
  '#AAAAFF',
  '#CCCCFF',
  '#FFFFFF',
  '#FFCCCC',
  '#FF8888',
  '#FF6666',
  '#FF4444',
  '#FF0000'
]

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

function evaluateAnswer(correctAnswer, currentAnswer, guess = true) {
    console.log(currentAnswer)
    if (!correctAnswer || !currentAnswer) {
        console.error('Missing answer data');
        return;
    }

    // Calculate and display results
    const correctMidpoint = (correctAnswer.birth + correctAnswer.passing) / 2;
    const guessMidpoint = (currentAnswer.birth + currentAnswer.passing) / 2;
    const offBy = Math.abs(correctMidpoint - guessMidpoint);
    const percentage = (1100 - offBy) / 1100;

    // Create timeline rectangle
    createRectangle(currentAnswer.birth, currentAnswer.passing, getColorByPercentage(percentage), 
        percentage * 80 + '%', currentAnswer.person);

    // Update focus wheel labels and colors
    const guessLabel = document.getElementById('guessLabel');
    if (guessLabel && currentAnswer.person.trim().toLowerCase() !== correctAnswer.person.trim().toLowerCase()) {
        guessLabel.textContent = currentAnswer.person;
    }
    let currentExpertise = currentAnswer.expertise.map(obj => obj.expertise)

    setRingColor('ring1', currentExpertise, 'white');
    console.log(currentAnswer.expertise);

    // Update mystery ring colors
    let redsExisting = extractRingColor('ring2', 'rgb(255, 182, 193)');
    let greensExisting = extractRingColor('ring2', 'rgb(174, 243, 89)');
    
    
    for (let expertise of currentExpertise) {
        if (!correctAnswer.expertise.includes(expertise)) {
            console.log(expertise)
            redsExisting.push(expertise);
            console.log(redsExisting)
        } else {
            greensExisting.push(expertise);
            console.log(expertise)
            console.log(greensExisting)
        }
    }

    setRingColor('ring2', greensExisting, redsExisting, 'lightgray');

    // Update map markers
    const markers = document.querySelectorAll('.mapboxgl-marker');
    markers.forEach(marker => {
        if (marker.classList.contains('animate')) {
            marker.classList.remove('animate');
        }
    });
    
    // Create new map marker
    const markerElement = document.createElement('div');
    markerElement.style.background = getColorByDistance(calculateDistance(correctAnswer, currentAnswer));
    markerElement.style.border = '2px solid black';
    markerElement.style.width = '30px';
    markerElement.style.height = '30px';
    markerElement.classList.add('animate');
    markerElement.classList.add('popup-button');
    console.log(currentAnswer)
    markerElement.dataset.message = `<strong>${currentAnswer.person}</strong>: ${currentAnswer.city_of_passing.city}, ${currentAnswer.city_of_passing.country}`;
    
    // Assuming mapboxgl and map are available globally
    if (typeof mapboxgl !== 'undefined' && window.map) {
        new mapboxgl.Marker({ element: markerElement })
            .setLngLat([currentAnswer.city_of_passing.longitude, currentAnswer.city_of_passing.latitude])
            .addTo(window.map);
    }

    // Check if the guess is correct
    if (currentAnswer.person.trim().toLowerCase() === correctAnswer.person.trim().toLowerCase()) {
        if (guess) {
            const rightCircle = document.getElementById('circle' + (wrongGuessesNum + 1));
            if (rightCircle) {
                rightCircle.style.backgroundColor = 'green';
                rightCircle.classList.add('popup-button');
                rightCircle.dataset.message = `<strong>${currentAnswer.person}</strong>`;
            }
            
            const cheerSound = document.getElementById('cheer-sound');
            if (cheerSound) {
                cheerSound.play();
            }
            
            showCustomAlert(`Well done! 🎉<br> The correct answer is ${correctAnswer.person}. <br> 
            (${correctAnswer.birth} - ${correctAnswer.passing})${correctAnswer.biography ? ` <br> <span style="font-size: 3vmin;">${correctAnswer.biography}</span>` : ''}`);
        } else {
            showCustomAlert(`The correct answer is ${correctAnswer.person}. <br> 
            (${correctAnswer.birth} - ${correctAnswer.passing})${correctAnswer.biography ? ` <br> <span style="font-size: 3vmin;">${correctAnswer.biography}</span>` : ''}`);
        }

        finishGame(correctAnswer);
        return;
    }

    // Check if already guessed
    if (wrongGuesses.includes(currentAnswer)) {
        showCustomAlert('You already guessed ' + currentAnswer.person + '. Try again.', "5vmin", false);
        return;
    }

    // Wrong guess
    wrongGuessesNum += 1;
    wrongGuesses.push(currentAnswer);
    
    const wrongCircle = document.getElementById('circle' + wrongGuessesNum);
    if (wrongCircle) {
        wrongCircle.style.backgroundColor = 'red';
        wrongCircle.classList.add('popup-button');
        wrongCircle.dataset.message = `<strong>${currentAnswer.person}</strong>`;
    }

    

    // Check if max guesses reached
    if (wrongGuessesNum === maxGuesses) {
        setTimeout(() => {
            evaluateAnswer(correctAnswer, correctAnswer, guess=false);
        }, 500);
    }
}

function finishGame(correctAnswer) {
    // Remove event listener
    const textbox = document.getElementById('textbox');
    if (textbox) {
        textbox.removeEventListener('keypress', handleEnter);
    }

    // Label focus wheel
    const correctLabel = document.getElementById('correctLabel');
    if (correctLabel) {
        correctLabel.textContent = correctAnswer.person;
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
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing game...');
    initializeGame();
});


// 🔊 audio unlock lives OUTSIDE DOMContentLoaded
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

// Also provide a manual initialization function
window.initializeGame = initializeGame;