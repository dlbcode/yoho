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
        this.highlight = options.highlight || false;
        this.showPlane = options.showPlane || false;
        this.visibleLine = this.createVisibleLine();
        this.invisibleLine = this.createInvisibleLine();
        this.decoratedLine = this.showPlane ? this.createDecoratedLine() : null;
        this.bindEvents();
        console.log(`Line created with routeId: ${this.routeId}`);
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
        // Bind click events to the individual polylines
        this.visibleLine.on('click', (e) => lineManager.onClickHandler(e, this.visibleLine, this.invisibleLine, this.routeId));
        this.invisibleLine.on('click', (e) => lineManager.onClickHandler(e, this.visibleLine, this.invisibleLine, this.routeId));
    
        // Pass the Line instance to the hover events
        this.invisibleLine.on('mouseover', (e) => lineManager.onMouseOver(e, this, this.map)); // Pass the Line instance
        this.invisibleLine.on('mouseout', () => lineManager.onMouseOut(this)); // Pass the Line instance
    
        if (this.decoratedLine) {
            this.decoratedLine.on('click', (e) => this.invisibleLine.fire('click', e));
            this.decoratedLine.on('mouseover', (e) => lineManager.onMouseOver(e, this, this.map)); // Pass the Line instance
            this.decoratedLine.on('mouseout', () => lineManager.onMouseOut(this)); // Pass the Line instance
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

    drawLine: function(routeId, type, options) {
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

    drawLines: async function() {
        lineManager.clearLines('route');
        const drawPromises = appState.routes.map(route => {
            console.log('pathdrawing.drawLines - route:', route);
            const routeId = `${route.origin}-${route.destination}`;
            if (route.isDirect) {
                return pathDrawing.drawLine(routeId, 'route', { price: route.price });
            } else {
                return pathDrawing.drawDashedLine(route.origin, route.destination);
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