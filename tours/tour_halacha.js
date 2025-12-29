import { getTour } from '../supabase/tour.js';
import { trackPageView } from '../supabase/supabaseFunctions.js';

trackPageView('Halacha');

// Track if we're currently in a pause
let isPaused = false;
let playInterval = 1;
let videoSpeed = 1;
let frameSpeed = 200;
let visibleMarkers = [];
let visibleMarkersPeople = [];
let pauses = []; // will be filled by API

// Fetch pauses from API
async function fetchPauses() {
  try {
    // instead of fetch() from Flask, we now call your Supabase function
    const result = await getTour({ tour: "Halacha" });

    // result.data already contains only Chabad rows
    pauses = result.data || [];

    console.log("Pauses loaded:", pauses);

  } catch (err) {
    console.error("Failed to fetch pauses:", err);
  }
}

// Function to start playing
function startPlaying(videoSpeed, pauses) {
    clearInterval(playInterval);
    frameSpeed = 50 / videoSpeed;
    
    playInterval = setInterval(() => {
        if (isPaused) return;
        
        const slider = document.getElementById('year-slider');
        const currentValue = parseInt(slider.noUiSlider.get());
        const newValue = currentValue + 1;
        
        const pauseInfo = pauses.find(pause => pause.year === newValue);
        
        if (pauseInfo) {
            slider.noUiSlider.set(newValue);
            // displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople);
            
            displayPauseInfo(pauseInfo);
            
            isPaused = true;
            
            setTimeout(() => {
                isPaused = false;
            }, pauseInfo.duration+1000);
        } else {
            document.getElementById('icon-space').innerHTML = '';
            document.getElementById('name-content').innerHTML = '';
            slider.noUiSlider.set(newValue);
            // displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople);
        }
    }, frameSpeed);
}

// Function to stop playing
function stopPlaying() {
    clearInterval(playInterval);
}

// Function to filter markers by year during watch animation
function displayMarkersByTimeAnimate(markersData, visibleMarkers, visibleMarkersPeople) {
    const timeValue = document.getElementById('year-slider').noUiSlider.get();
    const currentMarkersData = markersData.filter(marker => marker.from <= timeValue && marker.to >= timeValue);

    currentMarkersData.forEach(marker => {
        marker.fromYear = marker.from == timeValue;
        marker.toYear = marker.to == timeValue;
        marker.birthYear = marker.birth == timeValue;
        marker.passYear = marker.passing == timeValue;
    });

    displayMarkers(currentMarkersData, visibleMarkers);
}

// Initialize the slider
var yearSlider = document.getElementById('year-slider');

noUiSlider.create(yearSlider, {
    start: 1000,
    connect: [true, false],
    range: {
        'min': 1000,
        'max': 2000
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
        values: [1100, 1300, 1500, 1700, 1900],
        density: 10,
        format: {
            to: function (value) {
                return value.toString();
            }
        }
    }
});

// Popup hover
const popup = document.getElementById('popup');
const popupMessage = document.querySelector('.popup-message');

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

// Add event listener to play button
const playButton = document.getElementById('play-button');
playButton.addEventListener('click', () => {
    if (!playButton.checked) {
        if (pauses.length === 0) {
            console.warn("No pauses loaded yet!");
            return;
        }
        playButton.checked = true;
        playButton.classList.add('paused');
        startPlaying(videoSpeed, pauses);
        const song = document.getElementById('song');
        if (song) {
            song.play();
        }
    } else {
        playButton.checked = false;
        playButton.classList.remove('paused');
        stopPlaying();
    }
});

// Fetch pauses once the DOM is ready
document.addEventListener("DOMContentLoaded", fetchPauses);
