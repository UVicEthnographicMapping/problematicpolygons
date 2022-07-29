const alpha = 194;//Opacity of arcs
const TIME_WINDOW = 200;//Length of the arc animated tail
const MIN_TIME = 1500;
const MAX_TIME = 2000;

var infowindow;
var map;
var mapData = {};
var selectedMap = "ppoly";//Default value (first choice in mapSelector)
var areaSize = 100;
var timesImported = -1;//Keep track of imported data

//KEEP THESE 2 VARIABLES GLOBAL
const overlay = new deck.GoogleMapsOverlay({});
var overlayInterval = -1;


function importColour(spreadsheetData){
    let data = spreadsheetData.values;
    var metadata = data[0][0].split('.');
    var mapName = metadata[0];
    var columnName = metadata[1];
    var colourMappingData = {};
    let cdata_headers = {};
    cdata_headers[columnName] = 0;
    for (let i = 1; i < data[0].length; i++) {
    cdata_headers[data[0][i]] = i;
    }
    for (let i = 1; i < data.length; i++) {
    colourMappingData[data[i][cdata_headers[columnName]]] =
                            [Number(data[i][cdata_headers["r"]]),
                            Number(data[i][cdata_headers["g"]]),
                            Number(data[i][cdata_headers["b"]]),
                            alpha];
    }
    if (mapData[mapName]["colourMappingData"] == null) {
    mapData[mapName]["colourMappingData"] = {};
    }
    mapData[mapName]["colourMappingData"][columnName] = colourMappingData;
}

function ColorToHex(color) {
    var hexadecimal = color.toString(16);
    return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
}

function ConvertRGBtoHex(rgb) {
    return "#" + ColorToHex(rgb[0]) + ColorToHex(rgb[1]) + ColorToHex(rgb[2]);
}

function ConvertHextoRGB(hex) {
    var red = parseInt(hex[1]+hex[2],16);
    var green = parseInt(hex[3]+hex[4],16);
    var blue = parseInt(hex[5]+hex[6],16);
    return [red, green, blue, alpha];
}

function updateLegendData(header) {
    var oldLegendTable = document.getElementById("legendTable");
    //Remove everything related to legend
    var legendTable = oldLegendTable.cloneNode(true);
    oldLegendTable.parentNode.insertBefore(legendTable, oldLegendTable);
    oldLegendTable.parentNode.removeChild(oldLegendTable);

    legendTable.innerHTML = `<table id="legend-table" class="nospacing" cellspacing="0"><tr><th id="column-selector">${header}<div class="dropdown-columns"></div></th><th>Colour</th></tr></table>`;
    var legend_table = document.getElementById("legend-table");
    var column_selector = document.getElementById("column-selector");
    var col_dropdown = column_selector.children[0];
    Object.keys(mapData[selectedMap]["colourMappingData"]).forEach(function(key) {
    if (key != header) {
        const p_col = document.createElement("p");
        p_col.innerHTML = key;
        p_col.addEventListener("click", function(){
        updateAll(key);
        }, false);
        col_dropdown.appendChild(p_col);
    }
    });
    var filters = [];
    Object.keys(mapData[selectedMap]["colourMappingData"][header]).forEach(function(key) {
    filters.push(key);
    var row = legend_table.insertRow(-1);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    cell1.innerHTML = key;
    cell1.className = "filterSelect";
    cell1.addEventListener("click", function(){
        filterIdx = filters.indexOf(key);
        if (filterIdx != -1) {
        delete filters[filters.indexOf(key)];
        this.style.cursor = "copy";
        this.style.textDecoration = "none";
        } else {
        filters.push(key);
        this.style.cursor = "default";
        this.style.textDecoration = "underline";
        }
        updateData(header);
    }, false);
    mapData[selectedMap]["filters"] = filters;
    const input = document.createElement("input");
    input.type = "color";
    input.value = ConvertRGBtoHex(mapData[selectedMap]["colourMappingData"][header][key]);
    input.className = "colourSelect";
    input.addEventListener("input", function(){
        var c = input.value;
        mapData[selectedMap]["colourMappingData"][header][key] = ConvertHextoRGB(c);
    }, false);
    cell2.appendChild(input);
    });

    var slider = document.getElementById("sliderRange");
    slider.value = 100;
    areaSize = 100;
    slider.oninput = function() {
    areaSize = this.value;
    }
}

function updateAll(header) {
    updateLegendData(header);
    updateData(header);
    createOverlay(header);
}

function changeMapOverlay(event) {
    let currentMap = event.value;
    selectedMap = currentMap;
    updateAll(Object.keys(mapData[selectedMap]["colourMappingData"])[0]);
}

//creates the blank Google Map
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    mapId: "a8bebcab46e22685",
    center: { lat: 48.779, lng: -123.625 },
    zoom: 9,
    disableDoubleClickZoom: true,
    streetViewControl: false
  });
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);
  infowindow = new google.maps.InfoWindow({content: ''});
}

class AnimatedArcLayer extends deck.ArcLayer {
    getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
        'vs:#decl': `\
        uniform vec2 timeRange;
        attribute float instanceSourceTimestamp;
        attribute float instanceTargetTimestamp;
        varying float vTimestamp;
        `,
        'vs:#main-end': `\
            vTimestamp = mix(instanceSourceTimestamp, instanceTargetTimestamp, segmentRatio);
        `,
        'fs:#decl': `\
        uniform vec2 timeRange;
        varying float vTimestamp;
        `,
        'fs:#main-start': `\
        if (vTimestamp < timeRange.x || vTimestamp > timeRange.y) {
            discard;
        }
        `,
        'fs:DECKGL_FILTER_COLOR': `\
        color.a *= (vTimestamp - timeRange.x) / (timeRange.y - timeRange.x);`
    };
        return shaders;
    }

    initializeState() {
    super.initializeState();
    this.getAttributeManager().addInstanced({
        instanceSourceTimestamp: {
        size: 1,
        accessor: 'getSourceTimestamp'
        },
        instanceTargetTimestamp: {
        size: 1,
        accessor: 'getTargetTimestamp'
        }
    });
    }

    draw(params) {
    params.uniforms = Object.assign({}, params.uniforms, {
        timeRange: this.props.timeRange
    });
    super.draw(params);
    }
}

AnimatedArcLayer.layerName = 'AnimatedArcLayer';
AnimatedArcLayer.defaultProps = {
    getSourceTimestamp: {type: 'accessor', value: 0},
    getTargetTimestamp: {type: 'accessor', value: 1},
    timeRange: {type: 'array', compare: true, value: [0, 1]}
};

function importData(spreadsheetData) {
    //importing and setting data from the Google Sheet which is online and publicly shared https://docs.google.com/spreadsheets/d/1AAVrBe_A0SqfTY_l0WxrOhRBVrOOgdJEKrBehxdF0Co/edit#gid=0
    //telling the whole column to read to establish the scatterplot and the start (from) and end (to) points for the arcs
    let data = spreadsheetData.values;
    let arcData = [];
    let geoFeatures1 = [];
    let geoFeatures2 = [];
    let data_headers = {};
    let prop_headers = {};
    for (let i = 0; i < data[0].length; i++) {
    if (data[0][i]) {
        data_headers[data[0][i]] = i;
        prop_headers[`prop${i}`] = data[0][i];
    }
    }

    for (let i = 1; i < data.length; i++) {
    //Add extra properties
    properties = {};
    properties["prop0"] = data[i][data_headers[prop_headers["prop0"]]];
    for (let j = 5; j < data[0].length; j++) {
        let prop_name = `prop${j}`
        properties[prop_name] = data[i][data_headers[prop_headers[prop_name]]];
    }
    arcData.push({
        from: {
        name: 'From',
        coordinates: [Number(data[i][data_headers["Longitude_Origin"]]), Number(data[i][data_headers["Latitude_Origin"]])]
        },

        to: {
        name: 'To',
        coordinates: [Number(data[i][data_headers["Longitude_Site"]]), Number(data[i][data_headers["Latitude_Site"]])]
        },
        ...properties,
        time1: MIN_TIME, //Remove times if added to spreadsheet
        time2: MAX_TIME
    });

    //Start from 0, thus 'i-1' since i starts at 1
    geoFeatures1[i-1] = {
        type: 'Feature',
        geometry: {
        type: 'Point',
        coordinates: [
            Number(data[i][data_headers["Longitude_Site"]]),
            Number(data[i][data_headers["Latitude_Site"]])
        ]
        },
        ...properties
    };

    if (data[i][data_headers["Longitude_Origin"]] && data[i][data_headers["Latitude_Origin"]]) {
        geoFeatures2[i-1] = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [
            Number(data[i][data_headers["Longitude_Origin"]]),
            Number(data[i][data_headers["Latitude_Origin"]])
            ]
        },
        ...properties
        };
    }
    }
    timesImported++;
    let mapSelector = document.getElementById("mapSelector");
    mapData[mapSelector[timesImported].value] = {
        data_headers: data_headers,
        arcData: arcData,
        geoFeatures1: geoFeatures1,
        geoFeatures2: geoFeatures2
    }
}

function createOverlay(header){
    let layerArray = [];
    colourMap = mapData[selectedMap]["colourMappingData"][header];
    if (overlayInterval != -1) {
    clearInterval(overlayInterval);
    overlay.setProps({
        layers: []
    });
    }
    //Real-time updating
    var currentTime = MIN_TIME;
    overlayInterval = setInterval(() => {
    layerArray = [
        new AnimatedArcLayer({
        id: 'arcs-layer',
        data: mapData[selectedMap]["filteredArcData"],
        visible: MIN_TIME - TIME_WINDOW < currentTime && MAX_TIME > currentTime,
        getSourcePosition: d => d.from.coordinates,
        getTargetPosition: d => d.to.coordinates,
        getSourceTimestamp: d => d.time1,
        getTargetTimestamp: d => d.time2,
        getWidth: 3,
        strokeWidth: 3,
        pickable: true,
        timeRange: [currentTime, currentTime + TIME_WINDOW],
        getSourceColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]],
        getTargetColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]],
        updateTriggers: {
            getSourceColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]],
            getTargetColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]]
        }
        }),
        new deck.ArcLayer({
        id: 'static-arcs-layer',
        data: mapData[selectedMap]["filteredArcData"],
        getWidth: 1,
        strokeWidth: 1,
        pickable: true,
        getSourcePosition: d => d.from.coordinates,
        getTargetPosition: d => d.to.coordinates,
        getSourceColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]],
        getTargetColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]],
        updateTriggers: {
            getSourceColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]],
            getTargetColor: d => colourMap[d[`prop${mapData[selectedMap]["data_headers"][header]}`]]
        }
        }),
        new deck.GeoJsonLayer({
        id: 'geoLayerOut',
        data: new Object({type: 'FeatureCollection', features: mapData[selectedMap]["filteredGeoFeatures1"]}),
        pickable: true,
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 300,
        wrapLongitude: true,
        getPointRadius: d => 250 * areaSize * 0.01,
        getFillColor: d => [0, 0, 0, 100]
        }),
        new deck.GeoJsonLayer({
        id: 'geoLayerIn',
        data: new Object({type: 'FeatureCollection', features: mapData[selectedMap]["filteredGeoFeatures2"]}),
        pickable: true,
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 300,
        wrapLongitude: true,
        getPointRadius: d => 500 * areaSize * 0.01,
        getFillColor: d => [222, 0, 1, 150]
        })
    ]
    overlay.setProps({
        layers: [
        ...layerArray
        ]
    });

    currentTime = currentTime + 5;

    if (currentTime >= MAX_TIME) {
        currentTime = MIN_TIME - TIME_WINDOW;
    }
    }, 50);
    overlay.setMap(map);

    //Info window on click
    map.addListener('click', event => {
    const picked = overlay._deck.pickObject({
        x: event.pixel.x,
        y: event.pixel.y,
        radius: 4,
        layerIds: ['static-arcs-layer']
    });

    if (!picked) {
        infowindow.close();
        return;
    }
    infoStr = "";
    Object.keys(mapData[selectedMap]["data_headers"]).forEach(function(key) {
        if (picked.object["prop"+mapData[selectedMap]["data_headers"][key]]) {
        infoStr += `<div> <b>${key}:</b> ${picked.object["prop"+mapData[selectedMap]["data_headers"][key]]}</div>`;
        }
    });
    infowindow.setContent(infoStr);
    infowindow.setPosition({
        lng: picked.coordinate[0],
        lat: picked.coordinate[1],

    });
    infowindow.open(map);
    });
}

function updateData(header) {
    var filteredArcData = mapData[selectedMap]["arcData"].filter(arc => mapData[selectedMap]["filters"].indexOf(arc["prop"+mapData[selectedMap]["data_headers"][header]]) != -1);
    var filteredGeoFeatures1 = mapData[selectedMap]["geoFeatures1"].filter(arc => mapData[selectedMap]["filters"].indexOf(arc["prop"+mapData[selectedMap]["data_headers"][header]]) != -1);
    var filteredGeoFeatures2 = mapData[selectedMap]["geoFeatures2"].filter(arc => mapData[selectedMap]["filters"].indexOf(arc["prop"+mapData[selectedMap]["data_headers"][header]]) != -1);
    mapData[selectedMap]["filteredArcData"] = filteredArcData;
    mapData[selectedMap]["filteredGeoFeatures1"] = filteredGeoFeatures1;
    mapData[selectedMap]["filteredGeoFeatures2"] = filteredGeoFeatures2;
}

//Load legend sidebar after google map has initialized
var startupInterval = setInterval(() => {
    if (document.getElementById('legend').style["visibility"] != "hidden"){
        document.getElementById('mapSelector').value = selectedMap;
        updateAll("Band");
        //TODO: Fix overlay not loading until mouse drag
        clearInterval(startupInterval);
    }
}, 200);