import { map } from './map.js';
import { routeList } from './flightList.js';
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
                    this.drawPaths(route, originIata);
                }
            })
        );
    },

    drawRoutePathsToDestination(destinationIata, directRoutes) {
        const destinationRoutes = directRoutes[destinationIata] || [];
        destinationRoutes.forEach(route => this.drawPaths(route, destinationIata));
    },

    async drawRoutePathBetweenAirports(route, getAirportDataByIata) {
        this.clearRoutePaths();
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
                    routeList.addRouteDetailsToList(routeSegment, this.clearRoutePaths.bind(this));
                }
            });
        } catch (error) {
            console.error('Error in drawRoutePathBetweenAirports:', error);
        }
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
                    this.clearRoutePaths();
                } else {
                    routeList.addRouteDetailsToList(route, this.clearRoutePaths.bind(this));
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

    clearRoutePaths() {
        this.currentLines.forEach(line => {
            let shouldRemove = true;
            appState.routes.forEach(route => {
                let routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                if (this.routePathCache[routeId] && this.routePathCache[routeId].includes(line)) {
                    shouldRemove = false;
                }
            });
            if (shouldRemove && map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    
        // Reset currentLines array
        this.currentLines = this.currentLines.filter(line => {
            return appState.routes.some(route => {
                let routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                return this.routePathCache[routeId] && this.routePathCache[routeId].includes(line);
            });
        });
    
        // Clear cached paths not in the routes array
        Object.keys(this.routePathCache).forEach(cacheKey => {
            let shouldRemove = true;
            appState.routes.forEach(route => {
                let routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                if (cacheKey === routeId) {
                    shouldRemove = false;
                }
            });
            if (shouldRemove) {
                this.routePathCache[cacheKey].forEach(path => {
                    if (map.hasLayer(path)) {
                        map.removeLayer(path);
                    }
                });
                delete this.routePathCache[cacheKey];
            }
        });
    },       
    
    drawPaths(route) {
        // console.log('drawPaths: route:', route);
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
