import { map } from './map.js';
import { routeList } from './routeList.js';
import { updateState, appState } from './stateManager.js';

const pathDrawing = {
    currentLines: [],
    routePathCache: {},

    drawRoutePaths(iata, directRoutes) {
        let cacheKey = appState.routePathToggle + '_' + iata;
        if (this.routePathCache[cacheKey]) {
            this.routePathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    // console.log('Adding path to map');
                    path.addTo(map);
                }
            });
        } else {
            appState.RoutePathToggle === 'to' ? this.drawRoutePathsToDestination(iata, directRoutes) : this.drawRoutePathsFromOrigin(iata, directRoutes);
        }
    },
    
    drawRoutePathsFromOrigin(originIata, directRoutes) {
        Object.values(directRoutes).forEach(routes =>
            routes.forEach(route => {
                if (route.originAirport.iata_code === originIata) {
                    this.drawPaths(route);
                }
            })
        );
    },

    drawRoutePathsToDestination(destinationIata, directRoutes) {
        const destinationRoutes = directRoutes[destinationIata] || [];
        destinationRoutes.forEach(route => this.drawPaths(route));
    },

    async drawRoutePathBetweenAirports(route, getAirportDataByIata) {
        try {
            if (!route || !Array.isArray(route.segmentCosts)) {
                console.error('Invalid route data:', route);
                return;
            }

            const airportPromises = route.segmentCosts.map(segment => {
                return Promise.all([getAirportDataByIata(segment.from), getAirportDataByIata(segment.to)]);
            });

            const airportPairs = await Promise.all(airportPromises);
            airportPairs.forEach(([originAirport, destinationAirport], index) => {
                if (originAirport && destinationAirport) {
                    const routeSegment = {
                        originAirport: originAirport,
                        destinationAirport: destinationAirport,
                        price: route.segmentCosts[index].price
                    };

                    this.createRoutePath(originAirport, destinationAirport, routeSegment, 0);
                    routeList.addRouteDetailsToList(routeSegment, this.clearLines.bind(this));
                }
            });
        } catch (error) {
            console.error('Error in drawRoutePathBetweenAirports:', error);
        }
    },

    drawDashedLine(originAirport, destinationAirport) {
        const drawPath = (origin, destination, offset) => {
            const adjustedOrigin = L.latLng(origin.latitude, origin.longitude + offset);
            const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);
    
            var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 2,
                opacity: 0.5,
                color: 'white',
                dashArray: '5, 10', // Dashed line style
                wrap: false
            }).addTo(map);
    
            this.currentLines.push(geodesicLine);
        };
    
        const worldCopies = [-720, -360, 0, 360, 720];
        worldCopies.forEach(offset => {
            drawPath(originAirport, destinationAirport, offset);
        });

    },    

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },
    
    createRoutePath(origin, destination, route) {
        let routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
        if (this.routePathCache[routeId]) {
            this.routePathCache[routeId].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
            });
            return;
        }
    
        const drawPath = (origin, destination, offset) => {
            const adjustedOrigin = L.latLng(origin.latitude, origin.longitude + offset);
            const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);
    
            var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 1,
                opacity: 1,
                color: this.getColorBasedOnPrice(route.price),
                wrap: false,
                zIndex: -1
            }).addTo(map);
    
            geodesicLine.route = route;
    
            geodesicLine.on('click', () => {
                if (routeList.isRouteListed(route)) {
                    routeList.removeRouteFromList(route);
                    this.clearLines();
                } else {
                    routeList.addRouteDetailsToList(route, this.clearLines.bind(this));
                }
            });
    
            geodesicLine.on('mouseover', (e) => {
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(`Price: $${route.price}`)
                    .openOn(map);
            });
    
            geodesicLine.on('mouseout', () => {
                map.closePopup();
            });
    
            if (appState.routes.some(r => r === route)) {
                var planeIcon = L.icon({
                    iconUrl: '../assets/plane_icon.png',
                    iconSize: [16, 16],
                    iconAnchor: [8, 12]
                });
    
                var planeSymbol = L.Symbol.marker({
                    rotate: true,
                    markerOptions: {
                        icon: planeIcon
                    }
                });
    
                var decoratedLine = L.polylineDecorator(geodesicLine, {
                    patterns: [
                        {offset: '50%', repeat: 0, symbol: planeSymbol}
                    ]
                }).addTo(map);
    
                this.currentLines.push(geodesicLine, decoratedLine);
                if (!this.routePathCache[routeId]) {
                    this.routePathCache[routeId] = [];
                }
                this.routePathCache[routeId].push(geodesicLine, decoratedLine);
            } else {
                this.currentLines.push(geodesicLine);
                if (!this.routePathCache[routeId]) {
                    this.routePathCache[routeId] = [];
                }
                this.routePathCache[routeId].push(geodesicLine);
            }
        };
    
        const worldCopies = [-720, -360, 0, 360, 720];
        worldCopies.forEach(offset => {
            drawPath(origin, destination, offset);
        });
    },          

    clearLines() {
        // Remove lines tracked in currentLines from the map
        pathDrawing.currentLines.forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    
        // Remove lines from the routePathCache from the map
        Object.keys(pathDrawing.routePathCache).forEach(cacheKey => {
            pathDrawing.routePathCache[cacheKey].forEach(path => {
                if (map.hasLayer(path)) {
                    map.removeLayer(path);
                }
            });
        });
    
        // Reset the currentLines array but retain the routePathCache
        pathDrawing.currentLines = [];
    },    
    
    drawLines() {
        console.log('appState: drawing lines');
        // Iterate through each pair of consecutive waypoints
        for (let i = 0; i < appState.waypoints.length - 1; i++) {
            const origin = appState.waypoints[i];
            const destination = appState.waypoints[i + 1];
    
            // Check if there is a route between the origin and destination
            const route = appState.routes.find(route => 
                route.originAirport.iata_code === origin.iata_code && 
                route.destinationAirport.iata_code === destination.iata_code
            );
    
            if (route) {
                if (route.isDirect) {
                    // Draw a regular line for direct routes
                    pathDrawing.createRoutePath(origin, destination, route);
                } else {
                    // Draw a dashed line for non-direct routes
                    pathDrawing.drawDashedLine(origin, destination);
                }
            }
        }
    },        
    
    drawPaths(route) {
        this.createRoutePath(route.originAirport, route.destinationAirport, route, 0);
    },       

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },

    adjustLongitude(longitude) {
        var currentBounds = map.getBounds();
        var newLng = longitude;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return newLng;
    },
};

export { pathDrawing };
