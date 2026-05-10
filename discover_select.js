import { loadAllSages } from "./supabase/sagesWithNames.js";
import { supabaseClient } from "./supabase/supabaseClient.js";
import { trackPageView } from "./supabase/supabaseFunctions.js";

// ---------------- Hebrew month translation ----------------
const hebrewMonths = {
  בתשרי: "Tishrei",
  תשרי: "Tishrei",
  בחשוון: "Cheshvan",
  חשוון: "Cheshvan",
  בכסלו: "Kislev",
  כסלו: "Kislev",
  בטבת: "Teves",
  טבת: "Teves",
  בשבט: "Shevat",
  שבט: "Shevat",
  "באדר א": "Adar I",
  "אדר א": "Adar I",
  באדר: "Adar",
  אדר: "Adar",
  "באדר ב": "Adar II",
  "אדר ב": "Adar II",
  בניסן: "Nissan",
  ניסן: "Nissan",
  באייר: "Iyar",
  אייר: "Iyar",
  בסיוון: "Sivan",
  סיוון: "Sivan",
  בתמוז: "Tammuz",
  תמוז: "Tammuz",
  באב: "Av",
  אב: "Av",
  באלול: "Elul",
  אלול: "Elul",
};

// ---------------- Get today's Hebrew date in English ----------------
const hebrewDateStr = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
  day: "numeric",
  month: "long",
}).format(new Date());

const hebrewMonthMatch = Object.keys(hebrewMonths).find((month) =>
  hebrewDateStr.includes(month)
);

var englishDate = hebrewMonthMatch
  ? hebrewDateStr.replace(hebrewMonthMatch, hebrewMonths[hebrewMonthMatch])
  : hebrewDateStr;

console.log(englishDate);

// ---------------- Global variables ----------------
let markers = [];
let allPeople = [];
let uniqueNames = [];

// ---------------- Fetch markers from backend ----------------
async function loadMarkers() {
  try {
    console.log("=== STARTING loadMarkers ===");
    console.log("supabaseClient object:", supabaseClient);

    // Check if user is logged in FIRST
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    console.log("=== SESSION CHECK ===");
    console.log("Session error:", sessionError);
    console.log("Session exists:", !!session);
    console.log("Full session object:", session);
    console.log("User:", session?.user);
    console.log("====================");

   if (sessionError) {
  console.error("Session error:", sessionError);
}

if (session) {
  console.log("User is authenticated:", session.user.email || session.user.id);
} else {
  console.log("Anonymous visitor");
}

markers = await loadAllSages();

    console.log("✅ Data loaded successfully, markers count:", markers.length);

    allPeople = [
      ...new Map(markers.map((item) => [item["person"], item])).values(),
    ];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));
    uniqueNames = allPeople.flatMap((p) => [
      p.person.toLowerCase(),
      (p.name || "").toLowerCase(),
      ...(p.sage_aka || []).map(akaObj => akaObj.aka.toLowerCase())
    ])

    populateSuggestions();

    document.getElementById("month").value = getMonthValueByName(
      englishDate.split(" ")[1].trim()
    );
    updateDays();
    document.getElementById("day").value = englishDate.split(" ")[0].trim();
    updateSelectedDate();

    document
      .getElementById("search-input")
      .addEventListener("input", function (event) {
        handleInput(event, markers);
      });
  } catch (error) {
    console.error("Error loading markers:", error);
    // If there's any error, redirect to login
    // window.location.href = "/index.html";
  }

  const page = await trackPageView();
  if(page.isFirstVisit) {
        startTour()
  }
}

// ---------------- Populate people suggestions ----------------

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
                This page lets you select a sage by name, birthday or yahrtzeit.
                Let’s take a quick tour.
                `
            },
            {
                element: '#search-results',
                intro: `
                <h3>👤 Sages</h3>
                Select a person to see their profile page.
                `
            },
            {
                element: '#search-input',
                intro: `
                <h3>🕵️ Search</h3>
                Search for a sage.
                `
            },
            {
                element: '#date-selection-card',
                intro: `
                <h3>📅 Date</h3>
                select a date to see sages with that birthday or yahrtzeit.
                `
            },


            {
                element: '.left-container',
                intro: `
                <h3>🎂 Birthdays</h3>
                These sages were born on this date. Click on any of them to see their profile.
                `
            },
            {
                element: '.right-container',
                intro: `
                <h3>🕯️ Yahrtzeits</h3>
                These sages passed away on this date. Click on any of them to see their profile.
                `
            },
            {
                element: '#info-button',
                intro: `
                <h3>🚶 Restart Tour</h3>
                Click here to see this tour again.
                `
            }
        ]
    });

    intro.start();
}

function populateSuggestions() {
  const suggestionsList = document.getElementById("search-results");
  suggestionsList.innerHTML = "";
  allPeople.forEach((result) => {
    const li = document.createElement("li");
    li.textContent = result.person;
    li.classList.add("clickable");
    li.addEventListener("click", () => {
      linkToProfile(result);
    });
    suggestionsList.appendChild(li);
  });
}

// ---------------- Your existing functions (unchanged) ----------------
function handleInput(event, markers, searchValue = null) {
  if (event.inputType !== undefined) {
    searchValue = event.target.value.trim().toLowerCase();
  }

  const searchResults = markers.filter(
    (marker) =>
      (marker.person || "").toLowerCase().includes(searchValue) ||
      (marker.sage_aka || []).some(akaObj => 
  akaObj.aka.toLowerCase().includes(searchValue)
) ||
      (marker.name || "").toLowerCase().includes(searchValue)
  );

  const uniqueSearchResults = [
    ...new Map(searchResults.map((item) => [item["person"], item])).values(),
  ];

  const suggestionsList = document.getElementById("search-results");
  suggestionsList.innerHTML = "";

  uniqueSearchResults.forEach((result) => {
    const li = document.createElement("li");
    li.textContent = result.person;
    li.classList.add("clickable");
    li.addEventListener("click", () => {
      suggestionsList.innerHTML = "";
      allPeople.forEach((result) => {
        const li = document.createElement("li");
        li.textContent = result.person;
        li.classList.add("clickable");
        li.addEventListener("click", () => {
          linkToProfile(result);
        });
        suggestionsList.appendChild(li);
      });
      linkToProfile(result);
    });
    suggestionsList.appendChild(li);
  });

  if (uniqueSearchResults.length === 0) {
    var closestMatch = findClosestMatch(searchValue, uniqueNames);
    const closestResults = markers.filter(
      (marker) =>
        (marker.person || "").toLowerCase().includes(closestMatch) ||
        (marker.sage_aka || []).some(akaObj => 
  akaObj.aka.toLowerCase().includes(closestMatch)
) ||
        (marker.name || "").toLowerCase().includes(closestMatch)
    );
    const uniqueClosestResults = [
      ...new Map(closestResults.map((item) => [item["person"], item])).values(),
    ];
    uniqueClosestResults.forEach((result) => {
      const li = document.createElement("li");
      li.textContent = "Did you mean " + result.person + "?";
      li.classList.add("clickable");
      li.addEventListener("click", () => {
        suggestionsList.innerHTML = "";
        allPeople.forEach((result) => {
          const li = document.createElement("li");
          li.textContent = result.person;
          li.classList.add("clickable");
          li.addEventListener("click", () => {
            linkToProfile(result);
          });
          suggestionsList.appendChild(li);
        });
        linkToProfile(result);
      });
      suggestionsList.appendChild(li);
    });
  }
}

function updateSelectedDate() {
  const day = document.getElementById("day");
  const month = document.getElementById("month");
  const dayValue = day.options[day.selectedIndex].text;
  const monthValue = month.options[month.selectedIndex].text;
  updateBirthdayList(dayValue + " " + monthValue);
  updateYahrtzeitList(dayValue + " " + monthValue);
  const dayNumeric = day.value;
  const monthNumeric = month.value;
  console.log(`Numeric values: Day ${dayNumeric}, Month ${monthNumeric}`);
  return { day: dayValue, month: monthValue, dayNumeric, monthNumeric };
}

function updateDays() {
  const monthSelect = document.getElementById("month");
  const daySelect = document.getElementById("day");
  const selectedMonth = parseInt(monthSelect.value);
  const currentDay = daySelect.value;
  daySelect.innerHTML = "";
  let maxDays = 30;
  if ([2, 4, 6, 8, 10, 12].includes(selectedMonth)) maxDays = 29;
  for (let i = 1; i <= maxDays; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    daySelect.appendChild(option);
  }
  if (currentDay && currentDay <= maxDays) {
    daySelect.value = currentDay;
  } else {
    daySelect.value = 1;
  }
  updateSelectedDate();
}

document.getElementById("month").addEventListener("change", updateDays);
document.getElementById("day").addEventListener("change", updateSelectedDate);
document.getElementById("info-button").addEventListener("click", startTour)

function getMonthValueByName(monthName) {
  const monthSelect = document.getElementById("month");
  for (let i = 0; i < monthSelect.options.length; i++) {
    if (monthSelect.options[i].text === monthName) {
      return monthSelect.options[i].value;
    }
  }
  return null;
}

function updateBirthdayList(englishDate) {
  document.getElementById(
    "birthdays-list-heading"
  ).innerText = `Birthdays For ${englishDate}`;
  const birthdaysList = document.getElementById("birthdays-list-content");
  birthdaysList.innerHTML = "";
  const birthdayBoys = markers.filter((marker) => {
    const multipleDates = marker.birthday?.toLowerCase().split("/") || [];
    const searchDate = englishDate.toLowerCase();
    return multipleDates.some((datePart) => {
      const trimmedDatePart = datePart.trim();
      const dayMonthMatch = trimmedDatePart.match(/^(\d+\s+[a-z]+)/i);
      const dayMonth = dayMonthMatch
        ? dayMonthMatch[0].toLowerCase()
        : trimmedDatePart;
      return dayMonth === searchDate;
    });
  });
  let uniquebirthdayBoys = [
    ...new Map(birthdayBoys.map((item) => [item["person"], item])).values(),
  ];
  uniquebirthdayBoys.forEach((birthdaysElement) => {
    let li = document.createElement("li");
    li.classList.add("clickable");
    li.textContent = birthdaysElement.person;
    li.addEventListener("click", () => {
      linkToProfile(birthdaysElement);
    });
    birthdaysList.appendChild(li);
  });
}

function updateYahrtzeitList(englishDate) {
  document.getElementById(
    "yahrtzeits-list-heading"
  ).innerHTML = `Yahrtzeits For ${englishDate}`;
  const yahrtzeitsList = document.getElementById("yahrtzeits-list-content");
  yahrtzeitsList.innerHTML = "";
  const yahrtzeitBoys = markers.filter((marker) => {
    console.log(marker);
    const multipleDates = marker.yahrtzeit?.toLowerCase().split("/") || [];
    const searchDate = englishDate.toLowerCase();
    return multipleDates.some((datePart) => {
      const trimmedDatePart = datePart.trim();
      const dayMonthMatch = trimmedDatePart.match(/^(\d+\s+[a-z]+)/i);
      const dayMonth = dayMonthMatch
        ? dayMonthMatch[0].toLowerCase()
        : trimmedDatePart;
      return dayMonth === searchDate;
    });
  });
  let uniqueyahrtzeitBoys = [
    ...new Map(yahrtzeitBoys.map((item) => [item["person"], item])).values(),
  ];
  uniqueyahrtzeitBoys.forEach((yahrtzeitsElement) => {
    let li = document.createElement("li");
    li.classList.add("clickable");
    li.textContent = yahrtzeitsElement.person;
    li.addEventListener("click", () => {
      linkToProfile(yahrtzeitsElement);
    });
    yahrtzeitsList.appendChild(li);
  });
}

// ---------------- Start everything ----------------
loadMarkers();
