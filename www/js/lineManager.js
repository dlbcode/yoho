import { map } from './map.js';
import { pathDrawing, Line } from './pathDrawing.js';
import { flightMap } from './flightMap.js';
import { appState, updateState } from './stateManager.js';  // Add this import

const lineManager = {
    popups: {
        route: new Set(),
        hover: new Set()
    },
    hoveredLine: null,
    linesWithPopups: new Set(),
    allPopups: new Set(), // Add a Set to track all popups
    
    outsideClickListener: function(e) {
        const target = e.target || e.srcElement;
        
        const isOnPopup = target.closest('.leaflet-popup') || 
                          target.closest('.leaflet-popup-pane');
        const isOnMarker = target.closest('.leaflet-marker-icon') ||
                          target.closest('.leaflet-marker-pane');
                          
        if (!isOnPopup && !isOnMarker) {
            map.closePopup();
            pathDrawing.popupFromClick = false;
            
            if (flightMap.preservedMarker) {
                flightMap.preservedMarker.closePopup();
                flightMap.preservedMarker = null;
                flightMap.hoverDisabled = false;
            }
            
            // Only clear selectedAirport state if not in a selected route view
            if (!['selectedRoute', 'fullJourney'].includes(appState.currentView)) {
                updateState('selectedAirport', null, 'lineManager.outsideClickListener');
            }
            
            Object.values(flightMap.markers || {}).forEach(marker => {
                if (marker && marker._popup && marker._popup.isOpen()) {
                    marker.closePopup();
                }
            });

            const linesToClear = lineManager.getLinesByTags(['type:route']).filter(line => {
                return !appState.routeData.some(route => {
                    if (!route || route.isEmpty) return false;
                    const routeId = `${route.origin?.iata_code}-${route.destination?.iata_code}`;
                    return line.routeId === routeId;
                });
            });

            linesToClear.forEach(line => {
                if (!lineManager.linesWithPopups.has(line)) {
                    if (line instanceof Line) {
                        line.remove();
                    } else if (line.visibleLine) {
                        map.removeLayer(line.visibleLine);
                        if (line.invisibleLine) map.removeLayer(line.invisibleLine);
                        if (line.decoratedLine) map.removeLayer(line.decoratedLine);
                    }
                }
            });
            
            document.removeEventListener('click', lineManager.outsideClickListener);
            
            if (map._events && map._events.click) {
                map._events.click = map._events.click.filter(handler => 
                    handler.fn !== self.mapClickHandler
                );
            }
        }
    },

    getLinesByTags(tags, cache = 'all') {
        const cacheMap = {
            route: [pathDrawing.routePathCache],
            dashed: [pathDrawing.dashedRoutePathCache],
            hover: [{ hover: pathDrawing.hoverLines }],
            all: [pathDrawing.routePathCache, pathDrawing.dashedRoutePathCache, 
                  { hover: pathDrawing.hoverLines }]
        };

        const lines = [];
        (cacheMap[cache] || cacheMap.all).forEach(cacheObj => {
            Object.values(cacheObj).forEach(lineSet => 
                lines.push(...(Array.isArray(lineSet) ? lineSet : [lineSet])));
        });

        return lines.filter(line => tags.every(tag => line.tags.has(tag)));
    },

    clearPopups(type = 'all') {
        const popupTypes = type === 'all' ? ['route', 'hover'] : [type];
        popupTypes.forEach(t => {
            this.popups[t].forEach(popup => map.closePopup(popup));
            this.popups[t].clear();
        });
    },

    clearLinesByTags(tags, options = {}) {
        if (tags.includes('type:deck') && window.preserveAnyDestination) {
            return;
        }
        
        if (pathDrawing.popupFromClick && !tags.includes('type:hover')) {
            return;
        }
        
        const linesToRemove = this.getLinesByTags(tags);
        linesToRemove.forEach(line => {
            if (!this.linesWithPopups.has(line)) {
                if (line instanceof Line) {
                    line.remove();
                } else if (line.visibleLine) {
                    map.removeLayer(line.visibleLine);
                    if (line.invisibleLine) map.removeLayer(line.invisibleLine);
                    if (line.decoratedLine) map.removeLayer(line.decoratedLine);
                }
            }
        });
    },

    clearLines(type) {
        const clearTypes = {
            all: () => this.clearLinesByTags(['type:route', 'type:hover'], 
                        { excludeTags: ['type:deck', 'status:selected', 'status:clicked'] }),
            hover: () => this.clearLinesByTags(['type:hover']),
            route: () => this.clearLinesByTags(['type:route'], 
                        { excludeTags: ['type:deck', 'status:selected', 'status:clicked'] })
        };

        (clearTypes[type] || clearTypes.all)();
    },

    clearLinesByRouteNumber(routeNumber) {
        const tags = [`group:${routeNumber}`];
        return this.clearLinesByTags(tags);
    },

    createPopup(latlng, content, options = {}) {
        const popup = L.popup({
            autoClose: false,
            closeOnClick: false,
            ...options
        })
        .setLatLng(latlng)
        .setContent(content);
        
        // Add to tracking Set
        this.allPopups.add(popup);
        
        // Add remove handler to clean up tracking
        popup.on('remove', () => {
            this.allPopups.delete(popup);
        });
        
        return popup;
    },

    closeAllPopups() {
        this.allPopups.forEach(popup => {
            if (popup && map.hasLayer(popup)) {
                map.closePopup(popup);
            }
        });
        this.allPopups.clear();
    },

    showRoutePopup(event, routeData, visibleLine, invisibleLine) {
        const { originAirport, destinationAirport, price, date, fullRoute } = routeData.routeInfo;
        
        const formattedDate = date ? new Date(date).toLocaleDateString("en-US", {
            year: 'numeric', month: 'long', day: 'numeric'
        }) : '';

        const layovers = fullRoute.length > 1 
            ? fullRoute.slice(1, -1).map(segment => 
                `<br><strong>Layover:</strong> ${segment.cityFrom} (${segment.flyFrom})`)
            : '';

        const content = `
            <div style="line-height: 1.5;">
                <strong>Route Information</strong><br>
                <strong>From:</strong> ${originAirport.cityFrom} (${originAirport.flyFrom})<br>
                <strong>To:</strong> ${destinationAirport.cityTo} (${destinationAirport.flyTo})
                ${layovers}
                <br><strong>Price:</strong> $${price}<br>
                ${formattedDate ? `<strong>Date:</strong> ${formattedDate}<br>` : ''}
            </div>`;

        this.clearPopups('route');
        const popup = this.createPopup(event.latlng, content)
            .on('remove', () => {
                this.linesWithPopups.delete(visibleLine);
                pathDrawing.popupFromClick = false;
                document.removeEventListener('click', this.outsideClickListener);
                
                if (routeData?.cardId) {
                    const routeLines = Object.values(pathDrawing.routePathCache)
                        .flat()
                        .filter(l => l.routeData?.cardId === routeData.cardId);
                        
                    routeLines.forEach(routeLine => {
                        routeLine instanceof Line && routeLine.reset();
                    });
                }
            })
            .on('add', () => {
                [visibleLine, invisibleLine].forEach(line => 
                    line && !map.hasLayer(line) && line.addTo(map));
                this.linesWithPopups.add(visibleLine);
                pathDrawing.popupFromClick = true;
                
                // Make sure we use timeout to add click listener after current click event completes
                setTimeout(() => {
                    document.addEventListener('click', this.outsideClickListener);
                }, 10);
            });

        setTimeout(() => popup.openOn(map), 100);
        this.popups.route.add(popup);
    },

    onMouseOver(e, line) {
        if (this.hoveredLine && this.hoveredLine !== line) {
            // Don't reset previous line if we're in a touch interaction
            if (!e.touches) {
                this.hoveredLine instanceof Line && this.hoveredLine.reset();
                this.clearPopups('hover');
            }
        }

        this.hoveredLine = line;

        if (line.routeData?.cardId) {
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                if (routeLine instanceof Line) {
                    routeLine.highlight();
                } else if (routeLine.visibleLine) {
                    routeLine.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
                    routeLine.visibleLine.setZIndexOffset(1000);
                    routeLine.visibleLine.bringToFront();
                }
            });
        } else {
            if (line instanceof Line) {
                line.highlight();
            } else if (line.visibleLine) {
                line.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
                line.visibleLine.setZIndexOffset(1000);
                line.visibleLine.bringToFront();
            }
        }

        const priceTag = Array.from(line.tags).find(tag => tag.startsWith('price:'));
        const price = priceTag ? priceTag.split(':')[1] : 'N/A';

        const content = `
            <div style="line-height: 1.2; margin: 0;">
                ${line.destination?.city || 'Unknown City'}<br>
                <span><strong><span style="color: #ccc; font-size: 14px;">
                    $${price}
                </span></strong></span>
            </div>`;

        const popup = this.createPopup(e.latlng, content, { closeOnClick: true });
        popup.openOn(map);
        this.popups.hover.add(popup);
    },

    onMouseOut(line) {
        // Don't clear hover states during touch interactions
        if (window.event && window.event.touches) return;

        // Clear hover popups
        this.clearPopups('hover');
        
        if (line.routeData?.cardId) {
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                // Don't reset highlighted state when in selected views
                if (routeLine instanceof Line && !routeLine.tags.has('status:highlighted') && 
                    !['selectedRoute', 'fullJourney'].includes(appState.currentView)) {
                    routeLine.reset({ preventMapMovement: true });
                } else if (routeLine.visibleLine && !this.linesWithPopups.has(routeLine.visibleLine)) {
                    routeLine.visibleLine.setStyle({
                        color: routeLine.color || 'blue',
                        weight: routeLine.weight || 1,
                        opacity: 1
                    });
                }
            });
        } else {
            // Don't reset highlighted state when in selected views
            if (line instanceof Line && !line.tags.has('status:highlighted') && 
                !['selectedRoute', 'fullJourney'].includes(appState.currentView)) {
                line.reset({ preventMapMovement: true });
            } else if (line.visibleLine && !this.linesWithPopups.has(line.visibleLine)) {
                line.visibleLine.setStyle({
                    color: line.color || 'blue',
                    weight: line.weight || 1,
                    opacity: 1
                });
            }
        }
        
        this.hoveredLine = null;
    },

    onClickHandler(e, line) {
        this.clearPopups('hover');
        pathDrawing.popupFromClick = true;

        const allDeckLines = Object.values(pathDrawing.routePathCache)
            .flat()
            .filter(l => l instanceof Line && l.tags.has('status:highlighted'));
        
        allDeckLines.forEach(previousLine => {
            previousLine.tags.delete('status:highlighted');
            previousLine.reset();
        });

        if (line.routeData?.cardId) {
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                routeLine.addTag('status:highlighted');
                routeLine.highlight();
            });
        }

        if (line.routeData?.cardId) {
            const card = document.querySelector(`div.route-card[data-card-id="${line.routeData.cardId}"]`);
            if (card) {
                card.click();
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        if (line.routeData) {
            this.showRoutePopup(e, line.routeData, line.visibleLine, line.invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

export { lineManager };