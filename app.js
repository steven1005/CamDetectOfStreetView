document.addEventListener('DOMContentLoaded', function () {
    // ============================ 請在這裡設定您的 Token ============================
    const MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN';
    const MAPILLARY_FULL_TOKEN = 'MLY|25053230184274584|6f54c235cc9a903f16230177f9acc623';
    const MAPILLARY_SHORT_TOKEN = '6f54c235cc9a903f16230177f9acc623';
    // ==============================================================================

    if (MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN') {
        alert('請在 app.js 中設定您的 Mapbox Access Token!');
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const curated_routes = [
        { title: '瑞士-貝爾尼納快車', lat: 46.40, lng: 10.02 },
        { title: '台灣-阿里山森林鐵路', lat: 23.51, lng: 120.79 },
        { title: '挪威-弗洛姆鐵路', lat: 60.86, lng: 7.11 },
        { title: '日本-五能線', lat: 40.60, lng: 139.95 },
        { title: '台灣-合歡山', lat: 24.13, lng: 121.27 },
        { title: '義大利-斯泰爾維奧山口', lat: 46.52, lng: 10.45 },
        { title: '瑞士-富卡山口', lat: 46.57, lng: 8.41 },
        { title: '日本-伊呂波山道', lat: 36.74, lng: 139.49 },
        { title: '美國-加州一號公路', lat: 36.27, lng: -121.81 },
        { title: '加拿大-冰原大道', lat: 52.22, lng: -117.22 },
    ];

    const mapContainer = document.getElementById('map');
    const simulatorContainer = document.getElementById('simulator');
    const suggestionsContainer = document.getElementById('route-suggestions');
    
    let map = null;
    let viewer = null;
    let rideInterval = null;
    let isRiding = false;

    function startSimulatorFromCoords(lat, lng) {
        const popup = new mapboxgl.Popup().setLngLat([lng, lat]).setHTML('正在為您載入路線...').addTo(map);
        const url = `https://graph.mapillary.com/images?access_token=${MAPILLARY_SHORT_TOKEN}&fields=id&closeto=${lng},${lat}&radius=3000`;
        fetch(url).then(r => r.json()).then(d => {
            if (d && d.data && d.data.length > 0) { startSimulator(d.data[0].id); }
            else { alert('此座標附近沒有可用的街景照片。'); popup.remove(); }
        }).catch(err => { alert('載入路線時發生錯誤。'); popup.remove(); });
    }

    function addMapillaryLayers(mapInstance) {
        if (mapInstance.getSource('mapillary')) return; // 如果已存在，則不重複添加
        mapInstance.addSource('mapillary', { type: 'vector', tiles: [`https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_FULL_TOKEN}`], minzoom: 6, maxzoom: 14 });
        mapInstance.addLayer({ id: 'mapillary-sequences', type: 'line', source: 'mapillary', 'source-layer': 'sequence', paint: { 'line-color': '#00ff00', 'line-width': 2, 'line-opacity': 0.7 } });
        mapInstance.addLayer({ id: 'mapillary-images', type: 'circle', source: 'mapillary', 'source-layer': 'image', paint: { 'circle-color': '#00ff00', 'circle-radius': 1.5, 'circle-opacity': 0.6 } });
    }

    function initMap() {
        map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/dark-v11', center: [121.1, 23.9], zoom: 5 });
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.on('load', () => {
            addMapillaryLayers(map);
            const layers = ['mapillary-sequences', 'mapillary-images'];
            map.on('mouseenter', layers, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layers, () => { map.getCanvas().style.cursor = ''; });
            map.on('click', 'mapillary-images', (e) => { if (e.features.length > 0) startSimulator(e.features[0].properties.id); });
            map.on('click', 'mapillary-sequences', (e) => {
                if (e.features.length > 0) {
                    const sequenceId = e.features[0].properties.id;
                    const url = `https://graph.mapillary.com/${sequenceId}/images?access_token=${MAPILLARY_SHORT_TOKEN}&fields=id`;
                    fetch(url).then(r => r.json()).then(d => { if (d && d.data && d.data.length > 0) startSimulator(d.data[0].id); });
                }
            });
        });

        // 最後手段：強制重繪圖層
        map.on('moveend', () => {
            if (map.getSource('mapillary')) {
                map.removeLayer('mapillary-images');
                map.removeLayer('mapillary-sequences');
                map.removeSource('mapillary');
                addMapillaryLayers(map);
            }
        });

        createSuggestionButtons();
    }

    function createSuggestionButtons() {
        suggestionsContainer.innerHTML = '';
        const randomBtn = document.createElement('button');
        randomBtn.className = 'btn btn-primary';
        randomBtn.textContent = '隨機探索一個新地點';
        randomBtn.onclick = () => { const r = curated_routes[Math.floor(Math.random() * curated_routes.length)]; startSimulatorFromCoords(r.lat, r.lng); };
        suggestionsContainer.appendChild(randomBtn);
        curated_routes.slice(0, 10).forEach(route => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-light btn-sm';
            btn.textContent = route.title;
            btn.onclick = () => { startSimulatorFromCoords(route.lat, route.lng); };
            suggestionsContainer.appendChild(btn);
        });
    }

    function startSimulator(startImageId) {
        mapContainer.classList.add('d-none');
        suggestionsContainer.classList.add('d-none');
        simulatorContainer.classList.remove('d-none');
        viewer = new mapillary.Viewer('mly-wrapper', MAPILLARY_FULL_TOKEN, { imageId: String(startImageId) });
        window.addEventListener('resize', () => viewer && viewer.resize());
        const startStopBtn = document.getElementById('startStopBtn');
        const speedRange = document.getElementById('speedRange');
        const speedValue = document.getElementById('speedValue');
        const backBtn = document.getElementById('backBtn');
        const speedSettings = { 1: { interval: 2500, text: '非常慢' }, 2: { interval: 1800, text: '慢' }, 3: { interval: 1200, text: '中等' }, 4: { interval: 800, text: '快' }, 5: { interval: 500, text: '非常快' } };
        function startRide() { isRiding = true; startStopBtn.textContent = '停止騎乘'; startStopBtn.classList.replace('btn-success', 'btn-danger'); const c = speedSettings[speedRange.value].interval; rideInterval = setInterval(() => { viewer.moveDir(1).catch(() => stopRide()); }, c); }
        function stopRide() { isRiding = false; clearInterval(rideInterval); rideInterval = null; startStopBtn.textContent = '開始騎乘'; startStopBtn.classList.replace('btn-danger', 'btn-success'); }
        const onStartStop = () => { isRiding ? stopRide() : startRide(); };
        const onSpeedChange = () => { speedValue.textContent = speedSettings[speedRange.value].text; if (isRiding) { stopRide(); startRide(); } };
        const onBack = () => {
            if (isRiding) stopRide();
            if (viewer) viewer.remove();
            viewer = null;
            simulatorContainer.classList.add('d-none');
            mapContainer.classList.remove('d-none');
            suggestionsContainer.classList.remove('d-none');
            if (map) map.resize();
            startStopBtn.removeEventListener('click', onStartStop);
            speedRange.removeEventListener('input', onSpeedChange);
            backBtn.removeEventListener('click', onBack);
        };
        startStopBtn.addEventListener('click', onStartStop);
        speedRange.addEventListener('input', onSpeedChange);
        backBtn.addEventListener('click', onBack);
    }

    initMap();
});