import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Platform, Alert, Modal
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker'; 
import { api } from '../api/client';

export default function UserRoute() {
  const mapRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [routeData, setRouteData] = useState([]); 
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Sync States
  const [firstSync, setFirstSync] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [playbackIdx, setPlaybackIdx] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const [region, setRegion] = useState({
    latitude: 23.0225,
    longitude: 72.5714,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05
  });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (e) { 
      console.log("User fetch error:", e.message);
    }
  };

  const calculateDistance = (coords) => {
    if (coords.length < 2) return 0;
    let total = 0;
    const toRad = (v) => (v * Math.PI) / 180;
    for (let i = 0; i < coords.length - 1; i++) {
      const R = 6371;
      const dLat = toRad(coords[i+1].latitude - coords[i].latitude);
      const dLon = toRad(coords[i+1].longitude - coords[i].longitude);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(coords[i].latitude)) * Math.cos(toRad(coords[i+1].latitude)) * Math.sin(dLon/2)**2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return total.toFixed(2);
  };

  const getLocalDateString = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatPointTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleFetchRoute = async () => {
    if (!selectedUser) return Alert.alert("Required", "Select an officer.");
    setLoading(true);
    setHasFetched(true);
    setPlaybackIdx(null);
    try {
      const dateStr = getLocalDateString(date);
      const res = await api.get(`/admin/user-route?userId=${selectedUser}&date=${dateStr}`);
      
      if (res.data && res.data.coordinates?.length > 0) {
        const formatted = res.data.coordinates.map(p => ({
            latitude: parseFloat(p.latitude),
            longitude: parseFloat(p.longitude),
            time: p.time 
        }));
        
        setRouteData(formatted);
        setDistance(calculateDistance(formatted));
        setFirstSync(formatted[0].time);
        setLastSync(formatted[formatted.length - 1].time);

        setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude: formatted[0].latitude,
              longitude: formatted[0].longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02
            }, 1000);
        }, 500);
      } else {
        setRouteData([]);
        setFirstSync(null);
        setLastSync(null);
        Alert.alert("No Data", "No journey recorded for this date.");
      }
    } catch (e) {
      if (e.response?.status === 401) Alert.alert("Session Expired", "Please login again.");
      setRouteData([]);
    } finally {
      setLoading(false);
    }
  };

  const startPlayback = () => {
    if (routeData.length === 0) return;
    setIsAnimating(true);
    let idx = 0;
    const interval = setInterval(() => {
      setPlaybackIdx(idx);
      mapRef.current?.animateCamera({ center: routeData[idx] }, { duration: 200 });
      idx++;
      if (idx >= routeData.length) {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 400);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (event.type === "set" && selectedDate) setDate(selectedDate);
  };

  return (
    <View style={styles.container}>
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" visible={showDatePicker}>
            <View style={styles.iosPickerOverlay}>
              <View style={styles.iosPickerContainer}>
                <TouchableOpacity style={styles.iosDoneBtn} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.iosDoneText}>Done</Text>
                </TouchableOpacity>
                <DateTimePicker value={date} mode="date" display="inline" onChange={onDateChange} maximumDate={new Date()} themeVariant="dark" />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={date} mode="date" display="calendar" onChange={onDateChange} maximumDate={new Date()} />
        )
      )}

      <View style={styles.filterCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>OFFICER NAME</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedUser} onValueChange={(val) => setSelectedUser(val)} style={styles.picker} dropdownIconColor="#00E676" mode="dropdown">
              <Picker.Item label="Select Officer" value="" color="#888" />
              {users.map(u => <Picker.Item key={u._id} label={u.name} value={u._id} color={Platform.OS === 'ios' ? "#fff" : "#000"} />)}
            </Picker>
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1.2, marginRight: 10 }}>
            <Text style={styles.label}>DATE</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Text style={styles.dateBtnText}>📅 {getLocalDateString(date)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ACTION</Text>
            <TouchableOpacity style={[styles.fetchBtn, loading && { opacity: 0.7 }]} onPress={handleFetchRoute} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.fetchText}>FETCH</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.contentArea}>
        {routeData.length > 0 ? (
          <>
            <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFillObject} initialRegion={region} key={routeData.length}>
              <Polyline coordinates={routeData} strokeColor="#00E676" strokeWidth={5} lineJoin="round" />
              <Marker coordinate={routeData[0]} title="START" pinColor="blue" description={`First sync: ${formatPointTime(firstSync)}`} />
              <Marker coordinate={routeData[routeData.length - 1]} title="END" pinColor="red" description={`Last sync: ${formatPointTime(lastSync)}`} />
              {playbackIdx !== null && (
                <Marker coordinate={routeData[playbackIdx]}>
                  <View style={styles.movingMarker}><Text style={{fontSize: 10}}>🚶</Text></View>
                </Marker>
              )}
            </MapView>

            <TouchableOpacity style={[styles.playBtn, isAnimating && {backgroundColor: '#444'}]} onPress={startPlayback} disabled={isAnimating}>
              <Text style={styles.playText}>{isAnimating ? "ANIMATING..." : "▶ PLAY ROUTE"}</Text>
            </TouchableOpacity>

            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>DISTANCE</Text>
                <Text style={styles.summaryVal}>{distance} KM</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>FIRST SYNC</Text>
                <Text style={styles.summaryVal}>{formatPointTime(firstSync)}</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>LAST SYNC</Text>
                <Text style={styles.summaryVal}>{formatPointTime(lastSync)}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.centerBox}>
            {loading ? <ActivityIndicator size="large" color="#00E676" /> : 
              <Text style={styles.initialText}>{hasFetched ? "No journey found." : "Choose filters and click Fetch."}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  filterCard: { paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingBottom: 20, backgroundColor: '#1A1A1A', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#333', zIndex: 100, elevation: 5 },
  inputGroup: { marginBottom: 15 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  pickerWrapper: { backgroundColor: '#252525', borderRadius: 12, borderWidth: 1, borderColor: '#333', height: 52, justifyContent: 'center', overflow: 'hidden' },
  picker: { color: '#fff', width: '100%' },
  dateBtn: { backgroundColor: '#252525', height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  dateBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  fetchBtn: { backgroundColor: '#00E676', height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fetchText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  contentArea: { flex: 1 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  initialText: { color: '#555', textAlign: 'center', fontSize: 14 },
  movingMarker: { backgroundColor: '#fff', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#00E676' },
  playBtn: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: '#00E676', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, elevation: 10, zIndex: 1000 },
  playText: { color: '#000', fontWeight: 'bold', fontSize: 11 },
  summaryBar: { position: 'absolute', bottom: 30, left: 15, right: 15, backgroundColor: '#1E1E1E', flexDirection: 'row', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#333', elevation: 10 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: '#666', fontSize: 7, fontWeight: 'bold' },
  summaryVal: { color: '#00E676', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  vDivider: { width: 1, height: 20, backgroundColor: '#333' },
  iosPickerOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  iosPickerContainer: { backgroundColor: '#1A1A1A', marginHorizontal: 20, padding: 15, borderRadius: 20 },
  iosDoneBtn: { alignSelf: 'flex-end', padding: 10 },
  iosDoneText: { color: '#00E676', fontWeight: 'bold', fontSize: 16 }
});