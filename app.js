document.addEventListener('DOMContentLoaded', function () {
    // ============================ 請在這裡設定您的 Token ============================
    const MAPILLARY_FULL_TOKEN = 'MLY|25053230184274584|6f54c235cc9a903f16230177f9acc623';
    const MAPILLARY_SHORT_TOKEN = '6f54c235cc9a903f16230177f9acc623';
    // ==============================================================================

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
        { title: '法國-伊塞蘭山口', lat: 45.41, lng: 7.03 },
        { title: '荷蘭-鄉村小路', lat: 52.23, lng: 4.93 },
        { title: '紐西蘭-米爾福德峽灣路', lat: -44.97, lng: 168.05 },
        { title: '西班牙-安達盧西亞', lat: 36.76, lng: -5.16 },
        { title: '美國-紀念碑谷', lat: 37.00, lng: -110.00 },
        { title: '澳洲-大洋路', lat: -38.68, lng: 143.35 },
        { title: '南非-查普曼峰', lat: -34.08, lng: 18.35 },
        { title: '冰島-斯科加瀑布', lat: 63.53, lng: -19.51 },
        { title: '葡萄牙-杜羅河谷', lat: 41.15, lng: -7.96 },
        { title: '美國-夏威夷哈納之路', lat: 20.80, lng: -156.12 },
        { title: '蘇格蘭-北海岸500', lat: 58.55, lng: -4.75 },
        { title: '羅馬尼亞-Transfăgărășan', lat: 45.60, lng: 24.61 },
        { title: '韓國-濟州島', lat: 33.25, lng: 126.30 },
    ];

    const mapContainer = document.getElementById('map');
    const simulatorContainer = document.getElementById('simulator');
    const suggestionsContainer = document.getElementById('route-suggestions');

    let map = null;
    let viewer = null;
    let rideInterval = null;
    let isRiding = false;

    function startSimulatorFromCoords(lat, lng) {
        const popup = L.popup().setLatLng([lat, lng]).setContent('正在為您載入路線...').openOn(map);
        const url = `https://graph.mapillary.com/images?access_token=${MAPILLARY_SHORT_TOKEN}&fields=id&closeto=${lng},${lat}&radius=3000`;
        fetch(url).then(r => r.json()).then(d => {
            if (d && d.data && d.data.length > 0) { popup.remove(); startSimulator(d.data[0].id); }
            else { popup.setContent('此座標附近沒有可用的街景照片。'); }
        }).catch(err => popup.setContent('載入路線時發生錯誤。'));
    }

    function initMap() {
        map = L.map('map', { zoomControl: false }).setView([23.9, 121.1], 5);
        L.control.zoom({ position: 'topright' }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 20
        }).addTo(map);

        const mapillaryStyle = {
            version: 8, sources: { mapillary: { type: 'vector', tiles: [`https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_FULL_TOKEN}`] } },
            layers: [
                { id: 'mapillary-sequences', type: 'line', source: 'mapillary', 'source-layer': 'sequence', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#00ff00', 'line-width': 2 } },
                { id: 'mapillary-images', type: 'circle', source: 'mapillary', 'source-layer': 'image', paint: { 'circle-color': '#00ff00', 'circle-radius': 1.5, 'circle-opacity': 0.6 } }
            ]
        };
        const glLayer = L.mapboxGL({ style: mapillaryStyle }).addTo(map);
        const mapboxMap = glLayer.getMapboxMap();

        // *** 修正渲染 Bug 的程式碼 ***
        map.on('zoomend', () => { setTimeout(() => { mapboxMap.resize(); }, 10); });
        map.on('moveend', () => { setTimeout(() => { mapboxMap.resize(); }, 10); });

        mapboxMap.on('load', () => {
            const layers = ['mapillary-sequences', 'mapillary-images'];
            mapboxMap.on('mouseenter', layers, () => { mapboxMap.getCanvas().style.cursor = 'pointer'; });
            mapboxMap.on('mouseleave', layers, () => { mapboxMap.getCanvas().style.cursor = ''; });

            mapboxMap.on('click', 'mapillary-images', (e) => {
                if (e.features.length > 0) startSimulator(e.features[0].properties.id);
            });

            mapboxMap.on('click', 'mapillary-sequences', (e) => {
                if (e.features.length > 0) {
                    const sequenceId = e.features[0].properties.id;
                    const url = `https://graph.mapillary.com/${sequenceId}/images?access_token=${MAPILLARY_SHORT_TOKEN}&fields=id`;
                    fetch(url).then(r => r.json()).then(d => {
                        if (d && d.data && d.data.length > 0) startSimulator(d.data[0].id);
                    });
                }
            });
        });

        createSuggestionButtons();
    }

    function createSuggestionButtons() {
        suggestionsContainer.innerHTML = '';
        const randomBtn = document.createElement('button');
        randomBtn.className = 'btn btn-primary';
        randomBtn.textContent = '隨機探索一個新地點';
        randomBtn.onclick = () => {
            const randomRoute = curated_routes[Math.floor(Math.random() * curated_routes.length)];
            startSimulatorFromCoords(randomRoute.lat, randomRoute.lng);
        };
        suggestionsContainer.appendChild(randomBtn);

        const shuffle = (array) => {
            let currentIndex = array.length, randomIndex;
            while (currentIndex != 0) { randomIndex = Math.floor(Math.random() * currentIndex); currentIndex--;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]; }
            return array;
        }
        const randomRoutes = shuffle(curated_routes).slice(0, 10);
        randomRoutes.forEach(route => {
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

        viewer = new mapillary.Viewer('mly-wrapper', MAPILLARY_FULL_TOKEN, { imageId: String(startImageId) }); // 確保 ID 是字串
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
            viewer.remove(); viewer = null;
            simulatorContainer.classList.add('d-none');
            mapContainer.classList.remove('d-none');
            suggestionsContainer.classList.remove('d-none');
            setTimeout(() => map.invalidateSize(), 10);
            startStopBtn.removeEventListener('click', onStartStop); speedRange.removeEventListener('input', onSpeedChange); backBtn.removeEventListener('click', onBack);
        };

        startStopBtn.addEventListener('click', onStartStop);
        speedRange.addEventListener('input', onSpeedChange);
        backBtn.addEventListener('click', onBack);
    }

    initMap();
});
