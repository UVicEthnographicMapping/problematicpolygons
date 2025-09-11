const alpha = 194; // Opacity of arcs
const TIME_WINDOW = 200; // Length of the arc animated tail
const MIN_TIME = 1500;
const MAX_TIME = 2000;

var infowindow;
var map;
var mapData = {};
var selectedMap = "ppoly"; // Default value (first choice in mapSelector)
var areaSize = 100;
var timesImported = -1; // Keep track of imported data

// KEEP THESE 2 VARIABLES GLOBAL
const overlay = new deck.GoogleMapsOverlay({});
var overlayInterval = -1;

// ===== Usage constants (labels) =====
const USAGE_CODES = ["A", "B", "C", "D", "E"]; // internal letters
const USAGE_LABELS = {
  A: "Village Site",
  B: "Seasonally Occupied Site",
  C: "Resource Procurement Site",
  D: "Mythological Site",
  E: "Other Significance/Use"
};
const USAGE_ALL = "ALL";

// Slider default fraction for emphasized usage (~40%)
const USAGE_SLIDER_DEFAULT_FRACTION = 0.4;

// Helpers: color conversions (for potential future use)
function ColorToHex(color) { const h = color.toString(16); return h.length == 1 ? "0" + h : h; }
function ConvertRGBtoHex(rgb) { return "#" + ColorToHex(rgb[0]) + ColorToHex(rgb[1]) + ColorToHex(rgb[2]); }
function ConvertHextoRGB(hex) { return [parseInt(hex[1]+hex[2],16), parseInt(hex[3]+hex[4],16), parseInt(hex[5]+hex[6],16), alpha]; }

// Parse the Usage cell into tokens A–E, tolerant to commas/semicolons/slashes/spaces
function usageTokens(value) {
  if (!value) return [];
  const tokens = String(value).toUpperCase().match(/[A-E]/g);
  return tokens ? tokens : [];
}

function importColour(spreadsheetData) {
  let data = spreadsheetData.values;
  var metadata = data[0][0].split('.');
  var mapName = metadata[0];
  var columnName = metadata[1];
  var colourMappingData = {};
  let cdata_headers = {};
  cdata_headers[columnName] = 0;
  for (let i = 1; i < data[0].length; i++) { cdata_headers[data[0][i]] = i; }
  for (let i = 1; i < data.length; i++) {
    colourMappingData[data[i][cdata_headers[columnName]]] = [
      Number(data[i][cdata_headers["r"]]),
      Number(data[i][cdata_headers["g"]]),
      Number(data[i][cdata_headers["b"]]),
      alpha
    ];
  }
  if (mapData[mapName]["colourMappingData"] == null) { mapData[mapName]["colourMappingData"] = {}; }
  mapData[mapName]["colourMappingData"][columnName] = colourMappingData;
}

function importData(spreadsheetData) {
  // Importing and setting data from the Google Sheet
  let data = spreadsheetData.values;
  let arcData = [];
  let geoFeatures1 = [];
  let geoFeatures2 = [];
  let data_headers = {};
  let prop_headers = {};
  for (let i = 0; i < data[0].length; i++) {
    if (data[0][i]) { data_headers[data[0][i]] = i; prop_headers[`prop${i}`] = data[0][i]; }
  }
  for (let i = 1; i < data.length; i++) {
    let properties = {};
    properties["prop0"] = data[i][data_headers[prop_headers["prop0"]]];
    for (let j = 5; j < data[0].length; j++) {
      let prop_name = `prop${j}`;
      properties[prop_name] = data[i][data_headers[prop_headers[prop_name]]];
    }
    arcData.push({
      from: { name: 'From', coordinates: [Number(data[i][data_headers["Longitude_Origin"]]), Number(data[i][data_headers["Latitude_Origin"]])] },
      to:   { name: 'To',   coordinates: [Number(data[i][data_headers["Longitude_Site"]]),   Number(data[i][data_headers["Latitude_Site"]])]   },
      ...properties,
      time1: MIN_TIME,
      time2: MAX_TIME
    });

    geoFeatures1[i - 1] = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ Number(data[i][data_headers["Longitude_Site"]]), Number(data[i][data_headers["Latitude_Site"]]) ] },
      ...properties
    };

    if (data[i][data_headers["Longitude_Origin"]] && data[i][data_headers["Latitude_Origin"]]) {
      geoFeatures2[i - 1] = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ Number(data[i][data_headers["Longitude_Origin"]]), Number(data[i][data_headers["Latitude_Origin"]]) ] },
        ...properties
      };
    }
  }
  timesImported++;
  let mapSelector = document.getElementById("mapSelector");
  // Initialize per-map UI state for this simplified Option B′
  mapData[mapSelector[timesImported].value] = {
    data_headers: data_headers,
    arcData: arcData,
    geoFeatures1: geoFeatures1,
    geoFeatures2: geoFeatures2,
    colourMappingData: mapData[mapSelector[timesImported].value]?.colourMappingData || {},
    colorBy: 'Band',       // always color by Language or Band (default Language)
    usageFilter: USAGE_ALL     // 'ALL' or one of 'A'..'E'
  };
}

function setSliderDefault(emphasize) {
  var slider = document.getElementById("sliderRange");
  if (!slider) return;
  var min = Number(slider.min || 50);
  var max = Number(slider.max || 1000);
  if (emphasize) {
    var v = Math.round(min + USAGE_SLIDER_DEFAULT_FRACTION * (max - min));
    slider.value = v; areaSize = v;
  } else {
    slider.value = 100; areaSize = 100;
  }
  slider.oninput = function () { areaSize = this.value; };
}

function buildSegmentedControl(container, current) {
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'tablist');
  wrap.style.display = 'grid';
  wrap.style.gridTemplateColumns = '1fr 1fr';
  wrap.style.border = '1px solid #ccc';
  wrap.style.borderRadius = '999px';
  wrap.style.overflow = 'hidden';
  wrap.style.margin = '4px 0 8px 0';

  function makeTab(label) {
    const tab = document.createElement('button');
    tab.textContent = label;
    tab.style.border = 'none';
    tab.style.padding = '6px 10px';
    tab.style.cursor = 'pointer';
    tab.style.fontWeight = '600';
    tab.style.background = (label === current ? '#222' : 'transparent');
    tab.style.color = (label === current ? '#fff' : '#222');
    tab.addEventListener('click', function(){
      if (mapData[selectedMap].colorBy === label) return;
      mapData[selectedMap].colorBy = label;      // switch color-by
      mapData[selectedMap].usageFilter = USAGE_ALL; // reset Use to All
      updateAll(label);
    });
    return tab;
  }

  wrap.appendChild(makeTab('Language'));
  wrap.appendChild(makeTab('Band'));

  const label = document.createElement('div');
  label.textContent = 'Color by';
  label.style.fontSize = '12px';
  label.style.fontWeight = '600';
  label.style.marginTop = '6px';

  container.appendChild(label);
  container.appendChild(wrap);
}

function buildUseRadioList(container) {
  const blockLabel = document.createElement('div');
  blockLabel.textContent = 'Filter by Use';
  blockLabel.style.fontSize = '12px';
  blockLabel.style.fontWeight = '600';
  blockLabel.style.margin = '6px 0';
  container.appendChild(blockLabel);

  const list = document.createElement('div');
  list.setAttribute('role', 'radiogroup');

  function addOption(key, labelText) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.padding = '4px 2px';
    row.style.cursor = 'pointer';

    const dot = document.createElement('div');
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.border = '2px solid #666';
    dot.style.marginRight = '8px';
    dot.style.boxSizing = 'border-box';

    const label = document.createElement('div');
    label.textContent = labelText;

    const isSelected = (mapData[selectedMap].usageFilter === key) || (key === USAGE_ALL && mapData[selectedMap].usageFilter === USAGE_ALL);
    if (isSelected) { dot.style.background = '#666'; label.style.fontWeight = '600'; }

    row.addEventListener('mouseenter', function(){ row.style.background = '#f4f4f4'; });
    row.addEventListener('mouseleave', function(){ row.style.background = 'transparent'; });

    row.addEventListener('click', function(){
      // toggle behavior: selecting an already-selected specific use switches to ALL
      if (mapData[selectedMap].usageFilter === key && key !== USAGE_ALL) {
        mapData[selectedMap].usageFilter = USAGE_ALL;
      } else {
        mapData[selectedMap].usageFilter = key;
      }
      // Slider emphasis for specific use
      setSliderDefault(mapData[selectedMap].usageFilter !== USAGE_ALL);
      updateAll(mapData[selectedMap].colorBy);
    });

    row.appendChild(dot); row.appendChild(label); list.appendChild(row);
  }

  addOption(USAGE_ALL, 'All Uses');
  USAGE_CODES.forEach(code => addOption(code, USAGE_LABELS[code]));

  container.appendChild(list);
}

function updateLegendData(header) {
  // Rebuild legend markup with minimal, modern UI
  var oldLegendTable = document.getElementById("legendTable");
  var legendTable = oldLegendTable.cloneNode(true);
  oldLegendTable.parentNode.insertBefore(legendTable, oldLegendTable);
  oldLegendTable.parentNode.removeChild(oldLegendTable);

  // Base shell: empty table (no header row)
  legendTable.innerHTML = `<table id=\"legend-table\" class=\"nospacing\" cellspacing=\"0\"></table>`;

  var legend_table = document.getElementById("legend-table");
  var row = legend_table.insertRow(-1); // one row, left cell holds our controls
  var cell = row.insertCell(0);
  cell.colSpan = 2;

  const isSmakw = (selectedMap === 'smakw');
  const colorBy = mapData[selectedMap].colorBy || 'Band';

  if (!isSmakw) {
    // Full UI for Problematic Polygons: segmented control + Use filter
    buildSegmentedControl(cell, colorBy);
    buildUseRadioList(cell);
  }

  // === Color legend ===
  const colorsLabel = document.createElement('div');
  colorsLabel.textContent = `${colorBy} colors`;
  colorsLabel.style.fontSize = '12px';
  colorsLabel.style.fontWeight = '600';
  colorsLabel.style.margin = '6px 0 4px 0';
  cell.appendChild(colorsLabel);

  const colorLegendWrap = document.createElement('div');
  colorLegendWrap.style.display = 'grid';
  colorLegendWrap.style.gridTemplateColumns = 'auto 1fr';
  colorLegendWrap.style.rowGap = '6px';
  colorLegendWrap.style.columnGap = '8px';

  const colMap = (mapData[selectedMap]["colourMappingData"] || {})[colorBy];
  if (colMap) {
    Object.keys(colMap).forEach(function(key){
      const rgba = colMap[key];
      const swatch = document.createElement('div');
      // small rectangular chip similar to original inputs
      swatch.style.width = '2em';
      swatch.style.height = '1em';
      swatch.style.borderRadius = '2px';
      swatch.style.border = '1px solid rgba(0,0,0,0.25)';
      swatch.style.background = `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`;

      const label = document.createElement('div');
      label.textContent = key;
      label.style.fontSize = '13px';

      colorLegendWrap.appendChild(swatch);
      colorLegendWrap.appendChild(label);
    });
  } else {
    const loading = document.createElement('div');
    loading.textContent = 'Loading colors…';
    loading.style.fontSize = '12px';
    loading.style.color = '#555';
    colorLegendWrap.appendChild(loading);
  }
  cell.appendChild(colorLegendWrap);

  // Slider block (kept for both modes)
  const sliderWrap = document.createElement('div');
  sliderWrap.style.marginTop = '8px';
  const sliderLabel = document.createElement('div');
  sliderLabel.textContent = 'Circle scale';
  sliderLabel.style.fontSize = '12px';
  sliderLabel.style.fontWeight = '600';
  sliderWrap.appendChild(sliderLabel);

  // Defaults: emphasize only when a specific Use is selected (PP only). For Smakw, always small default.
  setSliderDefault(!isSmakw && mapData[selectedMap].usageFilter !== USAGE_ALL);
}

function updateAll(header) {
  // header is expected to be 'Language' or 'Band' (color source)
  mapData[selectedMap].colorBy = header || mapData[selectedMap].colorBy || 'Band';
  updateLegendData(mapData[selectedMap].colorBy);
  updateData(mapData[selectedMap].colorBy);
  createOverlay(mapData[selectedMap].colorBy);
}

function changeMapOverlay(event) {
  selectedMap = event.value;

  // Determine available colour keys for this dataset
  const colourKeys = Object.keys((mapData[selectedMap] && mapData[selectedMap].colourMappingData) || {});

  // Smakwuts: minimal UI (no filters / segmented control). Just color by the first available key.
  if (selectedMap === 'smakw') {
    const firstKey = colourKeys.length ? colourKeys[0] : 'Band';
    mapData[selectedMap].colorBy = firstKey;
    mapData[selectedMap].usageFilter = USAGE_ALL; // ensure no filtering
    updateAll(firstKey);
    return;
  }

  // Default dataset (Problematic Polygons): keep Band as default and allow filters
  mapData[selectedMap].colorBy = 'Band';
  mapData[selectedMap].usageFilter = USAGE_ALL;
  updateAll('Band');
}

// Google Map init
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    mapId: "a8bebcab46e22685",
    center: { lat: 48.779, lng: -123.625 },
    zoom: 9,
    disableDoubleClickZoom: true,
    streetViewControl: false
  });
  map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);
  infowindow = new google.maps.InfoWindow({ content: '' });
}

class AnimatedArcLayer extends deck.ArcLayer {
  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      'vs:#decl': `\
        uniform vec2 timeRange;\
        attribute float instanceSourceTimestamp;\
        attribute float instanceTargetTimestamp;\
        varying float vTimestamp;\
      `,
      'vs:#main-end': `\
            vTimestamp = mix(instanceSourceTimestamp, instanceTargetTimestamp, segmentRatio);\
        `,
      'fs:#decl': `\
        uniform vec2 timeRange;\
        varying float vTimestamp;\
        `,
      'fs:#main-start': `\
        if (vTimestamp < timeRange.x || vTimestamp > timeRange.y) {\
            discard;\
        }\
        `,
      'fs:DECKGL_FILTER_COLOR': `\
        color.a *= (vTimestamp - timeRange.x) / (timeRange.y - timeRange.x);`
    };
    return shaders;
  }
  initializeState() {
    super.initializeState();
    this.getAttributeManager().addInstanced({
      instanceSourceTimestamp: { size: 1, accessor: 'getSourceTimestamp' },
      instanceTargetTimestamp: { size: 1, accessor: 'getTargetTimestamp' }
    });
  }
  draw(params) {
    params.uniforms = Object.assign({}, params.uniforms, { timeRange: this.props.timeRange });
    super.draw(params);
  }
}
AnimatedArcLayer.layerName = 'AnimatedArcLayer';
AnimatedArcLayer.defaultProps = {
  getSourceTimestamp: { type: 'accessor', value: 0 },
  getTargetTimestamp: { type: 'accessor', value: 1 },
  timeRange: { type: 'array', compare: true, value: [0, 1] }
};

function createOverlay(header) {
  // header is 'Language' or 'Band'
  if (overlayInterval != -1) {
    clearInterval(overlayInterval);
    overlay.setProps({ layers: [] });
  }

  // Color map based on current colorBy header
  const colourMap = mapData[selectedMap]["colourMappingData"][header];
  const idxHeader = mapData[selectedMap]["data_headers"][header];

  var currentTime = MIN_TIME;
  overlayInterval = setInterval(() => {
    const getColorForFeature = (d) => {
      const val = d[`prop${idxHeader}`];
      return colourMap[val];
    };

    const layerArray = [
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
        getSourceColor: getColorForFeature,
        getTargetColor: getColorForFeature,
        updateTriggers: { getSourceColor: currentTime, getTargetColor: currentTime }
      }),
      new deck.ArcLayer({
        id: 'static-arcs-layer',
        data: mapData[selectedMap]["filteredArcData"],
        getWidth: 1,
        strokeWidth: 1,
        pickable: true,
        getSourcePosition: d => d.from.coordinates,
        getTargetPosition: d => d.to.coordinates,
        getSourceColor: getColorForFeature,
        getTargetColor: getColorForFeature,
        updateTriggers: { getSourceColor: currentTime, getTargetColor: currentTime }
      }),
      new deck.GeoJsonLayer({
        id: 'geoLayerOut',
        data: new Object({ type: 'FeatureCollection', features: mapData[selectedMap]["filteredGeoFeatures1"] }),
        pickable: true,
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 300,
        wrapLongitude: true,
        getPointRadius: d => 250 * areaSize * 0.01,
        getFillColor: d => [0, 0, 0, 100]
      }),
      new deck.GeoJsonLayer({
        id: 'geoLayerIn',
        data: new Object({ type: 'FeatureCollection', features: mapData[selectedMap]["filteredGeoFeatures2"] }),
        pickable: true,
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 300,
        wrapLongitude: true,
        getPointRadius: d => 500 * areaSize * 0.01,
        getFillColor: d => [222, 0, 1, 150]
      })
    ];

    overlay.setProps({ layers: layerArray });

    currentTime = currentTime + 5;
    if (currentTime >= MAX_TIME) { currentTime = MIN_TIME - TIME_WINDOW; }
  }, 50);
  overlay.setMap(map);

  // Info window on click
  map.addListener('click', event => {
    const picked = overlay._deck.pickObject({ x: event.pixel.x, y: event.pixel.y, radius: 4, layerIds: ['static-arcs-layer'] });
    if (!picked) { infowindow.close(); return; }
    let infoStr = "";
    Object.keys(mapData[selectedMap]["data_headers"]).forEach(function (key) {
      if (picked.object["prop" + mapData[selectedMap]["data_headers"][key]]) {
        infoStr += `<div> <b>${key}:</b> ${picked.object["prop" + mapData[selectedMap]["data_headers"][key]]}</div>`;
      }
    });
    infowindow.setContent(infoStr);
    infowindow.setPosition({ lng: picked.coordinate[0], lat: picked.coordinate[1] });
    infowindow.open(map);
  });
}

function updateData(header) {
  // Filter by Use only (no category filters in this minimal UI)
  const idxUse = mapData[selectedMap]["data_headers"]["Usage"];
  const selectedUse = mapData[selectedMap].usageFilter; // 'ALL' or 'A'..'E'

  const passUse = (val) => {
    if (selectedUse === USAGE_ALL) return true;
    const tokens = usageTokens(val);
    return tokens.indexOf(selectedUse) !== -1;
  };

  var filteredArcData = mapData[selectedMap]["arcData"].filter(arc => passUse(arc["prop" + idxUse]));
  var filteredGeoFeatures1 = mapData[selectedMap]["geoFeatures1"].filter(f => passUse(f["prop" + idxUse]));
  var filteredGeoFeatures2 = mapData[selectedMap]["geoFeatures2"].filter(f => passUse(f["prop" + idxUse]));

  mapData[selectedMap]["filteredArcData"] = filteredArcData;
  mapData[selectedMap]["filteredGeoFeatures1"] = filteredGeoFeatures1;
  mapData[selectedMap]["filteredGeoFeatures2"] = filteredGeoFeatures2;
}

// Load legend sidebar after google map has initialized
var startupInterval = setInterval(() => {
  if (document.getElementById('legend').style["visibility"] != "hidden") {
    document.getElementById('mapSelector').value = selectedMap;
    // Default to Language with All Uses
    if (!mapData[selectedMap]) { return; }
    mapData[selectedMap].colorBy = 'Band';
    mapData[selectedMap].usageFilter = USAGE_ALL;
    updateAll('Band');
    clearInterval(startupInterval);
  }
}, 200);
