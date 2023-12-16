var map = L.map('map', { minZoom: 2, maxZoom: 19 });

// Set a default view in case IP geolocation fails
map.setView([0, 0], 4);

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Event listener for zoom level change
map.on('zoomend', function() {
    var zoomLevel = map.getZoom();
    console.log('Map zoom level:', zoomLevel);
    document.dispatchEvent(new CustomEvent('zoomChanged'));
});

// Fetch client's approximate location using IP-API
fetch('http://ip-api.com/json/')
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Set map view to the obtained location
            map.setView([data.lat, data.lon], 4);
        } else {
            console.error('IP Geolocation failed:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching IP Geolocation:', error);
    });

export { map };
