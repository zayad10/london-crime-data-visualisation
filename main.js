

//global variables
let mapData, crimeData, ethnic_groups, merged_dataset, crimeRankings, crimePer1000Data;
let treemapSvg, treemapLayout, treemapColor;
let pcSvg, pcScales, pcLine, pcDimensions;

const years = Array.from({ length: 9 }, (_, i) => 2012 + i); // [2012..2020]
let currentYearIndex = 8;

Promise.all([
    d3.json('Data/london_boroughs.json'),
    d3.csv('Data/crime_data.csv'),
    d3.csv('Data/ethnic_groups.csv'),
    d3.csv('Data/merged_dataset.csv')
]).then(function (values) {

    mapData = values[0];
    crimeData = values[1];
    ethnic_groups = values[2];
    merged_dataset = values[3];
    crimePer1000Data = calculateCrimePer1000(crimeData, merged_dataset)
    crimeRankings = computeCrimeRankings(crimeData);
    console.log(crimeData.slice(0, 10), merged_dataset.slice(0, 10))

    // Year navigation
    document.getElementById("prev-year").addEventListener("click", () => {
        if (currentYearIndex > 0) {
            currentYearIndex--;
            document.getElementById("year-display").textContent = `Year: ${years[currentYearIndex]}`;
            updateMap(mapData, crimeData, years[currentYearIndex]);
            updateTreemap(ethnic_groups, 'All', years[currentYearIndex])
            updateParallelCoordinates(merged_dataset, 'All', years[currentYearIndex])
            updateStats('All', years[currentYearIndex])
        }
    });

    document.getElementById("next-year").addEventListener("click", () => {
        if (currentYearIndex < years.length - 1) {
            currentYearIndex++;
            document.getElementById("year-display").textContent = `Year: ${years[currentYearIndex]}`;
            updateMap(mapData, crimeData, years[currentYearIndex])
            updateTreemap(ethnic_groups, 'All', years[currentYearIndex])
            updateParallelCoordinates(merged_dataset, 'All', years[currentYearIndex])
            updateStats('All', years[currentYearIndex])
        }
    });

    drawMap(mapData, crimeData, 2020);
    drawTreemap(ethnic_groups, 'All', 2020);
    drawParallelCoordinates(merged_dataset, 'All', 2020);
    updateStats('All', 2020)

});

function calculateCrimePer1000(crimeData, merged_dataset) {
    let crimeRates = [];

    crimeData.forEach(crime => {
        let borough = crime.Borough;

        Object.keys(crime).forEach(year => {
            if (!isNaN(year)) {  
                let populationEntry = merged_dataset.find(entry =>
                    entry.Area === borough && entry.Year === year
                );

                if (populationEntry) {
                    let population = parseFloat(populationEntry.Population);
                    let crimeCount = parseFloat(crime[year]);

                    if (!isNaN(population) && !isNaN(crimeCount) && population > 0) {
                        let crimeRate = (crimeCount / population) * 1000;
                        crimeRates.push({
                            Borough: borough,
                            Year: year,
                            MajorText: crime.MajorText,
                            CrimeRatePer1000: crimeRate.toFixed(2)
                        });
                    }
                }
            }
        });
    });
    return crimeRates;
}

const pcMetrics = [
    { key: "Population_per_hectare", label: "Population Density (per hectare)", maxValue: 170 },
    { key: "Workless Household Percentage", label: "Workless Households (%)", percentage: true , maxValue: 30 },
    { key: "Youth_population", label: "Youth Population (%)", percentage: true , maxValue: 15},
    { key: "Unemployment_rate", label: "Unemployment Rate (%)", percentage: true , maxValue: 15}
];

function drawParallelCoordinates(merged_dataset, name, year) {
    const width = 600;
    const height = 300;
    const padding = { top: 30, right: 70, bottom: 50, left: 90 };

    // Create SVG
    pcSvg = d3.select("#parallelcoordinates")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Create scales per axis
    pcScales = {};
    pcMetrics.forEach(metric => {
        const values = merged_dataset.map(d => +d[metric.key]).filter(v => !isNaN(v));
        const minVal = metric.percentage ? 0 : d3.min(values);
        const maxVal = d3.max(values);
        console.log(metric.key, d3.max(values))
        pcScales[metric.key] = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([height - padding.bottom, padding.top]);
    });
 
    pcDimensions = pcMetrics.map((metric, i) => ({
        key: metric.key,
        label: metric.label,
        x: d3.scalePoint()
            .domain(pcMetrics.map(d => d.key))
            .range([padding.left, width - padding.right])(metric.key)
    }));

    // Line generator
    pcLine = d3.line()
        .defined(([, val]) => val != null)
        .x(([metric]) => pcDimensions.find(d => d.key === metric).x)
        .y(([metric, val]) => pcScales[metric](val));

    // Draw axes
    pcSvg.selectAll(".axis")
        .data(pcMetrics)
        .enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${pcDimensions.find(p => p.key === d.key).x},0)`)
        .each(function (metric) {
            d3.select(this).call(d3.axisLeft(pcScales[metric.key]).ticks(5));
        })
        .append("text")
        .attr("y", padding.top - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#333")
        .style("font-weight", "bold")
        .text(d => d.label);

    pcSvg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 20)  
        .attr("text-anchor", "middle")
        .attr("font-size", "14px") 
        .style("font-weight", "bold")
        .style("fill", "#fec44f")  
        .text("Attention: The scales along the vertical axes have been narrowed to reveal the subtle, yet consistent differences in socio-demographic factors.")
        .call(wrap, width)

    updateParallelCoordinates(merged_dataset, name, year);
}

function updateParallelCoordinates(merged_dataset, name, year) {
    let data;

    if (name !== "All") {
        data = merged_dataset.filter(d => d.Area === name && +d.Year === +year);
    } else {
        const filtered = merged_dataset.filter(d => +d.Year === +year);
        const avg = {};

        pcMetrics.forEach(metric => {
            const valid = filtered.map(d => +d[metric.key]).filter(v => !isNaN(v));
            avg[metric.key] = d3.mean(valid);
        });

        data = [avg];
    }
 
    const lines = data.map(d => pcMetrics.map(metric => [metric.key, +d[metric.key]]));
 
    const paths = pcSvg.selectAll(".pc-line")
        .data(lines);
 
    paths.join(
        enter => enter.append("path")
            .attr("class", "pc-line")
            .attr("fill", "none")
            .attr("stroke", "#4477aa")
            .attr("stroke-width", 2)
            .attr("opacity", 0.7)
            .attr("d", d => pcLine(d))
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke-width", 5)
                const tooltipText = d.map(([metric, val]) => {
                    const formattedVal = pcMetrics.find(m => m.key === metric).percentage ? `${val.toFixed(1)}%` : val.toFixed(2);
                    return `<strong>${pcMetrics.find(m => m.key === metric).label}:</strong> ${formattedVal}`;
                }).join("<br/>");

                d3.select("#tooltip")
                    .style("opacity", 1)
                    .html(tooltipText);
            })
            .on("mousemove", function (event) {
                d3.select("#tooltip")
                    .style("top", `${event.pageY - 10}px`)
                    .style("left", `${event.pageX + 10}px`);
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke-width", 2)
                d3.select("#tooltip").style("opacity", 0);
            }),
        update => update.transition()
            .duration(750)
            .attr("d", d => pcLine(d)),
        exit => exit.remove()
    );
}


function drawTreemap(ethnic_groups, name, year) {
    const margin = { top: 30, right: 10, bottom: 10, left: 10 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select("#treemap svg").remove();

    // Create SVG container
    treemapSvg = d3.select("#treemap")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add title
    treemapSvg.append("text")
        .attr("x", width / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .text("Population Racial Composition");
 
    treemapLayout = d3.treemap()
        .size([width, height])
        .padding(2);

    treemapColor = d3.scaleOrdinal()
        .domain(["White", "Asian", "Black", "Other"])
        .range(["#7b3294", "#a6dba0", "#c2a5cf", "#008837"]);
 
    updateTreemap(ethnic_groups, name, year);
}

function updateTreemap(ethnic_groups, name, year) {
    const groupKeys = ["White", "Asian", "Black", "Other"];
 
    let filteredData;
    if (name !== 'All') {
        filteredData = ethnic_groups.filter(d => d.Area === name && +d.Year === +year);
    } else {
        filteredData = ethnic_groups.filter(d => +d.Year === +year);
    }

    const dataForTreemap = name === "All"
        ? groupKeys.map(group => ({
            name: group,
            value: d3.sum(filteredData, d => +d[group] || 0)
        }))
        : groupKeys.map(group => ({
            name: group,
            value: +filteredData[0][group] || 0
        }));

    const total = d3.sum(dataForTreemap, d => d.value);

    dataForTreemap.forEach(d => {
        d.percentage = total > 0 ? ((d.value / total) * 100).toFixed(1) + "%" : "0%";
    });
    console.log(dataForTreemap)
    const root = d3.hierarchy({ name: "root", children: dataForTreemap })
        .sum(d => d.value);

    treemapLayout(root);

    const groups = treemapSvg.selectAll("g")
        .data(root.leaves(), d => d.data.name);

    const entering = groups.enter()
        .append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    entering.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => treemapColor(d.data.name))
        .attr("rx", 6)
        .attr("ry", 6)
        .on("mouseover", function (event, d) {
            d3.select(this).attr("stroke", "yellow").attr('stroke-width', '3px')
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`
                    <strong>${d.data.name}:</strong> ${d.data.value.toLocaleString('en-UK')}
                `);
        })
        .on("mousemove", function (event) {
            d3.select("#tooltip")
                .style("top", `${event.pageY - 10}px`)
                .style("left", `${event.pageX + 10}px`);
        })
        .on("mouseout", function () {
            d3.select(this).attr("stroke", "none")
            d3.select("#tooltip").style("opacity", 0)
        });

    entering.append("text").attr('class', 'name')
        .attr("x", 5)
        .attr("y", 20)
        .text(d => d.data.name)
        .style("font-size", "0.9rem")
        .style("fill", "#fff");

    entering.append("text").attr('class', 'percentage')
        .attr("x", 5)
        .attr("y", 40)
        .text(d => d.data.percentage)
        .style("font-size", "0.9rem")
        .style("fill", "#fff");

    groups.transition()
        .duration(750)
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    groups.select("rect").transition()
        .duration(750)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => treemapColor(d.data.name));

    groups.select(".name").transition()
        .duration(750)
        .text(d => d.data.name);

    groups.select(".percentage").transition()
        .duration(750)
        .text(d => d.data.percentage);

    groups.exit().remove();
}


function drawMap(map, data, year) {
    const width = 900;
    const height = 300;

    d3.select(".map-container svg").remove();

    const svg = d3.select(".map-container")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const projection = d3.geoMercator().fitSize([width, height], map);
    const path = d3.geoPath().projection(projection);

    svg.append("g")
        .attr("class", "boroughs")
        .selectAll("path")
        .data(map.features)
        .join("path")
        .attr("d", path)
        .attr("stroke", "#696969")
        .attr("stroke-width", 1);

    svg.append("g").attr("class", "legend")
        .attr("transform", `translate(${width - 180}, ${height - 120})`);  

    updateMap(map, data, year);
}

function updateMap(map, data, year) {
    // Tooltip ref
    const tooltip = d3.select("#tooltip");

    const colors = ["#D01C8B", "#F1B6DA", "#B8E186", "#4DAC26"];

    const thresholds = [8, 16, 24, 35];  

    const colorScale = (name) => {
        const boroughData = crimeRankings[name]
        if (boroughData) {
            const val = crimeRankings[name][year]

            if (val <= thresholds[0]) return colors[0]; // 0 - 8
            if (val <= thresholds[1]) return colors[1]; // 9 - 16
            if (val <= thresholds[2]) return colors[2]; // 17 - 24
            if (val <= thresholds[3]) return colors[3]; // 24+
        }
        else
            return "grey"

    };

    // Animate map update
    d3.selectAll(".boroughs path")
        .transition()
        .duration(750)
        .attr("fill", d => colorScale(d.properties.name))
        .on("start", function () {
            d3.select(this).attr("cursor", "pointer");
        });
 
    d3.selectAll(".boroughs path")
        .on("mouseover", function (event, d) {
            d3.select(this).attr("stroke", "yellow").attr("stroke-width", 3);
            const name = d.properties.name;

            const top5Crimes = crimePer1000Data
                .filter(x => x.MajorText !== "Total" && x.Borough == name && x.Year == year)
                .sort((a, b) => parseFloat(b.CrimeRatePer1000) - parseFloat(a.CrimeRatePer1000))
                .slice(0, 5);
            const html = `
              <span style="font-size: 1.3rem; text-decoration: underline; font-weight: bold;">
                ${name} (Per 1,000 Persons)</span><br/>
               <span style="font-size: 1.15 rem; font-weight: bold;">Top 5 Crime Types:</span><br/>
              <span style="color: red">
                 ${top5Crimes.map(c => `${c.MajorText}: ${Math.round(c.CrimeRatePer1000)}`).join("<br/>")}
              </span>`;
            tooltip.html(html)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 30) + "px")
                .style("opacity", 1);
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
            d3.select(this).attr("stroke", "#696969").attr("stroke-width", 1);
        })
        .on('click', function (event, d) {
            updateTreemap(ethnic_groups, d.properties.name, years[currentYearIndex])
            updateParallelCoordinates(merged_dataset, d.properties.name, years[currentYearIndex])
            updateStats(d.properties.name, years[currentYearIndex])

        })
 
    const legend = d3.select(".map-container svg .legend");
    if (legend.selectAll("g").empty()) {
        const legendData = [
            { label: "Highest Crime Rate", color: "#D01C8B" },
            { label: "Higher Crime Rate", color: "#F1B6DA" },
            { label: "Lower Crime Rate", color: "#B8E186" },
            { label: "Lowest Crime Rate", color: "#4DAC26" }
        ];

        const legendGroup = legend.selectAll("g")
            .data(legendData)
            .enter()
            .append("g")
            .attr("transform", (d, i) => `translate(0, ${i * 25})`);

        legendGroup.append("rect")
            .attr("width", 20)
            .attr("height", 20)
            .attr("fill", d => d.color)
            .attr("rx", 6)
            .attr("ry", 6);

        legendGroup.append("text")
            .attr("x", 30)
            .attr("y", 15)
            .text(d => d.label)
            .style("font-size", "0.9rem")
            .attr("fill", "#696969");
    }

}

function updateStats(selectedBorough, selectedYear) {
    d3.select('.selected-borough-value').text(selectedBorough);

    let housePriceText = "--";
    let changeText = "";
    let crimeText = "--"
    let crimeChangeText = "";

    let currentYearData, previousYearData;

    if (selectedBorough === "All") {
        const allCurrentYearData = merged_dataset.filter(x => +x.Year === selectedYear);
        const allPreviousYearData = merged_dataset.filter(x => +x.Year === (selectedYear - 1));

        if (allCurrentYearData.length > 0) {
            const avgHousePrice = d3.mean(allCurrentYearData, x => x.Avg_house_price).toFixed(2);

            housePriceText = `£${parseFloat(avgHousePrice).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (allPreviousYearData.length > 0) {

                const prevHousePrice = d3.mean(allPreviousYearData, x => x.Avg_house_price).toFixed(2);

                const housePriceChange = (avgHousePrice - prevHousePrice).toFixed(2);
                const housePriceChangePercentage = ((housePriceChange / prevHousePrice) * 100).toFixed(2);

                if (housePriceChange > 0) {
                    changeText = `<span style="color: #fec44f; font-weight: bold;">&#x21d1; </span><span style="color: #fec44f;">${housePriceChangePercentage}%</span>`;
                } else if (housePriceChange < 0) {
                    changeText = `<span style="color: red; font-weight: bold;">&#x21d3; </span><span style="color: red;">${Math.abs(housePriceChangePercentage)}%</span>`;
                } else {
                    changeText = `<span style="color: gray;">&#x21d4</span>`;
                }
            } else {
                changeText = `<span style="color: gray;">&#x21d4</span>`;
            }
        }
    } else {
        const boroughData = merged_dataset.filter(x => x.Area === selectedBorough);
        currentYearData = boroughData.find(x => +x.Year === selectedYear);
        previousYearData = boroughData.find(x => +x.Year === (selectedYear - 1));

        if (currentYearData) {
            const avgHousePrice = parseFloat(currentYearData.Avg_house_price).toFixed(2);
            housePriceText = `£${parseFloat(avgHousePrice).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            if (previousYearData) {
                const prevHousePrice = parseFloat(previousYearData.Avg_house_price);
                const housePriceChange = (avgHousePrice - prevHousePrice).toFixed(2);
                const housePriceChangePercentage = ((housePriceChange / prevHousePrice) * 100).toFixed(2);

                if (housePriceChange > 0) {
                    changeText = `<span style="color: #fec44f; font-weight: bold;">&#x21d1; </span><span style="color: #fec44f;">${housePriceChangePercentage}%</span>`;
                } else if (housePriceChange < 0) {
                    changeText = `<span style="color: red; font-weight: bold;">&#x21d3; </span><span style="color: red;">${Math.abs(housePriceChangePercentage)}%</span>`;
                } else {
                    changeText = `<span style="color: gray;">&#x21d4</span>`;
                }
            } else {
                changeText = `<span style="color: gray;">&#x21d4</span>`;
            }
        }
 
        // crimeRankings[d.properties.name][years[currentYearIndex]], crimeRankings[d.properties.name][years[currentYearIndex-1]]
        crimeText = crimeRankings[selectedBorough][selectedYear]
        var previousRank = crimeRankings[selectedBorough][selectedYear - 1];
        if (!previousRank) previousRank = crimeText
        var changeInRank = crimeRankings[selectedBorough][selectedYear - 1] - crimeRankings[selectedBorough][selectedYear];
        if (changeInRank > 0) {
            crimeChangeText = `<span style="color: #fec44f; font-weight: bold;">&#x21d1; </span><span style="color: #fec44f;">${previousRank}</span>  YoY`;
        } else if (changeInRank < 0) {
            crimeChangeText = `<span style="color: red; font-weight: bold;">&#x21d3; </span><span style="color: red;">${previousRank}</span>  YoY`;
        } else {
            crimeChangeText = `<span style="color: gray;">&#x21d4 </span>  YoY`;
        }
    }
    d3.select("#stat-avg-house-price").html(`${housePriceText} ${changeText} YoY`);
    d3.select("#stat-crime-ranking").html(`${crimeText} ${crimeChangeText}`);
}

function computeCrimeRankings(crimeDataset) {
    console.log(crimeDataset.slice(0,10) , crimePer1000Data.slice(0,10))
    let years = Object.keys(crimeDataset[0]).filter(y => !isNaN(y));
    let boroughs = [...new Set(crimeDataset.map(d => d.Borough))];

    let crimeRanks = {};

    years.forEach(year => { 
        let boroughTotals = boroughs.map(borough => {
            let totalCrimes = d3.sum(
                crimePer1000Data.filter(d => d.Borough === borough && +d.Year == +year),
                d => +d.CrimeRatePer1000|| 0
            );
            return { borough, totalCrimes };
        });
        console.log(boroughTotals, year)
        boroughTotals.sort((a, b) => b.totalCrimes - a.totalCrimes);

        boroughTotals.forEach((d, i) => {
            if (!crimeRanks[d.borough]) crimeRanks[d.borough] = {};
            crimeRanks[d.borough][year] = i + 1; 
        });
    });  

    return crimeRanks;
}

//function for wrapping text 
//source: https://bl.ocks.org/mbostock/7555321
function wrap(text, width) {
    text.each(function () {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            x = text.attr("x"),
            y = text.attr("y"),
            dy = 0,
            tspan = text.text(null)
                .append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em"); 
        while (word = words.pop()) {
            line.push(word); 
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                    .text(word);
            }
        }
    });
}

