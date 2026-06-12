// analyzeSages.js
import { loadAllSages } from './supabase/sagesWithNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';


// ===================== GLOBAL VARIABLES =====================
let sages = [];
let selectedBackgrounds = [];
let currentSort = 'chronological'; // Default sort method
const infoText = `This page contains a timeline of each sage. They are color coded by background. <br><br> Hover over a rectangle to find out more about a person. <br><br>You can filter the timeline by clicking on one or more of the background buttons. <br><br>You can also toggle between chronological and alphabetical order using the buttons at the top. <br><br> Click on the name of a sage to see his biography page.`
document.getElementById('info-button').addEventListener('click', function () {
    startTour()
})
let popup, popupMessage;
let allPeople = [];

let lastSortedSages = [];
let lastYScale = null;
let lastMarginTop = 20; // matches renderChart margin.top

// ===================== INITIALIZATION =====================
async function initializeSages() {

    const page = await trackPageView();
    // if(page.isFirstVisit) {
    //     startTour()
    // }
    sages = await loadAllSages();

    // Filter out sages missing birth or passing
    sages = sages.filter(sage => sage.birth != null && sage.passing != null);

        document
      .getElementById("search-input")
      .addEventListener("input", function (event) {
        handleInput(event, sages);
      });

    allPeople = [
      ...new Map(sages.map((item) => [item["person"], item])).values(),
    ];
    allPeople.sort((a, b) => a.person.localeCompare(b.person));

    renderChart();

    const params = new URLSearchParams(window.location.search);
    const personFromUrl = params.get("person");

    if (personFromUrl) {
    const searchInput = document.getElementById("search-input");

    if (searchInput) {
        searchInput.value = personFromUrl;
    }

    scrollToPerson(personFromUrl);
    }
}

// ===================== FILTERING & SORTING =====================
function filterByBackground(background) {
    const index = selectedBackgrounds.indexOf(background);
    const button = d3.select(`[data-background='${background}']`);

    if (index > -1) {
        selectedBackgrounds.splice(index, 1);
        button.classed('active', false).classed('filter-clicked', false);
    } else {
        selectedBackgrounds.push(background);
        button.classed('active', true).classed('filter-clicked', true);
    }

    renderChart();
}

function getFilteredSages() {
    if (selectedBackgrounds.length > 0) {
        return sages.filter(d => selectedBackgrounds.includes(d.background));
    }
    return sages;
}

function sortData(method) {
    currentSort = method;
    renderChart();
}

function sortChronological(data) {
    return data.sort((a, b) => a.birth - b.birth);
}

function sortAlphabetical(data) {
    return data.sort((a, b) => a.person.localeCompare(b.person));
}

// ===================== POPUPS =====================
function showPopup(d, event) {
  if (!popup || !popupMessage) return;

  let content = `
    <div class="popup-header" style="font-weight: bold; border-bottom: 1px solid rgba(110, 85, 55, 0.26); margin-bottom: 1px; padding-bottom: 5px;">${d.person}</div>
    <div class="popup-dates">${d.birth} - ${d.passing}</div>
  `;

  if (d.description) {
    content += `<div class="popup-description" style="margin-top: 8px;">${d.description}</div>`;
  }

  popupMessage.innerHTML = content;
  popup.style.background = `linear-gradient(135deg, #fff8e6 60%, ${getColor(d.background)} 100%)`;

  // show for measuring, but keep invisible
  popup.classList.add("visible");
  popup.style.visibility = "hidden";

  const rect = popup.getBoundingClientRect();

  const gap = 10;      // distance from cursor
  const pad = 12;      // distance from screen edge

  const vx0 = pad;
  const vy0 = pad;
  const vx1 = window.innerWidth - rect.width - pad;
  const vy1 = window.innerHeight - rect.height - pad;

  // cursor position in viewport coordinates
  const cx = event.clientX;
  const cy = event.clientY;

  // default: right + above
  let left = cx + gap;
  let top  = cy - rect.height - gap;

  // flip horizontally if it would go off the right edge
  if (left > window.innerWidth - rect.width - pad) {
    left = cx - rect.width - gap; // left side of cursor
  }

  // flip vertically if it would go off the top edge
  if (top < pad) {
    top = cy + gap; // below cursor
  }

  // final clamp (just in case)
  left = Math.min(Math.max(left, vx0), vx1);
  top  = Math.min(Math.max(top,  vy0), vy1);

  // convert viewport coords to page coords
  popup.style.left = (left + window.scrollX) + "px";
  popup.style.top  = (top + window.scrollY) + "px";

  popup.style.visibility = "visible";
}



function hidePopup() {
    if (!popup) return;
    popup.classList.remove('visible');
}

// ---------------- Your existing functions (unchanged) ----------------
function handleInput(event, markers, searchValue = null) {
  if (event.inputType !== undefined) {
    searchValue = event.target.value.trim().toLowerCase();
  }

  console.log(allPeople)

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
  suggestionsList.style.padding = "0vmin 0vmin 1vmin 0vmin"
  suggestionsList.innerHTML = "";

  uniqueSearchResults.forEach((result) => {
    const li = document.createElement("li");
    li.textContent = result.person;
    li.classList.add("clickable");
    li.addEventListener("click", () => {
  suggestionsList.innerHTML = "";
  scrollToPerson(result.person);
  document.getElementById('search-input').value = "";
  suggestionsList.style.padding = "0vmin 0vmin 0vmin 0vmin"
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

// ===================== CHART RENDERING =====================
function renderChart() {
    const leftMarginBase = window.innerWidth / 100 * 20;
    const rightMarginBase = window.innerWidth / 100 * 5;
    const margin = { top: 20, right: rightMarginBase, bottom: 40, left: leftMarginBase };
    const width = window.innerWidth - margin.left - margin.right;
    const filteredSages = getFilteredSages();
    const height = filteredSages.length * 25;

    // Remove old SVG
    d3.select("#chart").select("svg").remove();
    d3.select("#x-axis-svg").select("g").remove();

    // Apply sorting
    let sortedSages = [...filteredSages];
    if (currentSort === 'chronological') sortedSages = sortChronological(sortedSages);
    else if (currentSort === 'alphabetical') sortedSages = sortAlphabetical(sortedSages);

    const x = d3.scaleLinear().domain([880, 2000]).range([0, width]);
    const y = d3.scaleBand().domain(sortedSages.map(d => d.person)).range([0, height]).padding(0.3);

    // ✅ save for scrolling later
    lastSortedSages = sortedSages;
    lastYScale = y;
    lastMarginTop = margin.top;

    const svgRoot = d3.select("#chart")
    .append("svg")
    .attr("class", "timeline-svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

    const svg = svgRoot
    .append("g")
    .attr("class", "plot")
    .attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid lines
    svg.append("g")
    .attr("class", "grid")
    .call(d3.axisBottom(x).tickSize(height).tickFormat(""));

    // Y-axis
    svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll("text")
    .attr("class", "y-label")
    .call(wrap, margin.left - 20);

    // Y-axis click
    svg.selectAll(".y-label")
        .on("click", function(event, d) {
            linkToProfile(sages.find(sage => sage.person === d));
        });

    // Underline paths
    svg.selectAll(".clickable").each(function() {
        const textBox = this.getBBox();
        d3.select(this.parentNode)
            .append("line")
            .attr("class", "text-underline")
            .attr("x1", textBox.x)
            .attr("y1", textBox.y + textBox.height + 2)
            .attr("x2", textBox.x)
            .attr("y2", textBox.y + textBox.height + 2)
            .attr("class", "y-underline");
    });

    svg.selectAll(".clickable")
        .on("mouseenter", function() {
            const textBox = this.getBBox();
            d3.select(this.parentNode).select(".text-underline")
                .transition()
                .duration(300)
                .attr("x2", textBox.x + textBox.width);
        })
        .on("mouseleave", function() {
            const textBox = this.getBBox();
            d3.select(this.parentNode).select(".text-underline")
                .transition()
                .duration(300)
                .attr("x2", textBox.x);
        });

    // Bars
    svg.selectAll(".bar")
        .data(sortedSages)
        .enter()
        .append("rect")
        .attr("class", "bar popup-button")
        .attr("x", d => x(d.birth))
        .attr("width", d => x(d.passing) - x(d.birth))
        .attr("y", d => y(d.person))
        .attr("height", y.bandwidth())
        .attr("data-message", d => `<strong>${d.person}</strong>: ${d.birth} - ${d.passing}`)
        .style("fill", d => getColor(d.background))
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) { showPopup(d, event); })
        .on("mousemove", function(event, d) { showPopup(d, event); })
        .on("mouseout", hidePopup);

    // X-axis
    const xAxisSvg = d3.select("#x-axis-svg");
    xAxisSvg.attr("height", 45)
        .append("g")
        .attr("transform", `translate(${margin.left},20)`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .selectAll("text")
        .attr("class", "timeline-label");
}

function scrollToPerson(personName) {
  const container = document.getElementById('timeline-container');
  if (!container || !lastYScale) return;

  // If person isn’t currently in the chart (filtered out), do nothing
  const yPos = lastYScale(personName);
  if (yPos == null) return;

  // Center the row in the scroll window
  const targetTop = Math.max(0, yPos + lastMarginTop - container.clientHeight / 2);

  container.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  });

  // Optional: brief highlight on the bar + label
    d3.selectAll('.bar')
    .classed('flash', d => d.person === personName);

    d3.selectAll('.y-label')
    .classed('flash', d => d === personName);

    setTimeout(() => {
    d3.selectAll('.bar').classed('flash', false);
    d3.selectAll('.y-label').classed('flash', false);
    }, 2500);

  setTimeout(() => {
    d3.selectAll('.bar').classed('flash', false);
  }, 2500);
}

// ===================== TEXT WRAP =====================
function wrap(text, width) {
    text.each(function() {
        let textEl = d3.select(this),
            words = textEl.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1,
            y = textEl.attr("y"),
            dy = parseFloat(textEl.attr("dy")),
            tspan = textEl.text(null).append("tspan").attr("x", -10).attr("y", y).attr("dy", dy + "em");

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = textEl.append("tspan").attr("x", -10).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
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
                This page shows a timeline of sages.
                Let’s take a quick tour.
                `
            },
            {
                element: '#timeline-container',
                intro: `
                <h3>🕰️ Timeline</h3>
                This timeline shows the relative lifetimes of sages. Hover over a bar for more detail or click on a sage's name to be taken to their profile page.
                `
            },
            {
                element: '#background-container',
                intro: `
                <h3>🏷️ Background</h3>
                The color of the bar indicates the background of that sage. Click a background to filter for sages with that background.
                `
            },
            {
                element: '#sorting-container',
                intro: `
                <h3>⇅ Sort</h3>
                You can sort in time order or in alphabetical order by clicking one of these buttons.
                `
            },
            {
                element: '#search-container',
                intro: `
                <h3>🔍 Search</h3>
                Type a name into the search box to find a specific sage. Click on a name in the search results to jump to that sage on the timeline.
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


// ===================== DOMContentLoaded =====================
document.addEventListener('DOMContentLoaded', () => {
    // Assign popup elements
    popup = document.getElementById('popup');
    popupMessage = document.querySelector('.popup-message');

    // Initialize sages
    initializeSages();

    // Sort buttons
    const chronologicalButton = document.getElementById("sort-chronological");
    const alphabeticalButton = document.getElementById("sort-alphabetical");

    chronologicalButton.classList.add('filter-clicked');

    chronologicalButton.addEventListener('click', () => {
        alphabeticalButton.classList.remove('filter-clicked');
        chronologicalButton.classList.add('filter-clicked');
        sortData('chronological');
    });

    alphabeticalButton.addEventListener('click', () => {
        chronologicalButton.classList.remove('filter-clicked');
        alphabeticalButton.classList.add('filter-clicked');
        sortData('alphabetical');
    });

    // Background filter buttons
    const filterItems = document.querySelectorAll('.filter-item.chart-button-item');
    filterItems.forEach(item => {
        if (!item.id.includes('sort')) {
            const background = item.getAttribute('data-background');
            item.style.backgroundColor = getColor(background);
            item.addEventListener('click', () => filterByBackground(background));
        }
    });

    // Resize listener
    window.addEventListener('resize', renderChart);
});
