// ================= DATA =================
const PEOPLE = [
  "Alter Rebbe",
  "Mitteler Rebbe",
  "Tzemach Tzedek",
  "Rebbe Maharash",
  "Rebbe Rashab",
  "Frierdiker Rebbe",
  "Lubavitcher Rebbe"
];

const CORRECT_ORDER = [...PEOPLE];

const WORKS = {
  "Alter Rebbe": "Tanya",
  "Mitteler Rebbe": "Kuntres Hahispaalus",
  "Tzemach Tzedek": "Derech Mitzvosecha",
  "Rebbe Maharash": "Likkutei Torah Toras Shmuel",
  "Rebbe Rashab": "Kuntres Haavodah",
  "Frierdiker Rebbe": "Likutei Diburim",
  "Lubavitcher Rebbe": "Hayom Yom"
};

const BIRTHDAYS = {
  "Alter Rebbe": "18 Elul",
  "Mitteler Rebbe": "9 Kislev",
  "Tzemach Tzedek": "29 Elul",
  "Rebbe Maharash": "2 Iyar",
  "Rebbe Rashab": "20 Cheshvan",
  "Frierdiker Rebbe": "12 Tammuz",
  "Lubavitcher Rebbe": "11 Nissan"
};

const PASSING_YEARS = {
  "Alter Rebbe": 1812,
  "Mitteler Rebbe": 1827,
  "Tzemach Tzedek": 1866,
  "Rebbe Maharash": 1882,
  "Rebbe Rashab": 1920,
  "Frierdiker Rebbe": 1950,
  "Lubavitcher Rebbe": 1994
};

// ================= UTILS =================
function shuffle(arr) {
  return arr
    .map(a => ({ sort: Math.random(), value: a }))
    .sort((a, b) => a.sort - b.sort)
    .map(a => a.value);
}

function showOverlay(title, msg, btnLabel, onClick) {
  const overlayContent = document.querySelector(".overlay-content");
  overlayContent.classList.remove("success", "error");

  const successWords = ["Perfect", "Excellent", "Fantastic", "Great", "Mastered"];
  const isSuccess = successWords.some(word => title.includes(word));

  overlayContent.classList.add(isSuccess ? "success" : "error");

  document.getElementById("overlay-title").textContent = title;
  document.getElementById("overlay-message").textContent = msg;

  const btn = document.getElementById("overlay-btn");
  btn.textContent = btnLabel;
  btn.onclick = () => {
    document.getElementById("result-overlay").style.display = "none";
    if (onClick) onClick();
  };

  document.getElementById("result-overlay").style.display = "flex";
}

function enableDragging(list, callback) {
  let draggedEl = null;

  list.querySelectorAll(".list-item").forEach(item => {
    item.addEventListener("dragstart", () => {
      draggedEl = item;
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      draggedEl = null;
      item.classList.remove("dragging");
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
    });

    item.addEventListener("drop", () => {
      if (draggedEl !== item && callback) callback(draggedEl, item);
    });
  });
}

function revealSection(sectionId, builderFn) {
  const section = document.getElementById(sectionId);
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth" });
  if (typeof builderFn === "function") builderFn();
}

// ================= TEST 1: ORDER =================
const list1 = document.getElementById("list1");

function fillTest1() {
  list1.innerHTML = "";

  shuffle(PEOPLE).forEach((name, i) => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.draggable = true;
    li.innerHTML = `
      <span class="drag-handle">⋮⋮</span>
      <span class="item-number">${i + 1}</span>
      <span class="item-text">${name}</span>
    `;
    list1.appendChild(li);
  });

  enableDragging(list1, (dragged, target) => {
    const children = [...list1.children];
    const dragIdx = children.indexOf(dragged);
    const tgtIdx = children.indexOf(target);

    if (dragIdx < tgtIdx) {
      target.after(dragged);
    } else {
      target.before(dragged);
    }

    [...list1.children].forEach((c, i) => {
      c.querySelector(".item-number").textContent = i + 1;
    });
  });
}

fillTest1();

document.getElementById("submit-test1").onclick = () => {
  const answers = [...document.querySelectorAll("#list1 .item-text")].map(span =>
    span.textContent.trim()
  );

  const correct = JSON.stringify(answers) === JSON.stringify(CORRECT_ORDER);
  const correctCount = answers.filter((v, i) => v === CORRECT_ORDER[i]).length;

  showOverlay(
    correct ? "Perfect!" : "Try Again",
    correct
      ? `All correct (${answers.length}/${CORRECT_ORDER.length})`
      : `Some incorrect (${correctCount}/${CORRECT_ORDER.length})`,
    correct ? "Continue" : "Try Again",
    () => {
      if (correct) {
        revealSection("test2-section", buildMatchingTest);
      } else {
        fillTest1();
      }
    }
  );
};

// ================= TEST 2: DRAG WORKS TO PEOPLE =================
function drawLinks(canvasId, peopleListId, itemsListId, dataAttr) {
  const canvas = document.getElementById(canvasId);
  const peopleList = document.getElementById(peopleListId);
  const itemsList = document.getElementById(itemsListId);

  if (!canvas || !peopleList || !itemsList) return;

  canvas.innerHTML = "";

  const container = canvas.parentElement;
  const containerRect = container.getBoundingClientRect();
  canvas.setAttribute("width", containerRect.width);
  canvas.setAttribute("height", containerRect.height);

  [...peopleList.children].forEach(personLi => {
    const linkedValue = personLi.dataset[dataAttr];
    if (!linkedValue) return;

    const itemLi = [...itemsList.children].find(
      li => li.querySelector(".item-text").textContent === linkedValue
    );
    if (!itemLi) return;

    const personRect = personLi.getBoundingClientRect();
    const itemRect = itemLi.getBoundingClientRect();

    const x1 = personRect.right - containerRect.left;
    const y1 = personRect.top + personRect.height / 2 - containerRect.top;
    const x2 = itemRect.left - containerRect.left;
    const y2 = itemRect.top + itemRect.height / 2 - containerRect.top;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#667eea");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    canvas.appendChild(line);
  });
}

function buildMatchingTest() {
  const peopleList = document.getElementById("people-list");
  const worksList = document.getElementById("works-list");

  peopleList.innerHTML = "";
  worksList.innerHTML = "";

  PEOPLE.forEach(person => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.draggable = false;
    li.innerHTML = `<span class="item-text">${person}</span>`;
    li.dataset.linkedWork = "";
    peopleList.appendChild(li);
  });

  shuffle(Object.values(WORKS)).forEach(work => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.draggable = true;
    li.innerHTML = `<span class="drag-handle">⋮⋮</span><span class="item-text">${work}</span>`;
    worksList.appendChild(li);
  });

  let draggedWork = null;

  worksList.querySelectorAll(".list-item").forEach(item => {
    item.addEventListener("dragstart", () => {
      draggedWork = item;
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      draggedWork = null;
      item.classList.remove("dragging");
    });
  });

  peopleList.querySelectorAll(".list-item").forEach(personItem => {
    personItem.addEventListener("dragover", e => {
      e.preventDefault();
      personItem.classList.add("drag-over");
    });

    personItem.addEventListener("dragleave", () => {
      personItem.classList.remove("drag-over");
    });

    personItem.addEventListener("drop", () => {
      personItem.classList.remove("drag-over");
      if (draggedWork) {
        const workText = draggedWork.querySelector(".item-text").textContent;
        personItem.dataset.linkedWork = workText;
        drawLinks("canvas-works", "people-list", "works-list", "linkedWork");
      }
    });
  });

  window.addEventListener("resize", () => {
    drawLinks("canvas-works", "people-list", "works-list", "linkedWork");
  });
}

document.getElementById("submit-test2").onclick = () => {
  const peopleList = document.getElementById("people-list");
  const results = [...peopleList.children].map(
    li => li.dataset.linkedWork === WORKS[li.querySelector(".item-text").textContent]
  );

  const correctCount = results.filter(Boolean).length;
  const total = PEOPLE.length;
  const passed = correctCount === total;

  showOverlay(
    passed ? "Excellent!" : "Incorrect",
    `${correctCount}/${total} correct (${Math.round((correctCount / total) * 100)}%)`,
    passed ? "Continue" : "Try Again",
    () => {
      if (passed) {
        revealSection("test3-section", buildBirthdayTest);
      } else {
        buildMatchingTest();
      }
    }
  );
};

// ================= TEST 3: TAP TO ASSIGN BIRTHDAYS =================
let selectedBirthday = null;

function updateBirthdayChoiceStates() {
  const assignedValues = new Set(
    [...document.querySelectorAll(".assignment-row")].map(row => row.dataset.linkedBday).filter(Boolean)
  );

  document.querySelectorAll(".choice-pill").forEach(pill => {
    const value = pill.dataset.value;
    pill.classList.toggle("used", assignedValues.has(value));

    if (selectedBirthday === value) {
      pill.classList.add("selected");
    } else {
      pill.classList.remove("selected");
    }
  });
}

function renderAssignmentSlot(row) {
  const slot = row.querySelector(".assignment-slot");
  const value = row.dataset.linkedBday;

  if (value) {
    slot.textContent = value;
    slot.classList.add("filled");
  } else {
    slot.textContent = "Tap a birthday, then tap here";
    slot.classList.remove("filled");
  }
}

function clearBirthdayFromOtherRows(bdayValue, exceptRow = null) {
  document.querySelectorAll(".assignment-row").forEach(row => {
    if (row !== exceptRow && row.dataset.linkedBday === bdayValue) {
      row.dataset.linkedBday = "";
      renderAssignmentSlot(row);
    }
  });
}

function buildBirthdayTest() {
  const choiceContainer = document.getElementById("birthday-choices");
  const assignmentList = document.getElementById("birthday-assignment-list");

  choiceContainer.innerHTML = "";
  assignmentList.innerHTML = "";
  selectedBirthday = null;

  shuffle(Object.values(BIRTHDAYS)).forEach(bday => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "choice-pill";
    pill.dataset.value = bday;
    pill.textContent = bday;

    pill.addEventListener("click", () => {
      selectedBirthday = selectedBirthday === bday ? null : bday;
      updateBirthdayChoiceStates();
      document.querySelectorAll(".assignment-row").forEach(row => row.classList.remove("active-target"));
    });

    choiceContainer.appendChild(pill);
  });

  PEOPLE.forEach(person => {
    const row = document.createElement("div");
    row.className = "assignment-row";
    row.dataset.person = person;
    row.dataset.linkedBday = "";

    row.innerHTML = `
      <div class="assignment-name">${person}</div>
      <button type="button" class="assignment-slot">Tap a birthday, then tap this row</button>
      <button type="button" class="clear-assignment secondary-btn">Clear</button>
    `;

    const slotBtn = row.querySelector(".assignment-slot");
    const clearBtn = row.querySelector(".clear-assignment");

    const assignHere = () => {
      if (!selectedBirthday) return;

      clearBirthdayFromOtherRows(selectedBirthday, row);
      row.dataset.linkedBday = selectedBirthday;
      renderAssignmentSlot(row);
      row.classList.add("active-target");

      selectedBirthday = null;
      updateBirthdayChoiceStates();

      setTimeout(() => row.classList.remove("active-target"), 180);
    };

    row.addEventListener("click", e => {
      if (e.target === clearBtn) return;
      assignHere();
    });

    slotBtn.addEventListener("click", e => {
      e.stopPropagation();
      assignHere();
    });

    clearBtn.addEventListener("click", e => {
      e.stopPropagation();
      row.dataset.linkedBday = "";
      renderAssignmentSlot(row);
      updateBirthdayChoiceStates();
    });

    renderAssignmentSlot(row);
    assignmentList.appendChild(row);
  });

  document.getElementById("clear-birthday-assignments").onclick = () => {
    document.querySelectorAll(".assignment-row").forEach(row => {
      row.dataset.linkedBday = "";
      renderAssignmentSlot(row);
      row.classList.remove("active-target");
    });
    selectedBirthday = null;
    updateBirthdayChoiceStates();
  };

  updateBirthdayChoiceStates();
}

document.getElementById("submit-test3").onclick = () => {
  const rows = [...document.querySelectorAll(".assignment-row")];

  const results = rows.map(
    row => row.dataset.linkedBday === BIRTHDAYS[row.dataset.person]
  );

  const correctCount = results.filter(Boolean).length;
  const total = PEOPLE.length;
  const passed = correctCount === total;

  showOverlay(
    passed ? "Fantastic!" : "Incorrect",
    `${correctCount}/${total} correct (${Math.round((correctCount / total) * 100)}%)`,
    passed ? "Continue" : "Try Again",
    () => {
      if (passed) {
        revealSection("test4-section", buildPassingTest);
      } else {
        buildBirthdayTest();
      }
    }
  );
};

// ================= TEST 4: MULTIPLE CHOICE PASSING YEARS =================
function buildPassingTest() {
  const quizList = document.getElementById("passing-quiz-list");
  quizList.innerHTML = "";

  PEOPLE.forEach(person => {
    const row = document.createElement("div");
    row.className = "quiz-row";

    const options = shuffle(Object.values(PASSING_YEARS).map(String));

    row.innerHTML = `
      <div class="quiz-name">${person}</div>
      <select class="quiz-select" data-person="${person}">
        <option value="">Choose a year</option>
        ${options.map(year => `<option value="${year}">${year}</option>`).join("")}
      </select>
    `;

    quizList.appendChild(row);
  });
}

document.getElementById("submit-test4").onclick = () => {
  const selects = [...document.querySelectorAll(".quiz-select")];

  const results = selects.map(select => {
    const person = select.dataset.person;
    return Number(select.value) === PASSING_YEARS[person];
  });

  const correctCount = results.filter(Boolean).length;
  const total = PEOPLE.length;
  const passed = correctCount === total;

  showOverlay(
    passed ? "Great!" : "Incorrect",
    `${correctCount}/${total} correct`,
    passed ? "Finish" : "Try Again",
    () => {
      if (passed) {
        revealSection("final-section");
      } else {
        buildPassingTest();
      }
    }
  );
};