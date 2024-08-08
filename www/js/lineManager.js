import { map } from './map.js';
import { pathDrawing, Line } from './pathDrawing.js';

const lineManager = {
    routePopups: [],
    hoverPopups: [],
    hoveredLine: null,
    linesWithPopups: new Set(),

    clearPopups: (type) => {
        let popups;
        switch (type) {
            case 'route':
                popups = lineManager.routePopups;
                break;
            case 'hover':
                popups = lineManager.hoverPopups;
                break;
            case 'all':
                popups = [...lineManager.routePopups, ...lineManager.hoverPopups];
                break;
            default:
                popups = [];
        }
        popups.forEach(popup => map.closePopup(popup));
        if (type !== 'all') {
            lineManager[type + 'Popups'] = [];
        } else {
            lineManager.routePopups = [];
            lineManager.hoverPopups = [];
        }
    },

    clearLines: (type, specificLines) => {
        switch (type) {
            case 'all':
                Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line) {
                            line.remove();
                        }
                    });
                });
                Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line) {
                            line.remove();
                        }
                    });
                });
                pathDrawing.routePathCache = {};
                pathDrawing.dashedRoutePathCache = {};
                pathDrawing.hoverLines.forEach(line => {
                    if (line instanceof Line) {
                        line.remove();
                    }
                });
                pathDrawing.hoverLines = [];
                break;
            case 'hover':
                pathDrawing.hoverLines.forEach(line => {
                    if (line instanceof Line) {
                        line.remove();
                    }
                });
                pathDrawing.hoverLines = [];
                lineManager.hoveredLine = null;
                break;
            case 'route':
                Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line) {
                            line.remove();
                        }
                    });
                });
                pathDrawing.routePathCache = {};
                break;
            // Other cases...
        }
        map.closePopup();
    },         

    resetLines: (type, specificLines) => {
        switch (type) {
            case 'all':
                Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line) {
                            line.reset();
                        }
                    });
                });
                Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line) {
                            line.reset();
                        }
                    });
                });
                break;
            case 'hover':
                if (lineManager.hoveredLine) {
                    if (lineManager.hoveredLine instanceof Line) {
                        lineManager.hoveredLine.reset();
                    }
                    map.closePopup(lineManager.hoverPopup);
                    lineManager.hoveredLine = null;
                    lineManager.hoverPopup = null;
                }
                break;
            // Other cases...
        }
        map.closePopup();
    },
    

    showRoutePopup: (event, routeData, visibleLine, invisibleLine) => {
        const { originAirport, destinationAirport, price, date } = routeData;

        let content = `<div style="line-height: 1.5;">
            <strong>Route Information</strong><br>
            <strong>From:</strong> ${originAirport.name} (${originAirport.iata_code})<br>
            <strong>To:</strong> ${destinationAirport.name} (${destinationAirport.iata_code})<br>
            <strong>Price:</strong> $${price}<br>`;

        if (date) {
            let formattedDate = new Date(date).toLocaleDateString("en-US", {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            content += `<strong>Date:</strong> ${formattedDate}<br>`;
        }

        content += `</div>`;

        lineManager.clearPopups('route');

        const popup = L.popup({ autoClose: false, closeOnClick: false })
            .setLatLng(event.latlng)
            .setContent(content)
            .on('remove', function () {
                lineManager.linesWithPopups.delete(visibleLine);
                pathDrawing.popupFromClick = false;
                document.removeEventListener('click', lineManager.outsideClickListener);

                if (!visibleLine.options.isTableRoute) {
                    lineManager.clearLines('specific', [{ visibleLine, invisibleLine }]);
                } else {
                    const highlightedRouteSegments = pathDrawing.routePathCache[visibleLine.routeData.tableRouteId];
                    if (highlightedRouteSegments) {
                        highlightedRouteSegments.forEach(segment => {
                            if (segment instanceof Line) {
                                segment.visibleLine.setStyle({ color: segment.visibleLine.originalColor });
                            }
                        });
                    }
                }
            })
            .on('add', function () {
                if (visibleLine && !map.hasLayer(visibleLine)) {
                    visibleLine.addTo(map);
                }
                if (invisibleLine && !map.hasLayer(invisibleLine)) {
                    invisibleLine.addTo(map);
                }
                lineManager.linesWithPopups.add(visibleLine);
                pathDrawing.popupFromClick = true;
                document.addEventListener('click', lineManager.outsideClickListener);
            });

        setTimeout(() => {
            popup.openOn(map);
        }, 100);

        lineManager.routePopups.push(popup);
    },

    outsideClickListener: (event) => {
        if (!event.target.closest('.leaflet-popup')) {
            lineManager.clearPopups('route');
        }
    },

    onMouseOver: (e, visibleLine, map) => {
        if (pathDrawing.popupFromClick) return;

        if (lineManager.hoveredLine && lineManager.hoveredLine !== visibleLine) {
            if (lineManager.hoveredLine instanceof Line) {
                lineManager.hoveredLine.reset();
            }
            map.closePopup(lineManager.hoverPopup);
            lineManager.hoverPopups = lineManager.hoverPopups.filter(p => p !== lineManager.hoverPopup);
        }

        lineManager.hoveredLine = visibleLine;
        visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });

        const tableRouteId = visibleLine.routeData?.tableRouteId;
        if (tableRouteId) {
            const linesToHighlight = pathDrawing.routePathCache[tableRouteId];
            linesToHighlight?.forEach(line => {
                if (line instanceof Line) {
                    line.highlight();
                }
            });
        }

        const displayPrice = visibleLine.routeData?.price ? Math.round(visibleLine.routeData.price) : 'N/A';
        const city = visibleLine.routeData?.destinationAirport?.city || 'Unknown City';
        const dateContent = visibleLine.routeData?.date ? `<br><span style="line-height: 1; display: block; color: #666">on ${new Date(visibleLine.routeData.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>` : '';
        const content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>${dateContent}</div>`;

        lineManager.hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
            .setLatLng(e.latlng)
            .setContent(content)
            .openOn(map);

        lineManager.hoverPopups.push(lineManager.hoverPopup);
    },

    onMouseOut: (visibleLine, map) => {
        if (pathDrawing.popupFromClick || lineManager.linesWithPopups.has(visibleLine)) return;

        const tableRouteId = visibleLine.routeData?.tableRouteId;
        const linesToReset = tableRouteId
            ? pathDrawing.routePathCache[tableRouteId]
            : [{ visibleLine }];

        linesToReset?.forEach(line => {
            if (line && line.reset) {
                line.reset();
            }
        });

        map.closePopup(lineManager.hoverPopup);
        lineManager.hoverPopups = lineManager.hoverPopups.filter(p => p !== lineManager.hoverPopup);
        lineManager.hoveredLine = null;
        lineManager.hoverPopup = null;
    },

    onClickHandler: (e, visibleLine, invisibleLine, routeId) => {
        if (visibleLine.routeData) {
            lineManager.showRoutePopup(e, visibleLine.routeData, visibleLine, invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    },
};

export { lineManager };