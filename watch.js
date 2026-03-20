import { loadAllSagesNames } from './supabase/sagesWithDwellingsNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';


let markers = [];
let visibleMarkers = [];
let visibleMarkersPeople = [];
let playInterval = 1;
let videoSpeed = 1;
let frameSpeed = 200;

const infoText = `Click the play button to see a live visualization of which sages were alive and where they lived at each point in time.<br><br>You can pause the visualization or adjust the speed of the visualization using the buttons.<br><br>Hover over a map marker to see more about the person.<br><br>You can also jump to another year by dragging the timeline handle.<br><br>The markers are colored according to the legend on the left side of the map. <br><br> As the visualization progresses, you will see a running list of which sages are currently visible on the map. Click on any sage name to see their biography page.`

// document.getElementById('info-button').addEventListener('click', function () {
//     showCustomAlert(infoText, '2.0vmin');
// })
document.getElementById("info-button").addEventListener("click", startTour)
// Fetch markers from DB instead of hardcoding
async function loadMarkersFromDB() {
    try {
        const { data, error } = await loadAllSagesNames()

        if (error) throw error;

        markers = data || [];
        console.log("Markers loaded from DB:", markers);
    } catch (error) {
        console.error("Error loading markers:", error);
    }
    const page = await trackPageView();
    if(page.isFirstVisit) {
        startTour();
    }
}


// Function to start playing
function startPlaying(videoSpeed) {
    clearInterval(playInterval);
    frameSpeed = 200 / videoSpeed
    playInterval = setInterval(() => {
        const slider = document.getElementById('year-slider');
        const currentValue = slider.noUiSlider.get();
        const newValue = parseInt(currentValue) + 1;
        slider.noUiSlider.set(newValue);
        displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople, false, true);
    }, frameSpeed);
}

function stopPlaying() {
    clearInterval(playInterval);
}

function setSpeed(speed) {
    videoSpeed = speed;
    if (playButton.checked) {
        playButton.checked = true;
        playButton.classList.add('paused');
        startPlaying(videoSpeed);
    }
}



function displayMarkersByTimeAnimate(markersData, visibleMarkers, visibleMarkersPeople, useDurationSizing = false, annotation = false) {
    const timeValue = document.getElementById('year-slider').noUiSlider.get();
    const currentMarkersData = markersData.filter(marker => marker.from <= timeValue && marker.to >= timeValue);

    currentMarkersData.forEach(marker => {
        marker.fromYear = marker.from == timeValue;
        marker.toYear = marker.to == timeValue;
        marker.birthYear = marker.birth == timeValue;
        marker.passYear = marker.passing == timeValue;
    });

    displayMarkers(currentMarkersData, visibleMarkers, visibleMarkersPeople, useDurationSizing, annotation);
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
                This page shows a animated visualization of sages across time and space.
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
                The color of the marker indicates the background of that sage.
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
                These are the sages currently visible on the map. Click on one to be taken to their profile page.
                `
            },
            {
                element: '.control-panel-container',
                intro: `
                <h3>🛠️ Control Panel</h3>
                Pause and resume the visualization or adjust the speed.
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

// Adapt colors automatically
document.querySelectorAll('.legend-color').forEach(item => {
    item.style.backgroundColor = getColor(capitalizeWords(item.id.split('-')[0]));
});

// Speed buttons
const buttonsArray = Array.from(document.getElementById('speed-button-container').children);
buttonsArray.forEach(button => {
    button.addEventListener('click', function () {
        buttonsArray.forEach(otherButton => otherButton.classList.remove('active'));
        button.classList.add('active');
        setSpeed(button.innerHTML.slice(0, -1));
    });
});

// Slider init
var yearSlider = document.getElementById('year-slider');
noUiSlider.create(yearSlider, {
    start: 900,
    connect: [true, false],
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



// Play button
window.playButton = document.getElementById('play-button');
playButton.addEventListener('click', () => {
    if (!playButton.checked) {
        playButton.checked = true;
        playButton.classList.add('paused');
        startPlaying(videoSpeed);
        const song = document.getElementById('song');
        if (song) {
            song.play();
        }

    } else {
        playButton.checked = false;
        playButton.classList.remove('paused');
        stopPlaying();
        document.getElementById("song").pause();
    }
});


// Popup logic
window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message'); // <-- needed
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
document.getElementById('map').addEventListener('click', () => {
    popup.classList.remove('visible');
});

// Load markers from DB first
loadMarkersFromDB().then(async () => {
    console.log("Markers ready, UI can now animate.");

    // Wait for the music URL to load
    await loadMusic(supabaseClient, "StockTune-Graduation Day Anthem_1759157249.mp3");

    console.log("Music loaded and ready to play.");
});
