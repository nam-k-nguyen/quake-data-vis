const mapSkins = [
    {
        id: "Esri.WorldStreetMap",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
    },
    {
        id: "Esri.WorldImagery",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    {
        id: "Esri.NatGeoWorldMap",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC'
    },
    {
        id: "Esri.OceanBasemap",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
        maxZoom: 11,
    },
    {
        id: "OpenStreetMap.Mapnik",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
]

class LeafletMap {

    /**
     * Class constructor with basic configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
        }
        this.data = _data;
        this.initVis();
    }

    /**
     * We initialize scales/axes and append static elements, such as axis titles.
     */
    initVis() {
        let vis = this;


        //ESRI
        vis.esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        vis.esriAttr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

        //TOPO
        vis.topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
        vis.topoAttr = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'

        //Thunderforest Outdoors- requires key... so meh... 
        vis.thOutUrl = 'https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey={apikey}';
        vis.thOutAttr = '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        //Stamen Terrain
        vis.stUrl = 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}';
        vis.stAttr = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        let mapSkin = mapSkins[3]


        //this is the base map layer, where we are showing the map background
        //**** TO DO - try different backgrounds 
        vis.base_layer = L.tileLayer(mapSkin.url, {
            id: mapSkin.id,
            attribution: mapSkin.attribution,
            ext: 'png',
            maxZoom: mapSkin.maxZoom ? mapSkin.maxZoom : 18,
        });

        vis.theMap = L.map('map', {
            center: [30, 0],
            zoom: 2,
            layers: [vis.base_layer]
        });

        //if you stopped here, you would just have a map
        vis.colorScale = d3.scaleLinear()
            .domain(d3.extent(vis.data, d => d.mag))
            .range(["yellow", "red"]);

        //initialize svg for d3 to add to map
        L.svg({ clickable: true }).addTo(vis.theMap)// we have to make the svg layer clickable
        vis.overlay = d3.select(vis.theMap.getPanes().overlayPane)
        vis.svg = vis.overlay.select('svg').attr("pointer-events", "auto")

        //these are the city locations, displayed as a set of dots 
        vis.Dots = vis.svg.selectAll('circle')
            .data(vis.data)
            .join('circle')
            .attr("fill", d => vis.colorScale(d.mag))  //---- TO DO- color by magnitude 
            .attr("stroke", "black")
            .attr("stroke-width", "0.5")
            //Leaflet has to take control of projecting points. 
            //Here we are feeding the latitude and longitude coordinates to
            //leaflet so that it can project them on the coordinates of the view. 
            //the returned conversion produces an x and y point. 
            //We have to select the the desired one using .x or .y
            .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
            .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
            .attr("r", d => d.mag)  // --- TO DO- want to make radius proportional to earthquake size? 
            .on('mouseover', function (event, d) { //function to add mouseover event
                d3.select(this).transition() //D3 selects the object we have moused over in order to perform operations on it
                    .duration('200') //how long we are transitioning between the two states (works like keyframes)
                    .attr("fill", "red") //change the fill
                    .attr('r', d => d.mag * vis.theMap.getZoom() / 2 + 1); //change radius

                //create a tool tip
                d3.select('#tooltip')
                    .style('opacity', 1)
                    .style('z-index', 999)
                    // Format number with million and thousand separator
                    //***** TO DO- change this tooltip to show useful information about the quakes
                    .html(`<div class="tooltip-label">
                  <b>Magnitude:</b> ${d.mag}
                  <br>
                  <b>Location:</b> ${d.place} 
                </div>`
                    );
            })
            .on('mousemove', (event) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px');
            })
            .on('mouseleave', function () { //function to add mouseover event
                d3.select(this).transition() //D3 selects the object we have moused over in order to perform operations on it
                    .duration('200') //how long we are transitioning between the two states (works like keyframes)
                    .attr("fill", d => vis.colorScale(d.mag)) //change the fill  TO DO- change fill again
                    .attr('r', d => d.mag * vis.theMap.getZoom() / 2) //change radius

                d3.select('#tooltip').style('opacity', 0);//turn off the tooltip

            })

        //handler here for updating the map, as you zoom in and out           
        vis.theMap.on("zoomend", function () {
            vis.updateVis();
        });

    }

    updateVis() {
        let vis = this;

        //want to see how zoomed in you are? 
        console.log(vis.theMap.getZoom()); //how zoomed am I?
        //----- maybe you want to use the zoom level as a basis for changing the size of the points... ?


        //redraw based on new zoom- need to recalculate on-screen position
        vis.Dots
            .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
            .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
            .attr("fill", d => vis.colorScale(d.mag))  //---- TO DO- color by magnitude 
            .attr("r", d => d.mag * vis.theMap.getZoom() / 2);

    }


    renderVis() {
        let vis = this;

        //not using right now... 

    }
}