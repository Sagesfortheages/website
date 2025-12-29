// analyzeSages.js
import { loadAllSages } from './supabase/sagesWithNames.js';
import { trackPageView } from './supabase/supabaseFunctions.js';


// ===================== GLOBAL VARIABLES =====================
let sages = [];
let selectedBackgrounds = [];
let currentSort = 'chronological'; // Default sort method
const infoText = `This page contains a timeline of each sage. They are color coded by background. <br><br> Hover over a rectangle to find out more about a person. <br><br>You can filter the timeline by clicking on one or more of the background buttons. <br><br>You can also toggle between chronological and alphabetical order using the buttons at the top. <br><br> Click on the name of a sage to see his biography page.`
document.getElementById('info-button').addEventListener('click', function () {
    showCustomAlert(infoText, '2.0vmin');
})
let popup, popupMessage;

// ===================== INITIALIZATION =====================
async function initializeSages() {

    const page = await trackPageView();
    if(page.isFirstVisit) {
        showCustomAlert(infoText, '2vmin')
    }
    sages = await loadAllSages();

    // Filter out sages missing birth or passing
    sages = sages.filter(sage => sage.birth != null && sage.passing != null);

    renderChart(); 
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
    if (!popup || !popupMessage) return; // defensive
    console.log(d.background)

    let content = `
        <div class="popup-header" style="font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 1px; padding-bottom: 5px;">${d.person}</div>
        <div class="popup-dates">${d.birth} - ${d.passing}</div>
    `;
    
    if (d.description) {
        content += `<div class="popup-description" style="margin-top: 8px;">${d.description}</div>`;
    }

    popupMessage.innerHTML = content;
    popup.style.background = `linear-gradient(135deg, #ffffff 60%, ${getColor(d.background)} 100%)`;

    // position and show via class (CSS controls opacity/pointer-events)
    popup.style.left = (event.pageX + 10) + 'px';
    popup.style.top = (event.pageY - 28) + 'px';

    popup.classList.add('visible');
}


function hidePopup() {
    if (!popup) return;
    popup.classList.remove('visible');
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

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background-color", "white")
        .style("color", "black")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid lines
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisBottom(x).tickSize(height).tickFormat(" "))
        .selectAll("line")
        .attr("stroke", "#444");

    // Y-axis
    svg.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .attr("class", "clickable y-label")
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
            .attr("stroke", "#007bff")
            .attr("stroke-width", 2);
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
        .on("mousemove", (event) => {
            popup.style.left = event.pageX + 10 + "px";
            popup.style.top = event.pageY - 28 + "px";
        })
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
