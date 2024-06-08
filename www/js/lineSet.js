class LineSet {
  constructor(geodesicLine, invisibleLine, decoratedLine) {
      this.geodesicLine = geodesicLine;
      this.invisibleLine = invisibleLine;
      this.decoratedLine = decoratedLine;
  }

  addToMap(map) {
      if (this.geodesicLine) map.addLayer(this.geodesicLine);
      if (this.invisibleLine) map.addLayer(this.invisibleLine);
      if (this.decoratedLine) map.addLayer(this.decoratedLine);
  }

  removeFromMap(map) {
      if (this.geodesicLine && map.hasLayer(this.geodesicLine)) map.removeLayer(this.geodesicLine);
      if (this.invisibleLine && map.hasLayer(this.invisibleLine)) map.removeLayer(this.invisibleLine);
      if (this.decoratedLine && map.hasLayer(this.decoratedLine)) map.removeLayer(this.decoratedLine);
  }
}

export default LineSet;
