class TimeHistogram {
    constructor(data, config = {}) {
        this.data = data;
        console.log(this.data.length, "data length");
        this.config = {
            parentElement: config.parentElement || "#time-histogram-container",
            containerWidth: config.containerWidth || 400,
            containerHeight: config.containerHeight || 200,
            xAxisSpacing: config.xAxisSpacing || 10,
            yAxisSpacing: config.yAxisSpacing || 40,
            margin: config.margin || { top: 25, right: 20, bottom: 15, left: 20 },
        };

        this.selectionChangeListener = [(minDate, maxDate) => {
            console.log("Selection changed. Update this function to handle the new date range.");
            console.log("Min Date:", minDate);
            console.log("Max Date:", maxDate);
        }];

        this.mode = "mag";
        this.colorScales = {
            mag: d3.interpolateYlOrRd,
            depth: d3.interpolateYlGnBu
        };

        this.initVis();
        this.defineGroupings();
        this.defineScales();
        this.defineAxes();
        this.renderVis();
        this.defineBrush();
    }

    defineGroupings() {
        const vis = this;

        vis.groupings = d3.rollup(
            vis.data,
            group => { return group.length; },
            d => d3.utcMonth(new Date(d.time))
        );

        vis.groupingsData = Array.from(vis.groupings, ([key, value]) => ({
            month: d3.utcMonth(new Date(key)),
            count: value
        }));

        vis.maxCount = d3.max(vis.groupingsData, d => d.count);
        vis.minCount = d3.min(vis.groupingsData, d => d.count);
        vis.maxMonth = d3.max(vis.groupingsData, d => d.month);
        vis.minMonth = d3.min(vis.groupingsData, d => d.month);
        vis.groupingsData.sort((a, b) => a.month - b.month);

    }

    defineScales() {
        const vis = this;
        const { containerWidth, containerHeight, margin, yAxisSpacing, xAxisSpacing } = vis.config;

        // Define the xScale for months
        const [minMonth, maxMonth] = d3.extent(vis.groupingsData, d => d.month)

        vis.xScale = d3.scaleUtc()
            .domain([minMonth, d3.utcMonth.offset(maxMonth, 1)])
            .range([margin.left + yAxisSpacing, containerWidth - margin.right]);

        // Define the yScale for counts
        vis.yScale = d3.scaleLinear()
            .domain([0, d3.max(vis.groupingsData, d => d.count)])
            .range([containerHeight - margin.top - xAxisSpacing, margin.bottom]);
    }

    defineAxes() {
        const vis = this;
        const { containerHeight, margin, xAxisSpacing, yAxisSpacing } = vis.config;

        vis.xAxis = vis.svg
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${containerHeight - margin.bottom - xAxisSpacing})`)

        vis.yAxis = vis.svg
            .append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left + yAxisSpacing}, ${margin.top - margin.bottom})`);

        vis.yAxisTitle = vis.svg
            .append('text')
            .attr('class', 'y-axis-text')
            .attr('dy', '.35em')
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${(margin.left + yAxisSpacing) / 2}, ${margin.top - 10})`)
            .text("Quakes");

        vis.xAxis.call(d3.axisBottom(vis.xScale).ticks(d3.utcMonth.every(1)));
        vis.yAxis.call(d3.axisLeft(vis.yScale).ticks(4));
    }

    defineBrush() {
        const vis = this;
        const { containerWidth, containerHeight, margin, yAxisSpacing, xAxisSpacing } = vis.config;

        const brushed = (event) => {
            if (event.selection == null) {
                vis.brushGroup.call(vis.brush.move, vis.currentSelection);
            } else {
                vis.currentSelection = event.selection;
                const [x0, x1] = event.selection;
                let minTime = vis.xScale.invert(x0);
                let maxTime = vis.xScale.invert(x1);
                vis.selectionChangeListener.forEach(listener => listener(minTime, maxTime));
            }
        }

        vis.brushGroup = vis.svg
            .append("g")
            .attr("class", "brush x-brush")
            .on("mousedown", null)
            .on("touchstart", null)

        vis.brushGroup.select(".overlay")
            .on("click mousedown touchstart", e => e.stopPropagation());

        vis.brush = d3.brushX()
            .extent([
                [margin.left + yAxisSpacing, margin.top],
                [containerWidth - margin.right, containerHeight - margin.bottom - xAxisSpacing]
            ])
            .filter(event => {
                return !event.srcElement.classList.contains("overlay") && !event.ctrlKey && !event.button;
            })
            .on("brush", brushed)
            .on("end", brushed)

        vis.brushGroup.call(vis.brush);
        vis.brushGroup.call(vis.brush.move, [
            margin.left + yAxisSpacing,
            containerWidth - margin.right
        ])

        vis.currentSelection = [margin.left + yAxisSpacing, containerWidth - margin.right];
    }

    initVis() {
        const vis = this;
        const { parentElement, containerWidth, containerHeight, margin, yAxisSpacing, xAxisSpacing } = vis.config;

        vis.svg = d3.select(parentElement)
            .append("svg")
            .attr("width", containerWidth)
            .attr("height", containerHeight);

        vis.bars = vis.svg.append("g")
            .attr("class", "bars")
    }

    renderVis() {
        let vis = this;
        const { containerHeight, margin, xAxisSpacing } = vis.config;

        vis.bars
            .selectAll("rect")
            .data(vis.groupingsData)
            .join("rect")
            .attr("x", d => vis.xScale(d.month))
            .attr("y", d => vis.yScale(d.count) + margin.top - margin.bottom)
            .attr("width", (d, i) => vis.xScale(d3.utcMonth.offset(d.month, 1)) - vis.xScale(d.month))
            .attr("height", d => containerHeight - margin.top - xAxisSpacing - vis.yScale(d.count))
            .attr("fill", d => vis.colorScales[vis.mode](d.count / vis.maxCount))
    }

    getDateRange() {
        const vis = this;
        const [selectStartRange, selectEndRange] = vis.currentSelection;
        const [minDate, maxDate] = [vis.xScale.invert(selectStartRange), vis.xScale.invert(selectEndRange)];
        return [minDate, maxDate];
    }

    updateSelectionChangeListeners(listeners) {
        const vis = this;
        vis.selectionChangeListener = [];
        listeners.forEach(listener => {
            if (typeof listener === 'function' && listener.length === 2) {
                vis.selectionChangeListener.push(listener);
            } else {
                console.error("Listener must be a function with two parameters: minDate and maxDate");
            }
        });
    }

    updateMode(mode) {
        const vis = this;
        vis.mode = mode;

        vis.bars.selectAll("rect")
            .attr("fill", d => vis.colorScales[vis.mode](d.count / vis.maxCount));
    }
}

