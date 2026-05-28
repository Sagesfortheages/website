
import { loadGuessWhoSages } from './supabase/get_guess_who_sages.js';
import { supabaseClient } from './supabase/supabaseClient.js';

const questionData = {
    background: {
    text: "Did the sage have a background of",
    options: ["Ashkenaz", "Sefarad", "Provence", "Chassidic", "Litvish", "Italian"]
    },
    era: {
    text: "Did the sage live in the",
    options: [
        "900s", "1000s", "1100s", "1200s", "1300s", "1400s",
        "1500s", "1600s", "1700s", "1800s", "1900s"
    ]
    },
    focus: {
    text: "Was the sage especially known for",
    options: [
        "Tanach", "Talmud", "Halacha", "Responsa", "Kabbalah",
        "Chassidus", "Mussar", "Philosophy", "Linguistics", "Poetry", "History"
    ]
    }
};

const board = document.getElementById("board");
const typeBtns = document.querySelectorAll(".question-type-btn");
const questionTxt = document.getElementById("built-question-text");
const optionGrid = document.getElementById("question-option-grid");
const submitBtn = document.getElementById("submit-question-btn");
const history = document.getElementById("question-history");

const guessBtn = document.getElementById("guess-button");
const guessStatus = document.getElementById("guess-status");
const profileBtn = document.getElementById("profile-button");

let allSages = [];
let boardSages = [];
let correctSage = null;

const params = new URLSearchParams(window.location.search);
const assignmentId = params.get("assignment_id");
let currentAssignment = null;

let selectedType = null;
let selectedValue = null;
let hoverMode = "background";

let guessMode = false;
let gameOver = false;

function normalizeExpertiseArray(value) {
    if (Array.isArray(value)) {
    return value
        .map(item => {
        if (typeof item === "string") return item.trim();
        return item?.expertise?.trim();
        })
        .filter(Boolean);
    }

    if (typeof value === "string") {
    return value
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
}

function normalizeText(value, fallback = "Unknown") {
    const text = String(value || "").trim();
    return text || fallback;
}

function processGuessWhoSages(sages) {
    return sages
    .map(sage => {
        const expertise = normalizeExpertiseArray(sage.expertise);

        return {
        ...sage,
        person: normalizeText(sage.person || sage.name),
        name: normalizeText(sage.name || sage.person),
        aka: sage.aka || "",
        background: normalizeText(sage.background),
        birth: Number(sage.birth) || null,
        passing: Number(sage.passing) || null,
        expertise,
        difficulty: Number(sage.difficulty) || 5,
        image: sage.image || sage.picture || sage.image_url || ""
        };
    })
    .filter(sage => sage.person && sage.person !== "Unknown")
    .filter(sage => sage.expertise.length > 0);
}

function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

function pickRandomSages(sages, count = 25) {
    return shuffleArray(sages).slice(0, count);
}

function pickRandomSage(sages) {
    if (!sages.length) return null;
    return sages[Math.floor(Math.random() * sages.length)];
}

function getInitials(name) {
    return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function getYearsText(sage) {
    const birth = sage.birth || "?";
    const passing = sage.passing || "?";
    return `${birth}–${passing}`;
}

function getFocusText(sage) {
    return sage.expertise.length ? sage.expertise.join(", ") : "Unknown";
}

function getHoverText(sage) {
    if (hoverMode === "background") {
    return sage.background || "Unknown";
    }

    if (hoverMode === "era") {
    return getYearsText(sage);
    }

    if (hoverMode === "focus") {
    return getFocusText(sage);
    }

    return "";
}

function showCardHoverInfo(card) {
    const info = card.querySelector(".sage-hover-info");
    if (!info) return;

    const sageId = card.dataset.person;
    const sage = boardSages.find(item => item.person === sageId);

    if (!sage) return;

    info.textContent = getHoverText(sage);
    card.classList.add("show-hover-info");
}

function hideCardHoverInfo(card) {
    const info = card.querySelector(".sage-hover-info");
    if (!info) return;

    info.textContent = "";
    card.classList.remove("show-hover-info");
}

function renderBoard(sages) {
    board.innerHTML = "";

    sages.forEach(sage => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sage-card";

    card.dataset.person = sage.person;
    card.dataset.background = sage.background;
    card.dataset.years = getYearsText(sage);
    card.dataset.focus = getFocusText(sage);

    const avatarContent = sage.image
        ? `<img src="${sage.image}" alt="${sage.person}" class="sage-avatar-img">`
        : `<span>${getInitials(sage.person)}</span>`;

    card.innerHTML = `
        <div class="sage-card-inner">
        <div class="sage-portrait-area">
            <div class="sage-avatar">
            ${avatarContent}
            </div>
        </div>

        <div class="sage-nameplate">
            <div class="sage-name">${sage.person}</div>
            <div class="sage-hover-info"></div>
        </div>
        </div>
    `;

    card.addEventListener("click", () => {
        if (gameOver) return;

        if (guessMode) {
        handleFinalGuess(sage, card);
        return;
        }

        card.classList.toggle("eliminated");
    });

    card.addEventListener("mouseenter", () => {
        showCardHoverInfo(card);
    });

    card.addEventListener("mouseleave", () => {
        hideCardHoverInfo(card);
    });

    board.appendChild(card);
    });
}

function setGuessMode(isActive) {
if (gameOver) return;

guessMode = isActive;

if (guessBtn) {
    guessBtn.classList.toggle("guess-mode-active", guessMode);
    guessBtn.textContent = guessMode ? "Choose a Card" : "Guess the Sage";
}

if (guessStatus) {
    guessStatus.textContent = guessMode
    ? "Now click the card you think is the hidden sage."
    : "Flip cards to eliminate them, or click “Guess the Sage” when you are ready.";
}

document.querySelectorAll(".sage-card").forEach(card => {
    card.classList.toggle("guess-target", guessMode);
});
}

function normalizeName(value) {
return String(value || "").trim().toLowerCase();
}


function sageHasBackground(sage, background) {
    return String(sage.background || "")
    .toLowerCase()
    .includes(String(background || "").toLowerCase());
}

function sageLivedInEra(sage, eraText) {
    const eraStart = Number(String(eraText).replace(/\D/g, ""));
    const eraEnd = eraStart + 99;

    if (!sage.birth && !sage.passing) return false;

    const birth = sage.birth || sage.passing;
    const passing = sage.passing || sage.birth;

    return birth <= eraEnd && passing >= eraStart;
}

function sageHasFocus(sage, focus) {
    return sage.expertise.some(item =>
    item.toLowerCase() === String(focus).toLowerCase()
    );
}

function answerQuestion(type, value) {
    if (!correctSage) return false;

    if (type === "background") {
    return sageHasBackground(correctSage, value);
    }

    if (type === "era") {
    return sageLivedInEra(correctSage, value);
    }

    if (type === "focus") {
    return sageHasFocus(correctSage, value);
    }

    return false;
}

function renderOptions(type) {
    selectedType = type;
    selectedValue = null;
    hoverMode = type;

    const config = questionData[type];

    questionTxt.textContent = `${config.text}...`;
    optionGrid.innerHTML = "";
    submitBtn.disabled = true;

    optionGrid.classList.toggle(
    "two-column-options",
    type === "era" || type === "focus"
    );

    typeBtns.forEach(button => {
    button.classList.toggle("active", button.dataset.questionType === type);
    });

    config.options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-option";
    button.textContent = option;

    button.addEventListener("click", () => {
        selectedValue = option;

        optionGrid.querySelectorAll(".question-option").forEach(optionButton => {
        optionButton.classList.remove("selected");
        });

        button.classList.add("selected");
        questionTxt.textContent = `${config.text} ${option}?`;
        submitBtn.disabled = false;
    });

    optionGrid.appendChild(button);
    });
}

function submitQuestion() {
    if (!selectedType || !selectedValue || !correctSage) return;

    const config = questionData[selectedType];
    const questionText = `${config.text} ${selectedValue}?`;
    const isYes = answerQuestion(selectedType, selectedValue);

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
    ${questionText}
    <div class="history-answer ${isYes ? "y" : "n"}">
        ${isYes ? "Yes" : "No"}
    </div>
    `;

    history.prepend(item);

    console.log("QUESTION SUBMITTED:", {
    type: selectedType,
    value: selectedValue,
    text: questionText,
    answer: isYes ? "Yes" : "No",
    correctSage
    });

    selectedValue = null;
    submitBtn.disabled = true;

    optionGrid.querySelectorAll(".question-option").forEach(button => {
    button.classList.remove("selected");
    });
}

async function loadAssignedCorrectSage() {
    if (!assignmentId) return null;

    const { data: assignment, error } = await supabaseClient
    .from("assignments")
    .select("id, title, activity_type, target_sage_person, status")
    .eq("id", assignmentId)
    .eq("status", "active")
    .single();

    if (error || !assignment) {
    console.error("Assignment load error:", error);
    throw new Error("Assigned Guess Who activity not found.");
    }

    currentAssignment = assignment;

    const targetPerson = normalizeName(assignment.target_sage_person);

    const assignedSage = allSages.find(sage =>
    normalizeName(sage.person) === targetPerson
    );

    if (!assignedSage) {
    throw new Error(`Assigned sage not found in game data: ${assignment.target_sage_person}`);
    }

    return assignedSage;
}

function pickBoardIncludingCorrectSage(sages, correct, count = 25) {
    if (!correct) {
    return pickRandomSages(sages, count);
    }

    const others = sages.filter(sage =>
    normalizeName(sage.person) !== normalizeName(correct.person)
    );

    const pickedOthers = shuffleArray(others).slice(0, count - 1);

    return shuffleArray([
    correct,
    ...pickedOthers
    ]);
}

function linkToCorrectSageProfile() {
    if (!correctSage) return;

    linkToProfile(finalCorrectAnswer, 'discover.html', assignmentId);
}

function finishGame(winningCard = null) {
    gameOver = true;
    setGuessMode(false);

    if (winningCard) {
    winningCard.classList.add("selected");
    winningCard.classList.remove("eliminated");
    }

    document.querySelectorAll(".sage-card").forEach(cardEl => {
    cardEl.classList.remove("guess-target");

    if (
        correctSage &&
        normalizeName(cardEl.dataset.person) === normalizeName(correctSage.person)
    ) {
        cardEl.classList.add("selected");
        cardEl.classList.remove("eliminated");
    }
    });

    if (guessBtn) {
    guessBtn.disabled = true;
    guessBtn.textContent = "Solved";
    guessBtn.classList.remove("guess-mode-active");
    }

    if (profileBtn) {
    profileBtn.classList.remove("hidden");
    }
}

function handleFinalGuess(sage, card) {
    if (!correctSage || gameOver) return;

    const isCorrect =
    normalizeName(sage.person) === normalizeName(correctSage.person);

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
    Final guess: ${sage.person}
    <div class="history-answer ${isCorrect ? "y" : "n"}">
        ${isCorrect ? "Correct!" : "Wrong"}
    </div>
    `;

    history.prepend(item);

    if (isCorrect) {
    if (guessStatus) {
        guessStatus.textContent = `Correct! The hidden sage was ${correctSage.person}.`;
    }

    finishGame(card);

    console.log("GAME WON:", correctSage);
    return;
    }

    card.classList.add("eliminated");
    setGuessMode(false);

    if (guessStatus) {
    guessStatus.textContent = `${sage.person} was not the hidden sage. Keep asking questions.`;
    }

    console.log("WRONG FINAL GUESS:", {
    guessed: sage,
    correctSage
    });
}

async function initializeGuessWho() {
    try {
    board.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:2vmin;">
        Loading sages...
        </div>
    `;

    if (profileBtn) {
        profileBtn.classList.add("hidden");
    }

    gameOver = false;
    guessMode = false;
    history.innerHTML = "";

    /*
        This must load enough sages that the assigned sage can be found.
        If your total Guess Who dataset is under 200, this is fine.
        If you may have more than 200, increase this or query the assigned sage directly.
    */
    const sagesFromDb = await loadGuessWhoSages(251);

    allSages = processGuessWhoSages(sagesFromDb);

    if (allSages.length < 25) {
        throw new Error(`Only found ${allSages.length} usable sages. Need at least 25.`);
    }

    const assignedCorrectSage = await loadAssignedCorrectSage();

    correctSage = assignedCorrectSage || pickRandomSage(allSages);

    if (!correctSage) {
        throw new Error("Could not choose a correct sage.");
    }

    boardSages = pickBoardIncludingCorrectSage(allSages, correctSage, 25);

    renderBoard(boardSages);

    questionTxt.textContent = "Select a question type above.";
    optionGrid.innerHTML = "";
    submitBtn.disabled = true;

    if (guessBtn) {
        guessBtn.disabled = false;
        guessBtn.textContent = "Guess the Sage";
        guessBtn.classList.remove("guess-mode-active");
    }

    if (guessStatus) {
        guessStatus.textContent =
        "Flip cards to eliminate them, or click “Guess the Sage” when you are ready.";
    }

    console.log("Guess Who initialized:", {
        assignmentId,
        assignedMode: Boolean(assignedCorrectSage),
        correctSage,
        boardCount: boardSages.length,
        correctIsOnBoard: boardSages.some(sage =>
        normalizeName(sage.person) === normalizeName(correctSage.person)
        )
    });

    } catch (error) {
    console.error("Failed to initialize Guess Who:", error);

    board.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:2vmin; color:#8b1a1a;">
        Failed to load sages. Please refresh and try again.
        <br>
        <small>${error.message}</small>
        </div>
    `;
    }
}

typeBtns.forEach(button => {
    button.addEventListener("click", () => {
    renderOptions(button.dataset.questionType);
    });
});

submitBtn.addEventListener("click", submitQuestion);

if (guessBtn) {
    guessBtn.addEventListener("click", () => {
    setGuessMode(!guessMode);
    });
}

if (profileBtn) {
    profileBtn.addEventListener("click", linkToCorrectSageProfile);
}

document.addEventListener("DOMContentLoaded", initializeGuessWho);
