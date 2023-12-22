<template>
    <div id="map" style="height: 500px;"></div>
  </template>
  
  <script>
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  
  export default {
    name: 'FlightMap',
    mounted() {
      const map = L.map('map').setView([51.505, -0.09], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
      }).addTo(map);
    }
  };
  </script>
  
  <style>
  /* Make sure the map height is set */
  #map {
    height: 100%;
  }
  </style>
  