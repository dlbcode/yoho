import { map } from './map.js';
import { pathDrawing } from './pathDrawing.js';

const lineEvents = {
    // Keep track of different types of popups
    routePopups: [],
    hoverPopups: [],
    linesWithPopups: new Set(), // Track lines with open popups

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
                  lineSetArray.forEach(lineSet => {
                      lineSet.removeAllLines();
                  });
              });
              Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                  lineSetArray.forEach(lineSet => {
                      lineSet.removeAllLines();
                  });
              });
              pathDrawing.routePathCache = {};
              pathDrawing.dashedRoutePathCache = {};
              break;
          case 'dashed':
              Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                  lineSetArray.forEach(lineSet => {
                      lineSet.removeAllLines();
                  });
              });
              pathDrawing.dashedRoutePathCache = {};
              break;
          case 'route':
              Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                  lineSetArray.forEach(lineSet => {
                      if (!lineSet.isTableRoute) { // Ensure table routes are not cleared
                          lineSet.removeAllLines();
                      }
                  });
              });
              break;
          case 'hover':
              if (lineEvents.hoveredLine) {
                  lineEvents.hoveredLine.setStyle({ color: lineEvents.hoveredLine.originalColor });
                  map.closePopup(lineEvents.hoverPopup);
                  lineEvents.hoveredLine = null;
                  lineEvents.hoverPopup = null;
              }
              break;
          case 'specific':
              if (specificLines) {
                  specificLines.forEach(linePair => {
                      if (map.hasLayer(linePair.visibleLine)) {
                          map.removeLayer(linePair.visibleLine);
                      }
                      if (map.hasLayer(linePair.invisibleLine)) {
                          map.removeLayer(linePair.invisibleLine);
                      }
                      if (linePair.decoratedLine && map.hasLayer(linePair.decoratedLine)) {
                          map.removeLayer(linePair.decoratedLine);
                      }
                  });
              }
              break;
          case 'tableLines':
              Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                  lineSetArray.forEach(lineSet => {
                      if (lineSet.isTableRoute) {
                          lineSet.removeAllLines();
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

    let content = `<div style=\"line-height: 1.5;\">
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

    // Ensure no other route popups are open before creating a new one
    lineEvents.clearPopups('route');

    // Create the popup and add event listeners after initialization
    const popup = L.popup({ autoClose: false, closeOnClick: false })
        .setLatLng(event.latlng)
        .setContent(content)
        .on('remove', function () {
            lineEvents.linesWithPopups.delete(visibleLine); // Remove line from set when popup is closed
            pathDrawing.popupFromClick = false; // Reset flag on popup removal
            document.removeEventListener('click', lineEvents.outsideClickListener);

            // Use clearLines to remove the specific lines when the popup is removed, only if it is not for a route table row
            if (!visibleLine.options.isTableRoute) {
                lineEvents.clearLines('specific', [{ visibleLine, invisibleLine }]);
            }
        })
        .on('add', function () {
            // Ensure the lines remain visible when the popup is added
            if (visibleLine && !map.hasLayer(visibleLine)) {
                visibleLine.addTo(map);
            }
            if (invisibleLine && !map.hasLayer(invisibleLine)) {
                invisibleLine.addTo(map);
            }
            lineEvents.linesWithPopups.add(visibleLine); // Add line to set when popup is open
            pathDrawing.popupFromClick = true; // Set flag on popup addition
            document.addEventListener('click', lineEvents.outsideClickListener);
        });

    // Open the popup on the map
    setTimeout(() => {
        popup.openOn(map);
    }, 100); // Delay to avoid immediate closure by other events

    // Track this popup
    lineEvents.routePopups.push(popup);
  },

    outsideClickListener: (event) => {
        if (!event.target.closest('.leaflet-popup')) {
            lineEvents.clearPopups('route');
        }
    },

    onMouseOver: (e, visibleLine, map, hoveredLine, hoverPopup, routeData, pathDrawing) => {
      if (pathDrawing.popupFromClick) return;
  
      if (hoveredLine && hoveredLine !== visibleLine) {
          hoveredLine.setStyle({ color: hoveredLine.originalColor });
          map.closePopup(hoverPopup);
          lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== hoverPopup);
      }
  
      hoveredLine = visibleLine;
      visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
  
      const tableRouteId = visibleLine.routeData.tableRouteId;
      const linesToHighlight = pathDrawing.routePathCache[tableRouteId];
  
      linesToHighlight?.forEach(lineSet => {
          lineSet.lines.forEach(linePair => lineSet.highlightLine(linePair.visibleLine));
      });
  
      const displayPrice = Math.round(routeData.price || 0);
      const city = routeData.destinationAirport?.city || 'Unknown City';
      const dateContent = routeData.date ? `<br><span style="line-height: 1; display: block; color: #666">on ${new Date(routeData.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>` : '';
      const content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>${dateContent}</div>`;
  
      hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
          .setLatLng(e.latlng)
          .setContent(content)
          .openOn(map);
  
      lineEvents.hoverPopups.push(hoverPopup);
  },  

    onMouseOut: (visibleLine, map, hoveredLine, hoverPopup, pathDrawing) => {
      if (pathDrawing.popupFromClick || lineEvents.linesWithPopups.has(visibleLine)) return;
  
      const linesToReset = visibleLine.routeData.tableRouteId
          ? pathDrawing.routePathCache[visibleLine.routeData.tableRouteId]
          : [{ lines: [{ visibleLine }], resetLine: line => line.setStyle({ color: line.originalColor }) }];
  
      linesToReset.forEach(lineSet => {
          lineSet.lines.forEach(linePair => {
              lineSet.resetLine(linePair.visibleLine);
          });
      });
  
      map.closePopup(hoverPopup);
      lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== hoverPopup);
      hoveredLine = null;
      hoverPopup = null;
  },   

  onClickHandler: (e, visibleLine, invisibleLine, onClick) => {
    if (typeof onClick === 'function') {
        onClick(e, visibleLine, invisibleLine);
    }
    if (visibleLine && invisibleLine) {
        // Reset any previously highlighted lines
        if (pathDrawing.currentHighlightedLine) {
            const highlightedRouteSegments = pathDrawing.routePathCache[pathDrawing.currentHighlightedLine.routeData.tableRouteId];
            if (highlightedRouteSegments) {
                highlightedRouteSegments.forEach(segment => {
                    segment.lines.forEach(line => line.visibleLine.setStyle({ color: line.visibleLine.originalColor }));
                });
            }
        }

        // Ensure the visible and invisible lines are displayed
        if (!map.hasLayer(visibleLine)) {
            visibleLine.addTo(map);
        }
        if (!map.hasLayer(invisibleLine)) {
            invisibleLine.addTo(map);
        }

        // Highlight the visible line
        visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });

        // Update the current highlighted line
        pathDrawing.currentHighlightedLine = visibleLine;
    }
  },
};

export { lineEvents };
