import { getTour, getTourSages } from '../supabase/tour.js';
import { trackPageView } from '../supabase/supabaseFunctions.js';

const TOUR_NAME = 'Major Chumash Commentaries';

document.getElementById('name-content').innerHTML = 'Tour of Major Chumash Commentaries';

// Track if we're currently in a pause
let isPaused = false;
let playInterval = null;
let videoSpeed = 3;
let frameSpeed = 500;

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


    pauses = result.data || [];


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

// Function to start playing the timeline
function startPlaying(videoSpeed, pauses) {
  clearInterval(playInterval);
  frameSpeed = 200 / videoSpeed;

  playInterval = setInterval(() => {
    if (isPaused) return;

    const slider = document.getElementById('year-slider');
    const currentValue = parseInt(slider.noUiSlider.get(), 10);
    const newValue = currentValue + 1;

    const pauseInfo = pauses.find(pause => Number(pause.year) === newValue);

    if (pauseInfo) {
      slider.noUiSlider.set(newValue);
      displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople, false, true);

      displayPauseInfo(pauseInfo);

      isPaused = true;

      setTimeout(() => {
        isPaused = false;
      }, Number(pauseInfo.duration) + 500);
    } else {
      document.getElementById('icon-space').innerHTML = '';
      document.getElementById('name-content').innerHTML = '';
      slider.noUiSlider.set(newValue);
      displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople, false, true);
    }
  }, frameSpeed);
}

// Function to stop playing
function stopPlaying() {
  clearInterval(playInterval);
  playInterval = null;
}

// Initialize the year slider
const yearSlider = document.getElementById('year-slider');



// Popup hover setup
window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

document.addEventListener('mouseover', handleHoverPopup);

document.addEventListener('mousemove', event => {
  popup.style.left = event.pageX + 10 + 'px';
  popup.style.top = event.pageY - 28 + 'px';
});

document.addEventListener('mouseout', event => {
  if (event.target.classList.contains('popup-button')) {
    popup.classList.remove('visible');
  }
});

// Play button event
window.playButton = document.getElementById('play-button');
playButton.disabled = true;

playButton.addEventListener('click', () => {
  if (!playButton.checked) {
    if (pauses.length === 0) {
      console.warn('No pauses loaded yet! Please wait for data.');
      return;
    }

    if (markers.length === 0) {
      console.warn('No markers loaded yet! Please wait for data.');
      return;
    }

    playButton.checked = true;
    playButton.classList.add('paused');
    startPlaying(videoSpeed, pauses);
  } else {
    playButton.checked = false;
    playButton.classList.remove('paused');
    stopPlaying();
  }
});

// Next button event
const nextButton = document.getElementById('next-button');

nextButton.addEventListener('click', () => {
//   const course = [
//     'Alter Rebbe',
//     'Mitteler Rebbe',
//     'Rebbe Tzemach Tzedek',
//     'Rebbe Maharash',
//     'Rebbe Rashab',
//     'Frierdiker Rebbe',
//     'Lubavitcher Rebbe',
//     '__TEST__'
//   ];

  const encodedCourse = encodeURIComponent(JSON.stringify(sages));
  const encodedSelected = encodeURIComponent(JSON.stringify({ person: sages[0] }));

  const url = `../discover.html?course=${encodedCourse}&courseIndex=0&selected=${encodedSelected}&courseModeActive=true`;

  window.location.href = url;
});

// Full page initialization
async function initializeTourPage() {
  try {
    console.log('Initializing tour page...');

    trackPageView(TOUR_NAME);

    const [tourSagesResult, pausesResult] = await Promise.all([
      loadTour(),
      fetchPauses()
    ]);

    const { min, max } = getYearRange(markers);

    console.log('Year range:', min, max);

    noUiSlider.create(yearSlider, {
  start: 1044,
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

    playButton.disabled = false;

    console.log('Tour page initialization complete.');
  } catch (err) {
    console.error('Failed during page initialization:', err);
  }
}

document.addEventListener('DOMContentLoaded', initializeTourPage);