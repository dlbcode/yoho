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
  onMouseOver: throttle((e, visibleLine, map, hoveredLine, currentPopup, routeData, pathDrawing) => {
      if (!pathDrawing.popupFromClick) {
          if (hoveredLine && hoveredLine !== visibleLine) {
              hoveredLine.setStyle({ color: hoveredLine.originalColor });
              map.closePopup(currentPopup);
          }

          hoveredLine = visibleLine;
          visibleLine.setStyle({ color: 'white' });

          let displayPrice = Math.round(routeData.price);
          let content = `<div style="line-height: 1.2; margin: 0;">${routeData.destination.city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>`;
          if (routeData.date) {
              let lowestDate = new Date(routeData.date).toLocaleDateString("en-US", {
                  year: 'numeric', month: 'long', day: 'numeric'
              });
              content += `<br><span style="line-height: 1; display: block; color: #666">on ${lowestDate}</span>`;
          }
          content += `</div>`;

          currentPopup = L.popup({ autoClose: false, closeOnClick: true })
              .setLatLng(e.latlng)
              .setContent(content)
              .openOn(map);
      }
  }, 100),

  onMouseOut: throttle((visibleLine, map, hoveredLine, currentPopup, pathDrawing) => {
      if (!pathDrawing.popupFromClick && hoveredLine === visibleLine) {
          visibleLine.setStyle({ color: visibleLine.originalColor });
          map.closePopup(currentPopup);
          hoveredLine = null;
          currentPopup = null;
      }
  }, 100),

  onClickHandler: (e, line, onClick) => {
      onClick(e, line);
  }
};

export { lineEvents };
