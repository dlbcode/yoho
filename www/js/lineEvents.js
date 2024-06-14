function throttle(fn, wait) {
  let time = Date.now();
  return function (...args) {
      if ((time + wait - Date.now()) < 0) {
          fn(...args);
          time = Date.now();
      }
  };
}

const lineEvents = {
  onMouseOver: (e, visibleLine, map, hoveredLine, hoverPopup, routeData, pathDrawing) => {
      if (!pathDrawing.popupFromClick) {
          if (hoveredLine && hoveredLine !== visibleLine) {
              hoveredLine.setStyle({ color: hoveredLine.originalColor });
              map.closePopup(hoverPopup);
          }

          hoveredLine = visibleLine;
          visibleLine.setStyle({ color: 'white' });

          let displayPrice = Math.round(routeData.price || 0); // Ensure price is valid
          let city = routeData.destinationAirport && routeData.destinationAirport.city ? routeData.destinationAirport.city : 'Unknown City'; // Ensure city is valid
          let content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>`;
          if (routeData.date) {
              let lowestDate = new Date(routeData.date).toLocaleDateString("en-US", {
                  year: 'numeric', month: 'long', day: 'numeric'
              });
              content += `<br><span style="line-height: 1; display: block; color: #666">on ${lowestDate}</span>`;
          }
          content += `</div>`;

          hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
              .setLatLng(e.latlng)
              .setContent(content)
              .openOn(map);
      }
  },

  onMouseOut: (visibleLine, map, hoveredLine, hoverPopup, pathDrawing) => {
    console.log('onMouseOut');
          visibleLine.setStyle({ color: visibleLine.originalColor });
          map.closePopup(hoverPopup);
          hoveredLine = null;
          hoverPopup = null;
  },

  onClickHandler: (e, line, onClick) => {
      onClick(e, line);
  }
};

export { lineEvents };