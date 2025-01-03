import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { lineManager } from './lineManager.js';

class Line {
    constructor(origin, destination, routeId, type, options = {}) {
        this.iata = options.iata;
        this.origin = origin;
        this.destination = destination;
        this.routeId = routeId; // Ensure routeId is stored in the Line instance
        this.type = type;
        this.map = map;
        this.defaultWeight = 1;
        this.defaultColor = this.getColorBasedOnPrice(options.price);
        this.color = options.color || this.defaultColor;
        this.weight = options.weight || this.defaultWeight;
        this.visibleLine = this.createVisibleLine();
        this.invisibleLine = this.createInvisibleLine();
        this.decoratedLine = options.showPlane ? this.createDecoratedLine() : null;
        this.bindEvents();
        this.tags = new Set(); // Initialize tags as an empty Set
        this.addTag(`route:${routeId}`);
        this.addTag(`type:${type}`);
        if (options.isTableRoute) {
            this.addTag('type:table');
        }
        if (options.group) {
            this.addTag(`group:${options.group}`);
        }

        // Add tags based on price
        if (options.price !== undefined && options.price !== null) {
            this.addTag(`price:${options.price}`);
            if (options.price < 100) {
                this.addTag('price-range:0-100');
            } else if (options.price < 200) {
                this.addTag('price-range:100-200');
            } else if (options.price < 300) {
                this.addTag('price-range:200-300');
            } else if (options.price < 400) {
                this.addTag('price-range:300-400');
            } else if (options.price < 500) {
                this.addTag('price-range:400-500');
            } else {
                this.addTag('price-range:500+');
            }
        }
        // Add tags for departure and arrival time ranges
        if (options.departureTime) {
            if (options.departureTime < 6) {
                this.addTag('departure-range:00-06');
            } else if (options.departureTime < 12) {
                this.addTag('departure-range:06-12');
            } else if (options.departureTime < 18) {
                this.addTag('departure-range:12-18');
            } else {
                this.addTag('departure-range:18-24');
            }
        }
        if (options.arrivalTime) {
            if (options.arrivalTime < 6) {
                this.addTag('arrival-range:00-06');
            } else if (options.arrivalTime < 12) {
                this.addTag('arrival-range:06-12');
            } else if (options.arrivalTime < 18) {
                this.addTag('arrival-range:12-18');
            } else {
                this.addTag('arrival-range:18-24');
            }
        }
        // Add tags for direct/indirect flights
        if (options.isDirect) {
            this.addTag('direct:true');
        } else {
            this.addTag('direct:false');
        }
        console.log(`Line created with routeId: ${this.routeId} and tags: `, this.tags);
    }

    addTag(tag) {
        this.tags.add(tag);
    }

    removeTag(tag) {
        this.tags.delete(tag);
    }

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    }

    createVisibleLine() {
        const adjustedOrigin = L.latLng(this.origin.latitude, this.origin.longitude);
        const adjustedDestination = L.latLng(this.destination.latitude, this.destination.longitude);
        return new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: this.weight,
            opacity: 1,
            color: this.color,
            wrap: false,
            zIndex: -1
        }).addTo(this.map);
    }

    createInvisibleLine() {
        const adjustedOrigin = L.latLng(this.origin.latitude, this.origin.longitude);
        const adjustedDestination = L.latLng(this.destination.latitude, this.destination.longitude);
        return new L.Geodesic([adjustedOrigin, adjustedDestination], {
            weight: 10,
            opacity: 0.1,
            wrap: false
        }).addTo(this.map);
    }

    createDecoratedLine() {
        const planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        const planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        return L.polylineDecorator(this.visibleLine, {
            patterns: [
                { offset: '50%', repeat: 0, symbol: planeSymbol }
            ]
        }).addTo(this.map);
    }

    bindEvents() {
        // Pass lineManager to the event handlers
        this.visibleLine.on('click', (e) => lineManager.onClickHandler(e, this));
        this.invisibleLine.on('click', (e) => lineManager.onClickHandler(e, this));

        this.invisibleLine.on('mouseover', (e) => lineManager.onMouseOver(e, this, this.map));
        this.invisibleLine.on('mouseout', () => lineManager.onMouseOut(this));

        if (this.decoratedLine) {
            this.decoratedLine.on('click', (e) => this.invisibleLine.fire('click', e));
            this.decoratedLine.on('mouseover', (e) => lineManager.onMouseOver(e, this, this.map));
            this.decoratedLine.on('mouseout', () => lineManager.onMouseOut(this));
        }
    }

    highlight() {
        this.visibleLine.setStyle({ color: 'white' });
    }

    reset() {
        console.log('Resetting line:', this.routeId);
        this.visibleLine.setStyle({
            color: this.color,
            weight: this.weight,
            opacity: 1
        });
    }

    remove() {
        if (this.map.hasLayer(this.visibleLine)) this.map.removeLayer(this.visibleLine);
        if (this.map.hasLayer(this.invisibleLine)) this.map.removeLayer(this.invisibleLine);
        if (this.decoratedLine && this.map.hasLayer(this.decoratedLine)) this.map.removeLayer(this.decoratedLine);
    }
}

const pathDrawing = {
    currentLines: [],
    routePathCache: {},
    dashedRoutePathCache: {},
    hoverLines: [],

    drawLine: function (routeId, type, options) {
        console.log('Drawing line:', routeId, type, options);
        const [originIata, destinationIata] = routeId.split('-');
        if (!originIata || !destinationIata) {
            console.error('Invalid routeId format:', routeId);
            return;
        }
        flightMap.getAirportDataByIata(originIata).then(originAirport => {
            flightMap.getAirportDataByIata(destinationIata).then(destinationAirport => {
                if (!originAirport || !destinationAirport) {
                    console.error('Airport data not found for one or both IATAs:', originIata, destinationIata);
                    return;
                }
                // Create an instance of the Line class
                const line = new Line(originAirport, destinationAirport, routeId, type, options);
                console.log('Created Line instance with routeId:', line.routeId);

                // Store the Line instance
                if (type === 'route') {
                    if (!this.routePathCache[routeId]) {
                        this.routePathCache[routeId] = [];
                    }
                    this.routePathCache[routeId].push(line);
                } else if (type === 'dashed') {
                    if (!this.dashedRoutePathCache[routeId]) {
                        this.dashedRoutePathCache[routeId] = [];
                    }
                    this.dashedRoutePathCache[routeId].push(line);
                } else if (type === 'hover') {
                    this.hoverLines.push(line);
                }

                console.log('Stored line in cache:', this.routePathCache);
            });
        });
    },

    drawRoutePaths(iata, directRoutes, type = 'route') {
        directRoutes[iata]?.forEach(route => {
            const routeId = `${route.origin}-${route.destination}`;
            if (!route.origin || !route.destination) {
                console.error('Invalid route data:', route);
                return;
            }
            this.drawLine(routeId, type, { price: route.price, iata: iata });
        });
    },

    drawDashedLine(origin, destination) {
        if (!origin || !destination) {
            console.error('Invalid airport data for dashed line:', origin, destination);
            return;
        }
        this.drawLine(`${origin}-${destination}`, 'dashed', {});
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },

    drawLines: async function () {
        lineManager.clearLines('route');
        const drawPromises = appState.routes.map((route, index) => {
            console.log('pathdrawing.drawLines - route:', route);
            const routeId = `${route.origin}-${route.destination}`;
            if (route.isDirect) {
                return this.drawLine(routeId, 'route', {
                    price: route.price,
                    group: index + 1, // Add group identifier here
                });
            } else {
                return this.drawDashedLine(route.origin, route.destination);
            }
        });
        await Promise.all(drawPromises);
        if (appState.selectedAirport) {
            pathDrawing.drawRoutePaths(appState.selectedAirport.iata_code, appState.directRoutes, appState.routeDirection);
        }
    },

    onClick(e, visibleLine, invisibleLine) {
        this.popupFromClick = true;
        if (visibleLine.routeData) {
            lineManager.showRoutePopup(e, visibleLine.routeData, visibleLine, invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    pathDrawing.drawLines();
});

export { pathDrawing, Line };