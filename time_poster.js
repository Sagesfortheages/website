import { loadAllSages } from './supabase/sagesWithNames.js';

let sages = [];

async function initializePosterTimeline() {
  sages = await loadAllSages();

  sages = sages
    .filter(sage => sage.birth != null && sage.passing != null)
    .sort((a, b) => a.birth - b.birth);

  renderPosterTimeline();
}

function renderPosterTimeline() {
  const posterWidth = 2100;

  const margin = {
    top: 40,
    right: 100,
    bottom: 30,
    left: 430
  };

  const rowHeight = 52;
  const chartHeight = sages.length * rowHeight;
  const innerWidth = posterWidth - margin.left - margin.right;

  d3.select("#chart").selectAll("*").remove();
  d3.select("#x-axis-svg").selectAll("*").remove();

  const x = d3.scaleLinear()
    .domain([880, 2000])
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(sages.map(d => d.person))
    .range([0, chartHeight])
    .padding(0.35);

  const svgRoot = d3.select("#chart")
    .append("svg")
    .attr("class", "timeline-svg")
    .attr("width", posterWidth)
    .attr("height", chartHeight + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${posterWidth} ${chartHeight + margin.top + margin.bottom}`);

  const svg = svgRoot
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  addEraBands(svg, x, chartHeight);
  addGrid(svg, x, chartHeight);
  addYAxis(svg, y, margin);
  addBars(svg, x, y);
  addBottomAxis(x, margin, posterWidth);
}

function addEraBands(svg, x, chartHeight) {
  const eras = [
    {
      label: "Rishonim",
      start: 1000,
      end: 1500,
      color: "rgba(88, 64, 38, 0.08)"
    },
    {
      label: "Acharonim",
      start: 1500,
      end: 1800,
      color: "rgba(47, 79, 79, 0.07)"
    },
    {
      label: "Modern",
      start: 1800,
      end: 2000,
      color: "rgba(3, 43, 125, 0.06)"
    }
  ];

  svg.selectAll(".era-band")
    .data(eras)
    .enter()
    .append("rect")
    .attr("class", "era-band")
    .attr("x", d => x(d.start))
    .attr("y", 0)
    .attr("width", d => x(d.end) - x(d.start))
    .attr("height", chartHeight)
    .attr("fill", d => d.color);

  svg.selectAll(".era-label")
    .data(eras)
    .enter()
    .append("text")
    .attr("class", "era-label")
    .attr("x", d => x((d.start + d.end) / 2))
    .attr("y", -14)
    .attr("text-anchor", "middle")
    .text(d => d.label);
}

function addGrid(svg, x, chartHeight) {
  svg.append("g")
    .attr("class", "grid")
    .call(
      d3.axisBottom(x)
        .tickValues([1000, 1200, 1400, 1500, 1600, 1800, 2000])
        .tickSize(chartHeight)
        .tickFormat("")
    );
}

function addYAxis(svg, y, margin) {
  svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll("text")
    .attr("class", "y-label")
    .call(wrap, margin.left - 25);

  svg.select(".y-axis path").remove();
}

function addBars(svg, x, y) {
  svg.selectAll(".bar")
    .data(sages)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.birth))
    .attr("width", d => Math.max(2, x(d.passing) - x(d.birth)))
    .attr("y", d => y(d.person))
    .attr("height", y.bandwidth())
    .attr("rx", 4)
    .attr("ry", 4)
    .style("fill", d => getColor(d.background));
}

function addBottomAxis(x, margin, posterWidth) {
  const axisHeight = 70;

  const xAxisSvg = d3.select("#x-axis-svg")
    .attr("width", posterWidth)
    .attr("height", axisHeight)
    .attr("viewBox", `0 0 ${posterWidth} ${axisHeight}`);

  xAxisSvg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(${margin.left},20)`)
    .call(
      d3.axisBottom(x)
        .tickValues([1000, 1200, 1400, 1500, 1600, 1800, 2000])
        .tickFormat(d3.format("d"))
    )
    .selectAll("text")
    .attr("class", "timeline-label");
}

function wrap(text, width) {
  text.each(function () {
    const textEl = d3.select(this);
    const words = textEl.text().split(/\s+/).reverse();

    let word;
    let line = [];
    let lineNumber = 0;

    const lineHeight = 1.1;
    const y = textEl.attr("y");
    const dy = parseFloat(textEl.attr("dy")) || 0;

    let tspan = textEl
      .text(null)
      .append("tspan")
      .attr("x", -10)
      .attr("y", y)
      .attr("dy", `${dy}em`);

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));

      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));

        line = [word];

        tspan = textEl
          .append("tspan")
          .attr("x", -10)
          .attr("y", y)
          .attr("dy", `${++lineNumber * lineHeight + dy}em`)
          .text(word);
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", initializePosterTimeline);