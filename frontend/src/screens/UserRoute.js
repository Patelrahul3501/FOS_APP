import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

export default function UserRoute({ onBack }) {
  const [routeCoords, setRouteCoords] = useState([
    { latitude: 23.0225, longitude: 72.5714 },
    { latitude: 23.0300, longitude: 72.5800 },
  ]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <MapView 
        provider={PROVIDER_GOOGLE}
        style={styles.map} 
        initialRegion={{ latitude: 23.0225, longitude: 72.5714, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Polyline coordinates={routeCoords} strokeColor="#00E676" strokeWidth={4} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: '#121212', padding: 10, borderRadius: 8 },
  backText: { color: '#00E676' }
});