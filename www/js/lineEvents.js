import { map } from './map.js';
import { pathDrawing, Line } from './pathDrawing.js'; // Correct import

const lineEvents = {
    routePopups: [],
    hoverPopups: [],
    linesWithPopups: new Set(),

    clearPopups: (type) => {
        let popups;
        switch (type) {
            case 'route':
                popups = lineEvents.routePopups;
                break;
            case 'hover':
                popups = lineEvents.hoverPopups;
                break;
            case 'all':
                popups = [...lineEvents.routePopups, ...lineEvents.hoverPopups];
                break;
            default:
                popups = [];
        }
        popups.forEach(popup => map.closePopup(popup));
        if (type !== 'all') {
            lineEvents[type + 'Popups'] = [];
        } else {
            lineEvents.routePopups = [];
            lineEvents.hoverPopups = [];
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
                break;
            case 'dashed':
                Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line) {
                            line.remove();
                        }
                    });
                });
                pathDrawing.dashedRoutePathCache = {};
                break;
            case 'route':
                Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line && !line.isTableRoute) {
                            line.remove();
                        }
                    });
                });
                break;
            case 'hover':
                if (lineEvents.hoveredLine) {
                    if (lineEvents.hoveredLine instanceof Line) {
                        lineEvents.hoveredLine.reset();
                    }
                    map.closePopup(lineEvents.hoverPopup);
                    lineEvents.hoveredLine = null;
                    lineEvents.hoverPopup = null;
                }
                break;
            case 'specific':
                if (specificLines) {
                    specificLines.forEach(line => {
                        if (line instanceof Line) {
                            line.remove();
                        }
                    });
                }
                break;
            case 'tableLines':
                Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                    lineSetArray.forEach(line => {
                        if (line instanceof Line && line.isTableRoute) {
                            line.remove();
                        }
                    });
                });
                break;
            default:
                console.warn(`Unknown line type: ${type}`);
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

        lineEvents.clearPopups('route');

        const popup = L.popup({ autoClose: false, closeOnClick: false })
            .setLatLng(event.latlng)
            .setContent(content)
            .on('remove', function () {
                lineEvents.linesWithPopups.delete(visibleLine);
                pathDrawing.popupFromClick = false;
                document.removeEventListener('click', lineEvents.outsideClickListener);

                if (!visibleLine.options.isTableRoute) {
                    lineEvents.clearLines('specific', [{ visibleLine, invisibleLine }]);
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
                lineEvents.linesWithPopups.add(visibleLine);
                pathDrawing.popupFromClick = true;
                document.addEventListener('click', lineEvents.outsideClickListener);
            });

        setTimeout(() => {
            popup.openOn(map);
        }, 100);

        lineEvents.routePopups.push(popup);
    },

    outsideClickListener: (event) => {
        if (!event.target.closest('.leaflet-popup')) {
            lineEvents.clearPopups('route');
        }
    },

    onMouseOver: (e, visibleLine, map) => {
        if (pathDrawing.popupFromClick) return;

        if (lineEvents.hoveredLine && lineEvents.hoveredLine !== visibleLine) {
            if (lineEvents.hoveredLine instanceof Line) {
                lineEvents.hoveredLine.reset();
            }
            map.closePopup(lineEvents.hoverPopup);
            lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== lineEvents.hoverPopup);
        }

        lineEvents.hoveredLine = visibleLine;
        visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });

        const tableRouteId = visibleLine.routeData.tableRouteId;
        const linesToHighlight = pathDrawing.routePathCache[tableRouteId];

        linesToHighlight?.forEach(line => {
            if (line instanceof Line) {
                line.highlight();
            }
        });

        const displayPrice = Math.round(visibleLine.routeData.price || 0);
        const city = visibleLine.routeData.destinationAirport?.city || 'Unknown City';
        const dateContent = visibleLine.routeData.date ? `<br><span style="line-height: 1; display: block; color: #666">on ${new Date(visibleLine.routeData.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>` : '';
        const content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>${dateContent}</div>`;

        lineEvents.hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
            .setLatLng(e.latlng)
            .setContent(content)
            .openOn(map);

        lineEvents.hoverPopups.push(lineEvents.hoverPopup);
    },

    onMouseOut: (visibleLine, map) => {
        if (pathDrawing.popupFromClick || lineEvents.linesWithPopups.has(visibleLine)) return;

        const linesToReset = visibleLine.routeData.tableRouteId
            ? pathDrawing.routePathCache[visibleLine.routeData.tableRouteId]
            : [{ visibleLine }];

        linesToReset?.forEach(line => {
            if (line && line.reset) {
                line.reset();
            }
        });

        map.closePopup(lineEvents.hoverPopup);
        lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== lineEvents.hoverPopup);
        lineEvents.hoveredLine = null;
        lineEvents.hoverPopup = null;
    },

    onClickHandler: (e, visibleLine, invisibleLine, routeId) => {
        if (visibleLine.routeData) {
            lineEvents.showRoutePopup(e, visibleLine.routeData, visibleLine, invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    },
};

export { lineEvents };
