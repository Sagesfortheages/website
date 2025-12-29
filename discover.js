import { getSelectedSage } from './supabase/selectedSage.js';
import { trackPageView } from './supabase/supabaseFunctions.js';


// Detect course mode
let course = JSON.parse(sessionStorage.getItem("course"));
let courseIndex = parseInt(sessionStorage.getItem("courseIndex"), 10);
let courseMode = sessionStorage.getItem("courseModeActive") === "true";
console.log(course);
console.log(courseIndex);
console.log("Course mode:", courseMode);






import { supabaseClient } from './supabase/supabaseClient.js';



const { data: { session } } = await supabaseClient.auth.getSession()




let visibleMarkers = []

let selected = JSON.parse(sessionStorage.getItem('selected'));
console.log("Selected from sessionStorage:", selected);
trackPageView(selected?.person || null);


// Ensure we have a person
const selectedPerson = selected?.person ?? selected






async function fetchSelectedSage(person) {
  try {
    // Call Supabase directly
    const data = await getSelectedSage(person);

    if (!data?.data || !Array.isArray(data.data)) {
      throw new Error("No sage data returned");
    }

    // Separate main sage data from related sages
    const mainSageData = data.data.filter(item => item.is_main_sage === true);
    const relatedSagesData = data.data.filter(item => item.is_main_sage === false);

    console.log(relatedSagesData)

    // Keep selected as the main sage data (preserving original behavior)
    const selected = mainSageData.length > 0 ? mainSageData : data.data;

    console.log(relatedSagesData)
    // Store related sages separately
    const relatedSages = {
    teachers: relatedSagesData.filter(sage => sage.relationship_type === 'teacher'),
    students: relatedSagesData.filter(sage => sage.relationship_type === 'student'),
    all: relatedSagesData
    };

    // Optional: log for debugging
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













function fitMapToMarkers(filteredMarkers){
    if (!filteredMarkers.length) return;

    const latitudes = filteredMarkers.map(marker => marker.latitude)
    const longitudes = filteredMarkers.map(marker => marker.longitude)

    map.fitBounds(
        [
            [Math.min(...longitudes), Math.min(...latitudes)], 
            [Math.max(...longitudes), Math.max(...latitudes)]
        ],
        {padding: 100, maxZoom: 5}
    );
}

// Render a single main sage profile
// selected: object (one record, e.g. sage + a dwelling)
// relatedSages: { teachers: [...], students: [...], all: [...] }
async function renderSageProfile(selected, relatedSages = { teachers: [], students: [], all: [] }) {
    if (!selected) return;

    console.log("Rendering profile for:", selected);

    const imageToUse = selected.picture? `sages/${selected.picture}` : 'sages/blank_image.png';


    console.log(`sages/${selected.picture}`)
    const { data, error } = await supabaseClient.storage
    .from('images')
    .createSignedUrl(imageToUse, 60)

    console.log(data, error)

    // Basic fields
    const titleEl = document.getElementById("title-content");
    if (titleEl) titleEl.innerHTML = `${selected.person || ''} ${selected.person_hebrew ? '- ' + selected.person_hebrew : ''}`;

    const nameEl = document.getElementById("name-content");
    if (nameEl) nameEl.innerHTML = selected.name ? `R ${selected.name} ${selected.name_hebrew ? "- ר' " + selected.name_hebrew : ""}` : '';
    if (selected.name && selected.name != "NaN") {
        nameEl.innerHTML = `R ${selected.name} ${selected.name_hebrew ? "- ר' " + selected.name_hebrew : ""}`
    } else {
        nameEl.style.display = "none";
    }

    const yearsEl = document.getElementById("years-content");

    if (selected.birth & selected.birth !== 'NaN' && selected.passing && selected.passing != 'NaN') {
        yearsEl.innerHTML = `🕛 ${selected.birth} - ${selected.passing}`
    } else {
        yearsEl.style.display = "none";
    }

    const birthdayEl = document.getElementById("birthday-content");
    if (selected.birthday && selected.birthday != "NaN") {
        birthdayEl.innerHTML = `🎂${selected.birthday}`;
    } else {
        birthdayEl.style.display = "none";
    }

    const yahrtzeitEl = document.getElementById("yahrtzeit-content");
    if (selected.yahrtzeit && selected.yahrtzeit != "NaN") {
        yahrtzeitEl.innerHTML = `🕯️${selected.yahrtzeit}`;
    } else {
        yahrtzeitEl.style.display = "none";
    }

    const bgEl = document.getElementById("background-content");
    if (bgEl) {
        bgEl.innerHTML = selected.background || "";
        bgEl.style.color = getColor(selected.background || "");
    }

    const bioEl = document.getElementById("biography-content");
    if (bioEl) bioEl.innerHTML = selected.biography || "";

    const furtherLink = document.getElementById("further-reading-link-text");
    if (furtherLink) {
        furtherLink.href = selected.further_link || "#";
        furtherLink.style.color = getColor(selected.background || "");
        furtherLink.innerText = `Explore ${selected.person || ''} Further`;
    }

    // Picture
    const picEl = document.getElementById("profile-pic");
    if (picEl) picEl.src = data.signedUrl
    if (picEl) picEl.style.boxShadow = `0 0.8vmin 2.5vmin ${getColor(selected.background || "")}`;

    // Books — support array of objects, array of strings, or comma-string
    const majorWorksList = document.getElementById("major-works-list-content");
    if (majorWorksList) {
        majorWorksList.innerHTML = "";
        const books = selected.books || [];
        if (Array.isArray(books)) {
            // could be ['Book A','Book B'] OR [{book:'Book A'},...]
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

    // Expertises — support array-of-objects or comma-string
    const expertiseList = document.getElementById("expertise-list-content");
    if (expertiseList) {
        expertiseList.innerHTML = "";
        const exs = selected.expertise || [];
        if (Array.isArray(exs)) {
            exs.forEach(e => {
                const text = (typeof e === 'string') ? e : (e.expertise || '');
                if (!text) return;
                const li = document.createElement("li");
                li.classList.add("focus");
                li.textContent = text;
                expertiseList.appendChild(li);
            });
        } else if (typeof exs === 'string') {
            exs.split(',').map(s => s.trim()).filter(Boolean).forEach(text => {
                const li = document.createElement("li");
                li.classList.add("focus");
                li.textContent = text;
                expertiseList.appendChild(li);
            });
        }
    }










    // --- TEACHERS ---
    const teachersContainer = document.getElementById("teachers-content");
    if (teachersContainer) {
    teachersContainer.innerHTML = "";

    const teachers = relatedSages?.teachers || [];

    // Remove duplicates by person ID
    const uniqueTeachers = Array.from(
        new Map(teachers.map(t => [t.person, t])).values()
    );

    if (uniqueTeachers.length > 0) {
        uniqueTeachers.forEach((teacher, idx) => {
        if (!teacher?.name) return;
        const span = document.createElement("span");
        span.className = "clickable";
        span.textContent = `⮝ ${teacher.person}`;
        span.addEventListener("click", () => {
            // Trigger a profile load or custom action if desired
            linkToProfile(teacher);
        });
        teachersContainer.appendChild(span);

        if (idx < uniqueTeachers.length - 1) {
            teachersContainer.appendChild(document.createTextNode(" | "));
        }
        });
    }
    }

    // --- STUDENTS ---
    const studentsContainer = document.getElementById("students-content");
    if (studentsContainer) {
    studentsContainer.innerHTML = "";

    const students = relatedSages?.students || [];

    // Remove duplicates by person ID
    const uniqueStudents = Array.from(
        new Map(students.map(s => [s.person, s])).values()
    );

    if (uniqueStudents.length > 0) {
        uniqueStudents.forEach((student, idx) => {
        if (!student?.name) return;
        const span = document.createElement("span");
        span.className = "clickable";
        span.textContent = `⮟ ${student.person}`;
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


    // Journey button
    const journeyBtn = document.getElementById("journey-button");
    if (journeyBtn) journeyBtn.innerHTML = `Follow ${selected.person}'s Journey →`;



    
    if (courseMode) {
    const nav = document.getElementById("course-nav");
    const prevBtn = document.getElementById("prev-button");
    const nextBtn = document.getElementById("next-button");
    const progressBar = document.getElementById("progress-bar");
    const progressLabel = document.getElementById("progress-label")

    // Show the nav container
    nav.style.display = "block";

    // Fill progress bar
    const totalPages = course.length;
    const progressPercent = ((courseIndex + 1) / totalPages) * 100;
    progressBar.style.width = progressPercent + "%";
    progressLabel.textContent = "Progress: " + Math.round(progressPercent,0) + "%";


    // Previous button
    if (courseIndex > 0) {
        prevBtn.style.display = "inline-block";
        prevBtn.onclick = () => {
            courseIndex -= 1;
            sessionStorage.setItem("courseIndex", courseIndex);
            sessionStorage.setItem("selected", JSON.stringify({ person: course[courseIndex] }));
            location.reload();
        };
    } else {
        prevBtn.style.display = "none";
    }





// --- NEXT BUTTON ---
if (courseIndex < totalPages - 1) {
    nextBtn.style.display = "inline-block";
    nextBtn.onclick = () => {

        courseIndex += 1;
        sessionStorage.setItem("courseIndex", courseIndex);

        const nextPerson = course[courseIndex];

        // If the next item is our SPECIAL TEST PAGE
        if (nextPerson === "__TEST__") {
            sessionStorage.removeItem("courseModeActive");
            window.location.href = "../test.html";
            return;
        }

        sessionStorage.setItem("selected", JSON.stringify({ person: nextPerson }));
        location.reload();
    };
} else {
    nextBtn.style.display = "none";
}





} else {
    // Hide nav if not in course
    document.getElementById("course-nav").style.display = "none";
}


}


// --- Main fetch + render ---
fetchSelectedSage(selectedPerson).then(async sage => {
    if (!sage) return;

    // sage.selected is the array of marker objects (one per dwelling)
    const selectedArray = sage.selected;         // array
    const mainSelected = selectedArray[0] || {}; // first (primary) record
    const relatedSages = sage.relatedSages || { teachers: [], students: [], all: [] };

    console.log("Fetched sage:", sage);
    console.log("Selected array:", selectedArray);
    console.log("Main selected:", mainSelected);
    console.log("Related sages:", relatedSages);

    // pass data into renderer and map functions
    await renderSageProfile(mainSelected, relatedSages);

    // markers expect an array
    displayMarkers(selectedArray, visibleMarkers, false, true);
    fitMapToMarkers(selectedArray);
});


// --- Hover popup logic ---
window.popup = document.getElementById('popup');
window.popupMessage = document.querySelector('.popup-message');

document.addEventListener('mouseover', handleHoverPopup)
document.addEventListener('mousemove', (event) => {
    popup.style.left = event.pageX + 10 + "px"
    popup.style.top = event.pageY -28 + "px"
})
document.addEventListener('mouseout', (event) => {
    if (event.target.classList.contains('popup-button')) {
        popup.classList.remove('visible');
    }
});
