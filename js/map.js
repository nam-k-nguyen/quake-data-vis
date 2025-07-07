const { DeckGL, ScatterplotLayer, MapboxOverlay } = deck;

class MapVisualization {
    static maxScale = 20;

    constructor(data, config = {}) {
        this.deckGL = null;
        this.data = data;
        this.config = {
            container: config.container || "map-container",
            mapStyle: config.mapStyle || "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
            initialViewState: config.initialViewState || {
                longitude: 0,
                latitude: 0,
                zoom: 2
            },
            bounds: [[-180, -90], [180, 90]],
            renderWorldCopies: config.renderWorldCopies || true,
        };

        this.colorScales = {};
        this.mode = null
        this.dataPointScale = MapVisualization.maxScale;

        this.dateMin = null;
        this.dateMax = null;
        this.mapInstance = null;
        this.overlay = null;

        this.initVis();
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
            vis.colorScales[att.name] = d3
                .scaleSequential(att.interpolator)
                .domain([min, max]);
        }

        [this.dateMin, this.dateMax] = d3.extent(vis.data, d => new Date(d.time));
    }

    initMapLibreInstance() {
        const vis = this;

        vis.mapInstance = new maplibregl.Map({
            container: vis.config.container,
            style: vis.config.mapStyle,
            center: [vis.config.initialViewState.longitude, vis.config.initialViewState.latitude],
            zoom: vis.config.initialViewState.zoom,
            bounds: vis.config.bounds,
            attributionControl: false,
        });

        vis.mapInstance.addControl(new maplibregl.AttributionControl(), 'top-left');
        vis.mapInstance.addControl(new maplibregl.NavigationControl({
            showCompass: false,
        }), "top-right");

        vis.mapInstance.on('load', () => {
            vis.initDeckGlOverlay();
        })

        // vis.mapInstance.on('zoom', () => {
        //     console.log(`Current zoom level: ${vis.mapInstance.getZoom()}`);
        // });
    }

    initDeckGlOverlay() {
        const vis = this;

        vis.renewLayer();
        vis.overlay = new MapboxOverlay({
            layers: [vis.eqLayer]
        });

        this.mapInstance.addControl(vis.overlay);
    }

    renewLayer() {
        const vis = this;

        vis.eqLayer = new ScatterplotLayer({
            id: 'earthquake-layer',
            data: vis.data,
            getPosition: (d) => util.dataToLngLatArr(d),
            getFillColor: (d) => {
                let colorScale = vis.colorScales[vis.mode]
                let isValidDate = util.dateInRange(new Date(d.time), vis.dateMin, vis.dateMax)
                return util.rgbStringToArray(colorScale(d[vis.mode])).concat(isValidDate ? [180] : [0])
            },
            getRadius: (d) => (1.8 ** d.mag / 8) * (vis.dataPointScale / MapVisualization.maxScale),
            getLineColor: (d) => {
                let isValidDate = util.dateInRange(new Date(d.time), vis.dateMin, vis.dateMax)
                return [112, 118, 120].concat(isValidDate ? [255] : [0]);
            },
            getLineWidth: () => 0,
            radiusUnits: "common",
            stroked: true,
            pickable: true,
            updateTriggers: {
                getFillColor: [vis.dateMin, vis.dateMax, vis.mode],
                getLineColor: [vis.dateMin, vis.dateMax],
                getRadius: [vis.dataPointScale],

            },
            onHover: (info) => {
                if (info.object) {
                    const tooltip = document.querySelector("#tooltip");
                    tooltip.style.display = "block";
                    tooltip.innerHTML = `
                        <strong>Magnitude:</strong> ${info.object.mag}<br>
                        <strong>Depth:</strong> ${info.object.depth} km<br>
                        <strong>Location:</strong> ${info.object.place}<br>
                        <strong>Date:</strong> ${new Date(info.object.time).toLocaleString()}
                    `;
                    tooltip.style.left = `${info.x + 25}px`;
                    tooltip.style.top = `${info.y + 25}px`;
                } else {
                    document.querySelector("#tooltip").style.display = "none";
                }
            }
        })
    }

    updatePointWhenDateRangeChange(dateMin, dateMax) {
        const vis = this;

        vis.dateMin = dateMin;
        vis.dateMax = dateMax;
        vis.renewLayer();
        vis.overlay.setProps({
            layers: [vis.eqLayer]
        });
    }

    initVis() {
        const vis = this;
        vis.defineScales();
        vis.initMapLibreInstance();
    }

    updateMapStyle(style) {
        const vis = this;

        if (!style) {
            console.error("No style provided for map update.");
            return;
        }

        vis.mapInstance.setStyle(util.getMapStyleGeojson(style));
    }

    updatePointScale(scale) {
        const vis = this;

        if (!scale) {
            console.error("No scale provided for point update.");
            return;
        }

        vis.dataPointScale = scale;
        vis.renewLayer();
        vis.overlay.setProps({
            layers: [vis.eqLayer]
        });
    }

    updateMode(mode) {
        const vis = this;

        if (!mode || !vis.colorScales[mode]) {
            console.error(`Invalid mode: ${mode}`);
            return;
        }

        vis.mode = mode;
        vis.renewLayer();
        vis.overlay.setProps({
            layers: [vis.eqLayer]
        });
    }
}