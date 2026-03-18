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
                  <Text style={styles.iosDoneText}>DONE</Text>
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
        <Text style={styles.headerTitle}>Route Tracking</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>OFFICER NAME</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedUser} onValueChange={(val) => setSelectedUser(val)} style={styles.picker} dropdownIconColor="#10B981" mode="dropdown">
              <Picker.Item label="Select Officer" value="" color="#888" />
              {users.map(u => <Picker.Item key={u._id} label={u.name} value={u._id} color={Platform.OS === 'ios' ? "#fff" : "#000"} />)}
            </Picker>
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1.2, marginRight: 15 }}>
            <Text style={styles.label}>TRACKING DATE</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <Text style={styles.dateBtnText}>📅 {getLocalDateString(date)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ACTION</Text>
            <TouchableOpacity style={[styles.fetchBtn, loading && { opacity: 0.7 }]} onPress={handleFetchRoute} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#064E3B" size="small" /> : <Text style={styles.fetchText}>FETCH MAP</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.contentArea}>
        {routeData.length > 0 ? (
          <>
            <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFillObject} initialRegion={region} key={routeData.length}>
              <Polyline coordinates={routeData} strokeColor="#10B981" strokeWidth={6} lineJoin="round" />
              <Marker coordinate={routeData[0]} title="START" description={`Started at ${formatPointTime(firstSync)}`} pinColor="#3B82F6" />
              <Marker coordinate={routeData[routeData.length - 1]} title="END" description={`Ended at ${formatPointTime(lastSync)}`} pinColor="#EF4444" />
              {playbackIdx !== null && (
                <Marker coordinate={routeData[playbackIdx]}>
                  <View style={styles.movingMarker}><Text style={{fontSize: 14}}>🏃</Text></View>
                </Marker>
              )}
            </MapView>

            <TouchableOpacity style={[styles.playBtn, isAnimating && {backgroundColor: '#27272A'}]} onPress={startPlayback} disabled={isAnimating} activeOpacity={0.8}>
              <Text style={[styles.playText, isAnimating && {color: '#71717A'}]}>{isAnimating ? "ANIMATING ROUTE..." : "▶ PLAY ROUTE"}</Text>
            </TouchableOpacity>

            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>TOTAL DISTANCE</Text>
                <Text style={styles.summaryVal}>{distance} KM</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>FIRST SYNC</Text>
                <Text style={styles.summaryValSub}>{formatPointTime(firstSync)}</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>LAST SYNC</Text>
                <Text style={styles.summaryValSub}>{formatPointTime(lastSync)}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.centerBox}>
            {loading ? <ActivityIndicator size="large" color="#10B981" /> : 
              <Text style={styles.initialText}>{hasFetched ? "No journey found on this date." : "Select an officer and date to track their route."}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  filterCard: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 25, backgroundColor: '#18181B', 
    paddingHorizontal: 25, borderBottomWidth: 1, borderBottomColor: '#27272A', zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10
  },
  headerTitle: { color: '#FAFAFA', fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5 },
  inputGroup: { marginBottom: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  label: { color: '#71717A', fontSize: 10, fontWeight: '800', marginBottom: 10, letterSpacing: 1 },
  pickerWrapper: { backgroundColor: '#27272A', borderRadius: 14, height: 55, justifyContent: 'center', overflow: 'hidden' },
  picker: { color: '#FAFAFA', width: '100%', fontWeight: '600' },
  dateBtn: { backgroundColor: '#27272A', height: 55, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dateBtnText: { color: '#FAFAFA', fontSize: 14, fontWeight: '700' },
  fetchBtn: { backgroundColor: '#10B981', height: 55, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fetchText: { color: '#064E3B', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  
  contentArea: { flex: 1, backgroundColor: '#121212' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  initialText: { color: '#71717A', textAlign: 'center', fontSize: 15, fontWeight: '500' },
  
  movingMarker: { backgroundColor: '#18181B', padding: 8, borderRadius: 25, borderWidth: 3, borderColor: '#10B981', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5 },
  playBtn: { position: 'absolute', top: 25, alignSelf: 'center', backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10, zIndex: 1000 },
  playText: { color: '#064E3B', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  
  summaryBar: { position: 'absolute', bottom: 35, left: 20, right: 20, backgroundColor: 'rgba(24, 24, 27, 0.95)', flexDirection: 'row', paddingVertical: 20, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#3F3F46', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 15 },
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { color: '#71717A', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  summaryVal: { color: '#10B981', fontSize: 18, fontWeight: '900' },
  summaryValSub: { color: '#FAFAFA', fontSize: 13, fontWeight: '700', marginTop: 3 },
  vDivider: { width: 1, height: '80%', backgroundColor: '#3F3F46', alignSelf: 'center' },
  
  iosPickerOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
  iosPickerContainer: { backgroundColor: '#18181B', marginHorizontal: 20, padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#27272A' },
  iosDoneBtn: { alignSelf: 'flex-end', paddingBottom: 15 },
  iosDoneText: { color: '#10B981', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});