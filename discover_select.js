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
      //   window.location.href = "/index.html";
      return;
    }

    if (!session) {
      // User not logged in → redirect to home/login page
      console.log("No session found, redirecting to login");
      //   window.location.href = "/index.html";
      return;
    }

    console.log(
      "✅ User is authenticated:",
      session.user.email || session.user.id
    );

    // NOW fetch the data (only runs if user is logged in)
    markers = await loadAllSages();

    console.log("✅ Data loaded successfully, markers count:", markers.length);

    allPeople = [
      ...new Map(markers.map((item) => [item["person"], item])).values(),
    ];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));
    uniqueNames = allPeople.map((p) => p.person.toLowerCase());

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
  if (page.isFirstVisit) {
    showCustomAlert(
      `Search for a sage you wish to learn more about. <br><br>You can see what the hebrew date is and which sages have a birthday or yahrzeit today.<br><br>You can change the date using the Date Selection buttons, to see birthdays and yahrtzeits on other days.<br><br>Click on a person to see their biography page.`,
      "2vmin"
    );
  }
}

// ---------------- Populate people suggestions ----------------
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
      (marker.aka || "").toLowerCase().includes(searchValue) ||
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
        (marker.aka || "").toLowerCase().includes(closestMatch) ||
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
