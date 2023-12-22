<template>
    <div id="FlightMap" style="height: 500px;"></div>
</template>
  
<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  name: 'FlightMap',
  mounted() {
    const map = L.map('FlightMap').setView([51.505, -0.09], 13);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    }).addTo(map);
  }
};
</script>

<style>
#map {
  height: 100%;
}
</style>
