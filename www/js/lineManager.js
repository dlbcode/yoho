import { map } from './map.js';
import { pathDrawing, Line } from './pathDrawing.js';
import { flightMap } from './flightMap.js';

const lineManager = {
    popups: {
        route: new Set(),
        hover: new Set()
    },
    hoveredLine: null,
    linesWithPopups: new Set(),
    
    outsideClickListener: function(e) {
        // Improved detection for clicks outside popup
        const target = e.target || e.srcElement;
        
        // Check if click is on a popup or a marker
        const isOnPopup = target.closest('.leaflet-popup') || 
                          target.closest('.leaflet-popup-pane');
        const isOnMarker = target.closest('.leaflet-marker-icon') ||
                          target.closest('.leaflet-marker-pane');
                          
        // Consider it an outside click if not on popup and not on marker
        if (!isOnPopup && !isOnMarker) {
            // First close any popups
            map.closePopup();
            
            // Clear state
            pathDrawing.popupFromClick = false;
            
            // Clear any preserved marker state
            if (flightMap.preservedMarker) {
                flightMap.preservedMarker = null;
                flightMap.hoverDisabled = false;
            }
            
            // Clear route lines
            lineManager.clearLinesByTags(['type:route']);
            
            // Remove this listener to avoid memory leaks
            document.removeEventListener('click', lineManager.outsideClickListener);
            
            // Also remove map click listeners that might interfere
            map.off('click', this.mapClickHandler);
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
        return L.popup({
            autoClose: false,
            closeOnClick: false,
            ...options
        })
        .setLatLng(latlng)
        .setContent(content);
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
            this.hoveredLine instanceof Line && this.hoveredLine.reset();
            this.clearPopups('hover');
        }

        this.hoveredLine = line;

        if (line.routeData?.cardId) {
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
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
        if (pathDrawing.popupFromClick || this.linesWithPopups.has(line.visibleLine)) return;
        
        if (line.routeData?.cardId) {
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                routeLine instanceof Line && routeLine.reset();
            });
        } else {
            line instanceof Line && line.reset();
        }
        
        this.clearPopups('hover');
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