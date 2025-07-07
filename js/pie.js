class PieChart {
    constructor(data, config = {}) {
        this.data = data;
        this.config = {
            parentElement: config.parentElement || "#magnitude-pie-chart-container",
            legendParent: config.legendParent || "#magnitude-pie-chart-legend",
            containerWidth: config.containerWidth || 500,
            containerHeight: config.containerHeight || 500,
            margin: config.margin || { top: 40, right: 40, bottom: 40, left: 40 },
        }

        this.dateMin = d3.min(this.data, d => new Date(d.time));
        this.dateMax = d3.max(this.data, d => new Date(d.time));

        this.colorScales = {};
        this.mode = null;

        this.initVis();
        this.defineScales();
        this.defineGroupings();
        this.renderVis();
        this.setTotalQuakeText();
        this.setLegend();
    }

    updatePointWhenDateRangeChange(minDate, maxDate) {
        this.dateMin = minDate;
        this.dateMax = maxDate;
        this.defineGroupings();
        this.updateTotalQuakeText();
        this.renderVis();
    }

    defineGroupings() {
        const vis = this;

        const filteredData = vis.data.filter(
            d => util.dateInRange(d.time, vis.dateMin, vis.dateMax)
        )

        function customGrouping(d) {
            if (vis.mode === "mag") {
                return Math.floor(d.mag);
            } else if (vis.mode === "depth") {
                let dp = d.depth;
                if (dp <= 10) return 10;
                if (dp <= 70) return 70;
                if (dp <= 300) return 300;
                return 700;
            } else {
                console.error(`Unknown mode: ${vis.mode}`);
                return null;
            }
        }

        function getLabel(key) {
            if (vis.mode === "mag") {
                return `Mag ${key}+`;
            } else if (vis.mode === "depth") {
                if (key === 10) return "Very Shallow 0-10 km";
                if (key === 70) return "Shallow 10-70 km";
                if (key === 300) return "Intermediate 70-300 km";
                return "Deep > 300 km";
            } else {
                console.error(`Unknown mode: ${vis.mode}`);
                return null;
            }
        }
            
        vis.groupings = d3.rollup(
            filteredData,
            v => v.length,
            d => customGrouping(d)
        );

        vis.groupingsData = Array.from(vis.groupings, ([key, value]) => ({
            [vis.mode]: key,
            count: value,
            label: getLabel(key)
        }));

        console.log(vis.groupingsData, "groupingsData");

        vis.groupingsData.sort((a, b) => a[vis.mode] - b[vis.mode]);
    }

    defineScales() {
        const vis = this;

        const attributes = [
            { name: "mag", interpolator: d3.interpolateYlOrRd },
            { name: "depth", interpolator: d3.interpolateYlGnBu }
        ];

        for (const att of attributes) {
            if (vis.mode === null) { vis.mode = att.name; }
            if (!vis.data[0][att.name]) {
                console.error(`Attribute ${att.name} not found in data`);
                return;
            }
            const [min, max] = d3.extent(vis.data, d => d[att.name]);
            console.log(att.name, min, max, "att name");
            console.log(min, max, "min max");
            vis.colorScales[att.name] = d3
                .scaleSequential(att.interpolator)
                .domain([min, max]);
        }
    }

    initVis() {
        const vis = this;
        const { parentElement, containerHeight, containerWidth, margin } = vis.config;

        vis.dimension = Math.min(containerWidth, containerHeight);
        vis.diameter = vis.dimension - margin.left - margin.right;

        vis.svg = d3.select(parentElement)
            .append("svg")
            .attr("width", vis.dimension)
            .attr("height", vis.dimension);
    }

    setTotalQuakeText() {
        const vis = this;

        vis.totalQuakeText = vis.svg.append("text")
            .attr("class", "total")
            .attr("dy", ".35em")
            .attr("font-size", "24px")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${vis.dimension / 2}, ${vis.dimension / 2})`)
            .attr("fill", "white")
            .text(`${d3.sum(vis.groupingsData, d => d.count)}`);
    }

    updateTotalQuakeText(textToUpdate) {
        const vis = this;

        vis.totalQuakeText.text(textToUpdate || `${d3.sum(vis.groupingsData, d => d.count)}`);
    }

    setLegend() {
        const vis = this;
        const { legendParent } = vis.config;

        d3.select(legendParent).selectAll("*").remove();

        
        d3.select(legendParent).style("grid-template-rows", `repeat(${Math.floor(vis.groupingsData.length / 2)}, 1fr)`)

        
        vis.legend = d3.select(legendParent)
            .selectAll("div")
            .data(vis.groupingsData)
            .join("div")
            .attr("class", "legend-item")
            .each(function (d) {
                d3.select(this)
                    .append("span")
                    .attr("class", "legend-color")
                    .style("background-color", vis.colorScales[vis.mode](d[vis.mode]));

                d3.select(this)
                    .append("span")
                    .attr("class", "legend-label")
                    .html(`${d.label}`);
            });


    }

    renderVis() {
        const vis = this;
        const { containerWidth, containerHeight } = vis.config;

        vis.pie = d3.pie().value(d => d.count);
        vis.arc = d3.arc()
            .innerRadius(vis.diameter / 2 - 100)
            .outerRadius(vis.diameter / 2);

        vis.svg
            .selectAll("path")
            .data(vis.pie(vis.groupingsData))
            .join("path")
            .attr("d", vis.arc)
            .attr("fill", d => vis.colorScales[vis.mode](d.data[vis.mode]))
            .attr("stroke", d => vis.colorScales[vis.mode](d.data[vis.mode]))
            .attr("stroke-width", 2)
            .attr("transform", `translate(
                ${containerWidth / 2},
                ${Math.min(containerHeight, containerWidth) / 2}
            )`)
            .on("mouseover", function (event, d) {
                vis.updateTotalQuakeText(d.data.count)
            })
            .on("mouseout", function () {
                vis.updateTotalQuakeText();
            });
    }

    updateMode(mode) {
        this.mode = mode;
        this.defineGroupings();
        this.renderVis();
        this.setLegend();
    }
}

