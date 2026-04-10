import { getSelectedSage, getDailySageByDifficulty } from './supabase/selectedSage.js';
import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';

// Detect course mode
const params = new URLSearchParams(window.location.search);

const course = JSON.parse(decodeURIComponent(params.get('course') || '[]'));
const courseIndex = parseInt(params.get('courseIndex') || '0', 10);
const courseModeActive = params.get('courseModeActive') === 'true';

let courseMode = courseModeActive;
console.log("Course mode:", courseMode);

const { data: { session } } = await supabaseClient.auth.getSession();

const isMobile = window.innerWidth <= 768;

if (isMobile) {
    document.getElementById("prev-button").innerHTML = "⬅";
    document.getElementById("next-button").innerHTML = "➡";
}

let visibleMarkers = [];
console.log(courseMode);

const selectedRaw = params.get('selected');
const selected = selectedRaw ? JSON.parse(decodeURIComponent(selectedRaw)) : null;

// Ensure we have a person
const selectedPerson = selected?.person ?? selected ?? await getDailySageByDifficulty(3);

// ===== Trail globals =====
let trailCoords = [];
let trailInitialized = false;
let trailAnimationFrame = null;
let activeSequenceRunId = 0;

const FLY_DURATION = 6000;
const STEP_DELAY = 8000;

async function fetchSelectedSage(person) {
    try {
        const data = await getSelectedSage(person);

        if (!data?.data || !Array.isArray(data.data)) {
            throw new Error("No sage data returned");
        }

        const mainSageData = data.data.filter(item => item.is_main_sage === true);
        const relatedSagesData = data.data.filter(item => item.is_main_sage === false);

        console.log(relatedSagesData);

        const selected = mainSageData.length > 0 ? mainSageData : data.data;

        const relatedSages = {
            teachers: relatedSagesData.filter(sage => sage.relationship_type === 'teacher'),
            students: relatedSagesData.filter(sage => sage.relationship_type === 'student'),
            all: relatedSagesData
        };

        console.log("Selected sage:", selected);
        console.log("Related sages:", relatedSages);
        console.log("Metadata:", data.meta);

        return {
            selected,
            relatedSages,
            meta: data.meta
        };

    } catch (err) {
        console.error("Error fetching selected sage:", err);
        return null;
    }
}

function fitMapToMarkers(filteredMarkers) {
    if (!filteredMarkers.length) return;

    const latitudes = filteredMarkers.map(marker => marker.latitude);
    const longitudes = filteredMarkers.map(marker => marker.longitude);

    map.fitBounds(
        [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)]
        ],
        { padding: 100, maxZoom: 4 }
    );
}

// ===== Trail helpers =====
function ensureTrailLayer(color) {
    if (!map || !map.loaded()) return;

    if (!map.getSource("journey-trail")) {
        map.addSource("journey-trail", {
            type: "geojson",
            lineMetrics: true,
            data: {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: []
                }
            }
        });
    }

    if (!map.getLayer("journey-trail-glow")) {
        map.addLayer({
            id: "journey-trail-glow",
            type: "line",
            source: "journey-trail",
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                "line-color": color,
                "line-width": 14,
                "line-opacity": 0.28,
                "line-blur": 8,
                "line-dasharray": [1.5, 2]
            }
        });
    }

    if (!map.getLayer("journey-trail-line")) {
        map.addLayer({
            id: "journey-trail-line",
            type: "line",
            source: "journey-trail",
            layout: {
                "line-cap": "round",
                "line-join": "round"
            },
            paint: {
                "line-color": color,
                "line-width": 4,
                "line-opacity": 0.95,
                "line-dasharray": [1.5, 2]
            }
        });
    }

    trailInitialized = true;
}

function updateTrailSource(coords) {
    const source = map.getSource("journey-trail");
    if (!source) return;

    source.setData({
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: coords
        }
    });
}

function resetTrail(startCoord = null) {
    cancelTrailAnimation();

    trailCoords = startCoord ? [startCoord] : [];
    updateTrailSource(trailCoords);
}

function setTrailToFinalCoord(coord) {
    if (!coord) return;

    if (!trailCoords.length) {
        trailCoords = [coord];
    } else {
        trailCoords.push(coord);
    }

    updateTrailSource(trailCoords);
}

function cancelTrailAnimation() {
    if (trailAnimationFrame) {
        cancelAnimationFrame(trailAnimationFrame);
        trailAnimationFrame = null;
    }
}

function animateTrailSegment(startCoord, endCoord, duration, runId, onComplete) {
    cancelTrailAnimation();

    const startTime = performance.now();
    const baseCoords = [...trailCoords];

    if (!baseCoords.length) {
        baseCoords.push(startCoord);
    }

    function step(now) {
        if (runId !== activeSequenceRunId) return;

        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);

        const currentCoord = [
            startCoord[0] + (endCoord[0] - startCoord[0]) * t,
            startCoord[1] + (endCoord[1] - startCoord[1]) * t
        ];

        updateTrailSource([...baseCoords, currentCoord]);

        if (t < 1) {
            trailAnimationFrame = requestAnimationFrame(step);
        } else {
            trailAnimationFrame = null;
            trailCoords = [...baseCoords, endCoord];
            updateTrailSource(trailCoords);
            if (typeof onComplete === "function") onComplete();
        }
    }

    trailAnimationFrame = requestAnimationFrame(step);
}

// Render a single main sage profile
async function renderSageProfile(selected, relatedSages = { teachers: [], students: [], all: [] }) {
    if (!selected) return;

    const page = await trackPageView(selected?.person || null);
    if (page.isFirstVisit) {
        startTour();
    }

    console.log("Rendering profile for:", selected);

    const imageToUse = selected.picture ? `sages/${selected.picture}` : 'sages/sage';

    const { data, error } = await supabaseClient.storage
        .from('public_images')
        .getPublicUrl(imageToUse + '.webp');

    console.log(data, error);

    const titleEl = document.getElementById("title-content");
    if (titleEl) titleEl.innerHTML = `${selected.person || ''} ${selected.person_hebrew ? '- ' + selected.person_hebrew : ''}`;

    const akaEl = document.getElementById("aka-content");

    if (akaEl) {
    akaEl.innerHTML = selected.aka
        ? `${selected.aka.split(",").map(name => name.trim()).join(" | ")}`
        : "";
    }

    const nameEl = document.getElementById("name-content");
    if (nameEl) nameEl.innerHTML = selected.name ? `R ${selected.name} ${selected.name_hebrew ? "- ר' " + selected.name_hebrew : ""}` : '';
    if (selected.name && selected.name != "NaN") {
        nameEl.innerHTML = `R ${selected.name} ${selected.name_hebrew ? "- ר' " + selected.name_hebrew : ""}`;
    } else if (nameEl) {
        nameEl.style.display = "none";
    }

    const yearsEl = document.getElementById("years-content");
    if (selected.birth && selected.birth !== 'NaN' && selected.passing && selected.passing != 'NaN') {
        yearsEl.innerHTML = `🕰️${selected.birth} - ${selected.passing}`;
    } else if (yearsEl) {
        yearsEl.style.display = "none";
    }

    yearsEl.addEventListener("click", () => {
        window.location.href=`time.html?person=${encodeURIComponent(selected.person)}`})

    const birthdayEl = document.getElementById("birthday-content");
    if (selected.birthday && selected.birthday != "NaN" && selected.birthday != 0) {
        birthdayEl.innerHTML = `🎂${selected.birthday}`;
    } else if (birthdayEl) {
        birthdayEl.style.display = "none";
    }

    const yahrtzeitEl = document.getElementById("yahrtzeit-content");
    if (selected.yahrtzeit && selected.yahrtzeit != "NaN" && selected.yahrtzeit.toLowerCase() != "not found") {
        yahrtzeitEl.innerHTML = `🕯️${selected.yahrtzeit}`;
    } else if (yahrtzeitEl) {
        yahrtzeitEl.style.display = "none";
    }

    const bgEl = document.getElementById("background-content");
    if (bgEl) {
        bgEl.innerHTML = selected.background || "";
        bgEl.style.color = getColor(selected.background || "");
        bgEl.classList.add("clickable");

        bgEl.addEventListener("click", () => {
            window.location.href =
                "analyze.html?background=" + encodeURIComponent(selected.background || "");;
        });
    }

    const bioEl = document.getElementById("biography-content");
    if (bioEl) bioEl.innerHTML = selected.biography || "";

    const picEl = document.getElementById("profile-pic");
    if (picEl) picEl.src = data.publicUrl;
    if (picEl) picEl.style.boxShadow = `0 0.8vmin 2.5vmin ${getColor(selected.background || "")}`;

    const majorWorksList = document.getElementById("major-works-list-content");
    if (majorWorksList) {
        majorWorksList.innerHTML = "";
        const books = selected.books || [];
        if (Array.isArray(books)) {
            books.forEach(b => {
                const title = (typeof b === 'string') ? b : (b.book || '');
                if (!title) return;
                const li = document.createElement("li");
                li.classList.add("book");
                li.textContent = title;
                majorWorksList.appendChild(li);
            });
        } else if (typeof books === 'string') {
            books.split(',').map(s => s.trim()).filter(Boolean).forEach(title => {
                const li = document.createElement("li");
                li.classList.add("book");
                li.textContent = title;
                majorWorksList.appendChild(li);
            });
        }
    }

    const expertiseList = document.getElementById("expertise-list-content");

if (expertiseList) {
    expertiseList.innerHTML = "";

    const exs = selected.expertise || [];

    const addFocusItem = (text) => {
        if (!text) return;

        const li = document.createElement("li");
        li.classList.add("focus");
        li.classList.add("clickable");
        li.textContent = text;
        li.style.cursor = "pointer";

        li.addEventListener("click", () => {
            window.location.href =
                "analyze.html?focus=" + encodeURIComponent(text);
        });

        expertiseList.appendChild(li);
    };

    if (Array.isArray(exs)) {
        exs.forEach(e => {
            const text = typeof e === "string" ? e : (e.expertise || "");
            addFocusItem(text);
        });
    } else if (typeof exs === "string") {
        exs
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(addFocusItem);
    }
}

    const teachersContainer = document.getElementById("teachers-content");
    if (teachersContainer) {
        teachersContainer.innerHTML = "";

        const teachers = relatedSages?.teachers || [];
        const uniqueTeachers = Array.from(
            new Map(teachers.map(t => [t.person, t])).values()
        );

        if (uniqueTeachers.length > 0) {
            uniqueTeachers.forEach((teacher, idx) => {
                if (!teacher?.name) return;
                const span = document.createElement("span");
                span.className = "clickable";
                span.textContent = `▲ ${teacher.person}`;
                span.addEventListener("click", () => {
                    linkToProfile(teacher);
                });
                teachersContainer.appendChild(span);

                if (idx < uniqueTeachers.length - 1) {
                    teachersContainer.appendChild(document.createTextNode(" | "));
                }
            });
        }
    }

    const studentsContainer = document.getElementById("students-content");
    if (studentsContainer) {
        studentsContainer.innerHTML = "";

        const students = relatedSages?.students || [];
        const uniqueStudents = Array.from(
            new Map(students.map(s => [s.person, s])).values()
        );

        if (uniqueStudents.length > 0) {
            uniqueStudents.forEach((student, idx) => {
                console.log(student);
                if (!student?.person) return;
                console.log('adding', student);
                const span = document.createElement("span");
                span.className = "clickable";
                span.textContent = `▼ ${student.person}`;
                span.addEventListener("click", () => {
                    linkToProfile(student);
                });
                studentsContainer.appendChild(span);

                if (idx < uniqueStudents.length - 1) {
                    studentsContainer.appendChild(document.createTextNode(" | "));
                }
            });
        }
    }

    const journeyBtn = document.getElementById("journey-button");
    if (journeyBtn) journeyBtn.innerHTML = `Follow ${selected.person}'s Journey →`;

    if (courseMode) {
        const nav = document.getElementById("course-nav");
        const prevBtn = document.getElementById("prev-button");
        const nextBtn = document.getElementById("next-button");
        const progressBar = document.getElementById("progress-bar");
        const progressLabel = document.getElementById("progress-label");

        nav.style.display = "block";

        const totalPages = course.length;
        const progressPercent = ((courseIndex + 1) / totalPages) * 100;
        progressBar.style.width = progressPercent + "%";
        progressLabel.textContent = "Progress: " + Math.round(progressPercent, 0) + "%";

        if (courseIndex > 0) {
            prevBtn.style.display = "inline-block";
            prevBtn.onclick = () => {
                const prevIndex = courseIndex - 1;
                const prevPerson = course[prevIndex];

                const encodedCourse = encodeURIComponent(JSON.stringify(course));
                const encodedSelected = encodeURIComponent(JSON.stringify({ person: prevPerson }));

                window.location.href =
                    `../discover.html?course=${encodedCourse}` +
                    `&courseIndex=${prevIndex}` +
                    `&selected=${encodedSelected}` +
                    `&courseModeActive=true`;
            };
        } else {
            prevBtn.style.display = "none";
        }

        if (courseIndex < totalPages - 1) {
            nextBtn.style.display = "inline-block";
            nextBtn.onclick = () => {
                const nextIndex = courseIndex + 1;
                const nextPerson = course[nextIndex];

                if (nextPerson === "__TEST__") {
                    window.location.href = "../test.html";
                    return;
                }

                const encodedCourse = encodeURIComponent(JSON.stringify(course));
                const encodedSelected = encodeURIComponent(JSON.stringify({ person: nextPerson }));

                window.location.href =
                    `../discover.html?course=${encodedCourse}` +
                    `&courseIndex=${nextIndex}` +
                    `&selected=${encodedSelected}` +
                    `&courseModeActive=true`;
            };
        } else {
            nextBtn.style.display = "none";
        }

    } else {
        document.getElementById("course-nav").style.display = "none";
    }
}

function startTour() {
    const intro = introJs();

    function ensureShield() {
        let shield = document.getElementById("tour-click-shield");
        if (!shield) {
            shield = document.createElement("div");
            shield.id = "tour-click-shield";
            document.body.appendChild(shield);
        }
        return shield;
    }

    const shield = ensureShield();

    intro.setOptions({
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: false,
        exitOnEsc: true,
        scrollToElement: false,
        disableInteraction: false,
        steps: [
            { element: "body", intro: `<h3>👋 Welcome</h3>This is a guided profile. In one minute, you’ll see the highlights — then you can explore freely.` },
            { element: "#hero-content", intro: `<h3>🧾 Quick Identity</h3>The essentials at a glance: name, background, dates, and links to teachers/students.` },
            { element: "#major-works", intro: `<h3>📚 What he wrote</h3>Major works — the fastest way to see why he matters.` },
            { element: "#areas-of-focus", intro: `<h3>💡 What he shaped</h3>The fields where he made his mark.` },
            { element: "#map", intro: `<h3>📍 Trace the journey</h3><b>Hover the numbered cities</b> to see what happened where.` },
            { element: "#journey-button", intro: `<h3>🧳 Make it move</h3>Start the animated journey through the life path (if available).` },
            { element: "#info-button", intro: `<h3>🚶 Tour anytime</h3>Click ℹ️ whenever you want to replay the tour.` },
        ],
    });

    intro.onbeforechange(function(targetEl) {
        const isMapStep = targetEl && targetEl.id === "map";
        shield.style.display = isMapStep ? "none" : "block";

        if (isMapStep) {
            const mapEl = document.getElementById("map");
            if (mapEl) mapEl.style.pointerEvents = "auto";
        }
    });

    intro.onexit(function() {
        shield.style.display = "none";
    });

    intro.oncomplete(function() {
        shield.style.display = "none";
    });

    intro.start();
}

function setPlayUIPlaying(isPlaying, text = "") {
    const btn = document.getElementById("play-button");
    const status = document.getElementById("play-status");

    if (!btn || !status) return;

    if (isPlaying) {
        btn.classList.add("hidden");
        status.classList.remove("hidden");
        status.innerHTML = text;
    } else {
        status.classList.add("hidden");
        status.innerHTML = "";
        btn.classList.remove("hidden");
    }
}

// --- Main fetch + render ---
fetchSelectedSage(selectedPerson).then(async sage => {
    if (!sage) return;

    const selectedArray = sage.selected;
    console.log(selectedArray)
    const mainSelected = selectedArray[0] || {};
    const relatedSages = sage.relatedSages || { teachers: [], students: [], all: [] };

    console.log("Fetched sage:", sage);
    console.log("Selected array:", selectedArray);
    console.log("Main selected:", mainSelected);
    console.log(selectedArray[0]);
    console.log("Related sages:", relatedSages);

    await renderSageProfile(mainSelected, relatedSages);

    const overlay = document.getElementById("map-overlay");

    if (selectedArray[0].latitude == null) {
        overlay.classList.remove("hidden");
        console.log("Map disabled — missing location data");
        const journeyBtn = document.getElementById('journey-button');
        journeyBtn.disabled = true;
        journeyBtn.textContent = "Journey not available";
        return;
    }

    overlay.classList.add("hidden");
    console.log(selectedArray);

    displayMarkers(selectedArray, visibleMarkers, false, true);
    fitMapToMarkers(selectedArray);

    document.getElementById("play-button").addEventListener("click", function () {
        setPlayUIPlaying(true, "Starting journey…");
        initMapSequence(selectedArray);
    });
});

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
    activeSequenceRunId += 1;
    const runId = activeSequenceRunId;

    const start = () => {
    ensureTrailLayer(getColor(filteredMarkers[0]?.background || ""));

        const firstMarker = filteredMarkers[0];
        if (firstMarker) {
            resetTrail([firstMarker.longitude, firstMarker.latitude]);
        } else {
            resetTrail();
        }

        startSequence(filteredMarkers, runId);
    };

    if (map.loaded()) {
        console.log("Map already loaded — starting sequence immediately");
        start();
    } else {
        map.on('load', () => {
            console.log("Map load event triggered");
            start();
        });
    }
}

function startSequence(filteredMarkers, runId) {
    displayMarkers(filteredMarkers, [], false, true);

    let currentLocationIndex = -1;

    function flyToNextLocation() {
        if (runId !== activeSequenceRunId) return;

        if (currentLocationIndex < filteredMarkers.length - 1) {
            currentLocationIndex++;

            const nextLocation = filteredMarkers[currentLocationIndex];
            const nextCoord = [nextLocation.longitude, nextLocation.latitude];

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

            typewriterEffect("play-status", formattedText, 50);
            document.getElementById('keyboard-sound').play();

            map.flyTo({
                center: nextCoord,
                duration: FLY_DURATION,
                essential: true,
                zoom: 7
            });

            if (currentLocationIndex === 0) {
                resetTrail(nextCoord);
            } else {
                const previousLocation = filteredMarkers[currentLocationIndex - 1];
                const previousCoord = [previousLocation.longitude, previousLocation.latitude];

                animateTrailSegment(previousCoord, nextCoord, FLY_DURATION, runId);
            }

            setTimeout(flyToNextLocation, STEP_DELAY);
} else {
    cancelTrailAnimation();

    const latitudes = filteredMarkers.map(marker => marker.latitude);
    const longitudes = filteredMarkers.map(marker => marker.longitude);

    map.fitBounds(
        [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)]
        ],
        {
            padding: 100,
            maxZoom: 7,
            duration: 3000,
            linear: true,
            essential: true
        }
    );

    setTimeout(() => {
        setPlayUIPlaying(false);
    }, 3200);
}
    }

    flyToNextLocation();
}

// --- Hover popup logic ---
window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');


document.getElementById("info-button").addEventListener("click", startTour);

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
    const markerEl = event.target.closest('.popup-button');
    if (!markerEl) return;

    const city = markerEl.dataset.city;
    const country = markerEl.dataset.country;

    if (!city) return;

    window.location.href =
        `locate.html?city=${encodeURIComponent(city)}` +
        (country ? `&country=${encodeURIComponent(country)}` : '');
});