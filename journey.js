import { getSelectedSage } from './supabase/selectedSage.js';
import { trackPageView } from './supabase/supabaseFunctions.js';

const selected = JSON.parse(sessionStorage.getItem('selected'));

trackPageView(selected?.person || null);

let filteredMarkers = [];

// Fetch markers for the selected person from your Flask API
// Fetch markers for the selected person using Supabase
async function fetchMarkersForSelected() {
    try {
        if (!selected?.person) {
            console.warn("No selected person specified");
            return;
        }

        // Call the Supabase function
        const data = await getSelectedSage(selected.person);
        console.log("Supabase Response:", data);

        // `data.data` contains the flattened markers
        const markers = data?.data || [];
        const filteredMarkers = markers.filter(marker => marker.person === selected.person);

        if (filteredMarkers.length === 0) {
            console.warn("No markers found for this person");
            return;
        }

        // Start the map logic
        initMapSequence(filteredMarkers);

    } catch (error) {
        console.error("Error fetching markers from Supabase:", error);
    }
}


// Function to format location description text
function formatLocationText(location, born = false, passing = false) {
    const textStyle = `color: ${getColor(location.background)}; 
                      font-weight: bold; 
                      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
                      font-style: italic;`;

    let text = "";

    if (born) {
        text += `In <span style="${textStyle}">${location.from}</span>, <span style="${textStyle}">${location.person}</span> was born in <span style="${textStyle}">${location.city}</span>, <span style="${textStyle}">${location.country}</span>.`;
    } else {
        text += `In <span style="${textStyle}">${location.from}</span>, <span style="${textStyle}">${location.person}</span> moved to <span style="${textStyle}">${location.city}</span>, <span style="${textStyle}">${location.country}</span>.`;
    }            
    if (passing) {
        text += `<br>He lived there for <span style="${textStyle}">${location.to - location.from}</span> years.`;
        text += `<br>He passed away there in <span style="${textStyle}">${location.passing}</span>.`;
    } else {
        text += `<br>He lived there for <span style="${textStyle}">${location.to - location.from + 1}</span> years.`; 
    }
    return text;
}

function initMapSequence(filteredMarkers) {
    console.log("initMapSequence called");

    // If the map is already loaded, start immediately
    if (map.loaded()) {
        console.log("Map already loaded — starting sequence immediately");
        startSequence(filteredMarkers);
    } else {
        // Otherwise, wait for it to finish loading
        map.on('load', () => {
            console.log("Map load event triggered");
            startSequence(filteredMarkers);
        });
    }
}

function startSequence(filteredMarkers) {
    console.log("Starting sequence");

    displayMarkers(filteredMarkers, [], false, true);

    let currentLocationIndex = -1;

    function flyToNextLocation() {
        if (currentLocationIndex !== filteredMarkers.length - 1) {
            currentLocationIndex++;

            const nextLocation = filteredMarkers[currentLocationIndex];

            console.log("Flying to:", nextLocation.city, nextLocation.latitude, nextLocation.longitude);

            map.flyTo({
                center: [nextLocation.longitude, nextLocation.latitude],
                duration: 6000,
                essential: true,
                zoom: 7
            });

            let formattedText;
            if (currentLocationIndex === 0 && currentLocationIndex === filteredMarkers.length - 1) {
                formattedText = formatLocationText(nextLocation, true, true);
            } else if (currentLocationIndex !== 0 && currentLocationIndex === filteredMarkers.length - 1) {
                formattedText = formatLocationText(nextLocation, false, true);
            } else if (currentLocationIndex === 0 && currentLocationIndex !== filteredMarkers.length - 1) {
                formattedText = formatLocationText(nextLocation, true, false);
            } else {
                formattedText = formatLocationText(nextLocation, false, false);
            }

            typewriterEffect("name-content", formattedText, 50);
            document.getElementById('keyboard-sound').play();

            setTimeout(flyToNextLocation, 8000);
        }
    }

    flyToNextLocation();
}

// Popup hover logic
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

// Run fetch when page loads
fetchMarkersForSelected();
