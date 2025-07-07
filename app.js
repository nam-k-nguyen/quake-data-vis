async function fetchData() {
    const response = await fetch("data/2025_filtered.json");
    const data = await response.json();
    return data;
}

async function main() {
    const data = await fetchData();

    const mapVis = new MapVisualization(data);




    const pieContainerId = "#magnitude-pie-chart-container";
    const pieLegendParent = "#magnitude-pie-chart-legend";
    const { width: widthPie, height: heightPie } = util.getDimensionsOfElement(pieContainerId);
    const magPieChart = new PieChart(data, {
        parentElement: pieContainerId,
        legendParent: pieLegendParent,
        containerWidth: widthPie,
        containerHeight: heightPie,
    });




    const histContainerId = "#time-histogram-container";
    const { width: widthHist, height: heightHist } = util.getDimensionsOfElement(histContainerId);
    const timeHist = new TimeHistogram(data, {
        parentElement: histContainerId,
        containerWidth: widthHist,
        containerHeight: heightHist,
    });

    timeHist.updateSelectionChangeListeners([
        mapVis.updatePointWhenDateRangeChange.bind(mapVis),
        magPieChart.updatePointWhenDateRangeChange.bind(magPieChart),
    ])

    // event listeners 


    const mapStyleSelector = document.querySelector("#map-style");
    mapStyleSelector.addEventListener("change", (event) => {
        const selectedStyle = event.target.value;
        mapVis.updateMapStyle(selectedStyle);
    });

    const mapPointScaleSlider = document.querySelector("#map-point-scale");
    mapPointScaleSlider.addEventListener("input", (event) => {
        const scaleValue = parseFloat(event.target.value);
        mapVis.updatePointScale(scaleValue);
    });


    const mapColorModeRadio = document.querySelector("#color-mode-radio");
    mapColorModeRadio.addEventListener('change', (event) => {
        if (event.target.name === 'color-mode') {
            const selectedValue = event.target.value;
            mapVis.updateMode(selectedValue);
            magPieChart.updateMode(selectedValue);
            timeHist.updateMode(selectedValue);

            let isMag = selectedValue === 'mag';
            d3.select(':root').style('--accent', isMag ? '#fd8d3d' : '#007bff');
        }
    });

    // overlay event listeners

    const overlayContainer = document.querySelector("#overlay-container")
    const closeOverlayButton = document.querySelector("#close-overlay");
    const openOverlayButton = document.querySelector("#open-overlay");

    function closeOverlay() {
        overlayContainer.classList.remove("open");
        setTimeout(() => {
            overlayContainer.style.display = "none";
        }, 500);
    }

    function openOverlay() {
        overlayContainer.style.display = "flex";
        overlayContainer.classList.add("open");
    }

    closeOverlayButton.addEventListener("click", closeOverlay);
    overlayContainer.addEventListener("click", closeOverlay);
    openOverlayButton.addEventListener("click", openOverlay);
}

main();