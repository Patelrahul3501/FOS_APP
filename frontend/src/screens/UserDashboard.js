import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ScrollView, Image, ActivityIndicator, AppState 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps'; 
import { api } from '../api/client';

export default function UserDashboard() {
  const [status, setStatus] = useState('none'); 
  const [userImage, setUserImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [todayExpense, setTodayExpense] = useState(0);
  const [checkInTime, setCheckInTime] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [workHours, setWorkHours] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [progress, setProgress] = useState(0);
  const [locationPermission, setLocationPermission] = useState(true);

  const syncTimerRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // 1. DYNAMIC PERMISSION & APP STATE LISTENER
  useEffect(() => {
    refreshDashboard();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        refreshDashboard();
      }
      appState.current = nextAppState;
    });

    const interval = setInterval(checkLocationPermission, 3000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const checkLocationPermission = async () => {
    let { status: permStatus } = await Location.getForegroundPermissionsAsync();
    let isServicesEnabled = await Location.hasServicesEnabledAsync();
    const isGranted = permStatus === 'granted' && isServicesEnabled;
    
    if (isGranted && !locationPermission) {
        refreshDashboard();
    }
    setLocationPermission(isGranted);
  };

  const refreshDashboard = () => {
    checkTodayAttendance();
    fetchTodayExpenses();
    checkLocationPermission();
  };

  // 2. SERVER SYNC LOGIC
  useEffect(() => {
    if (status === 'In Progress') {
      syncLocationToServer();
      syncTimerRef.current = setInterval(syncLocationToServer, 30000); 
    } else {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    }
    return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
  }, [status]);

  useEffect(() => {
    let interval = null;
    if (status === 'In Progress' && checkInTime) {
      interval = setInterval(updateTimerAndProgress, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [status, checkInTime]);

  const syncLocationToServer = async () => {
    try {
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setLocation(coords);
      await api.post('/attendance/update-location', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude
      });

      setLastSyncTime(new Date().toISOString());
    } catch (e) {
      console.log("Sync Error:", e.message);
    }
  };

  // UPDATED: Standardized 12-hour AM/PM format
  const formatTimeLabel = (timeStr) => {
    if (!timeStr) return "--:--";
    return new Date(timeStr).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const fetchTodayExpenses = async () => {
    try {
      const res = await api.get('/expenses/my');
      const today = new Date().toISOString().split('T')[0];
      const total = res.data
        .filter(exp => exp.date.startsWith(today))
        .reduce((sum, exp) => sum + Number(exp.amount), 0);
      setTodayExpense(total);
    } catch (e) { console.log(e); }
  };

  const updateTimerAndProgress = () => {
    if (!checkInTime) return;
    const startTime = new Date(checkInTime).getTime();
    const elapsedMs = Date.now() - startTime;
    const totalMs = 8.5 * 60 * 60 * 1000;
    setProgress(Math.min((elapsedMs / totalMs) * 100, 100));
    const diff = totalMs - elapsedMs;
    if (diff <= 0) setTimeLeft("Shift Completed ✅");
    else {
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m left`);
    }
  };

  const checkTodayAttendance = async () => {
     try {
       const res = await api.get('/attendance/status');
       if(res.data.exists) {
         const record = res.data.record;
         setStatus(record.status);
         setUserImage(record.selfie);
         setCheckInTime(record.checkInTime);
         setWorkHours(record.workHours || 0);
         if (record.status === 'In Progress') syncLocationToServer();
       } else { setStatus('none'); }
     } catch (e) { console.log(e); }
  };

  const handleAttendance = async () => {
    if (!locationPermission) return Alert.alert("Blocked", "Fix location settings.");
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) return Alert.alert("Error", "Camera required");
    
    setLoading(true);
    try {
      let currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let result = await ImagePicker.launchCameraAsync({ 
        cameraType: ImagePicker.CameraType.front, 
        allowsEditing: true, 
        quality: 0.4, 
        base64: true 
      });
      
      if (!result.canceled) {
        const endpoint = status === 'none' ? '/attendance/check-in' : '/attendance/check-out';
        await api.post(endpoint, { 
          selfie: result.assets[0].base64,
          location: { lat: currentLoc.coords.latitude, lng: currentLoc.coords.longitude } 
        });
        refreshDashboard(); 
      }
    } catch (e) { Alert.alert("Error", "Action Failed"); } 
    finally { setLoading(false); }
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 20, paddingBottom: 30 }}>
        <Text style={styles.title}>Officer Dashboard</Text>
        
        <View style={styles.card}>
          <View style={styles.mapContainer}>
            {locationPermission && (status === 'In Progress' || location) ? (
              <MapView style={styles.map} region={location || undefined} showsUserLocation={true}>
                {location && <Marker coordinate={location} title="You are here" pinColor="#00E676" />}
              </MapView>
            ) : (
              <View style={styles.mapError}>
                <ActivityIndicator color="#444" />
                <Text style={{color: '#666', marginTop: 10, fontSize: 12}}>GPS Access Required for Map</Text>
              </View>
            )}
          </View>
          
          <View style={styles.attendanceHeader}>
             <Text style={styles.cardTitle}>WORK ATTENDANCE</Text>
             {lastSyncTime && <Text style={styles.syncText}>Last Sync: {formatTimeLabel(lastSyncTime)}</Text>}
          </View>
          
          {status !== 'none' && status !== 'In Progress' ? (
            <View style={styles.successBox}>
              <Image source={{ uri: userImage?.startsWith('data') ? userImage : `data:image/jpeg;base64,${userImage}` }} style={styles.selfiePreview} />
              <Text style={[styles.successText, status === 'Terminated' && {color: '#FF5252'}]}>
                {status === 'Terminated' ? '⚠️ Session: Terminated' : `✅ Session: ${status}`}
              </Text>
              <View style={styles.timeSummaryRow}>
                  <Text style={styles.timeDetail}>IN: {formatTimeLabel(checkInTime)}</Text>
                  <View style={styles.vDivider} />
                  <Text style={styles.timeDetail}>Worked: {workHours}h</Text>
              </View>
              
              {/* FIXED RECOVERY LOGIC: Resume is now available for 'Terminated' status sessions 
                  provided the work hours haven't hit the 8.5h shift requirement. */}
              {(status === 'Terminated' || parseFloat(workHours) < 8.5) && status !== 'Present' ? (
                <TouchableOpacity 
                  style={[styles.resumeBtn, !locationPermission && {borderColor: '#444'}]} 
                  onPress={async () => {
                    if(!locationPermission) return Alert.alert("Error", "Enable location first.");
                    try {
                      await api.post('/attendance/resume');
                      refreshDashboard();
                    } catch(err) { Alert.alert("Error", "Resume failed. Ensure GPS is active."); }
                  }}
                >
                    <Text style={[styles.resumeBtnText, !locationPermission && {color: '#444'}]}>RESUME DUTY</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.completedMessage}>
                    <Text style={styles.completedText}>
                        {status === 'Terminated' ? 'Duty terminated. No further actions allowed.' : 'Shift fully completed for today! 🏆'}
                    </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={{width: '100%'}}>
              {status === 'In Progress' && (
                 <View style={styles.infoBox}>
                    <View style={styles.timeLabelsRow}>
                        <Text style={styles.smallTime}>Check-In: {formatTimeLabel(checkInTime)}</Text>
                        <Text style={styles.smallTime}>{timeLeft}</Text>
                    </View>
                    <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${progress}%` }]} /></View>
                 </View>
              )}
              <TouchableOpacity 
                style={[
                    styles.button, 
                    status === 'In Progress' && {backgroundColor: '#FF5252'}, 
                    !locationPermission && {backgroundColor: '#333'}
                ]} 
                onPress={handleAttendance} 
                disabled={!locationPermission || loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : (
                    <Text style={styles.buttonText}>
                        {!locationPermission ? 'ACCESS BLOCKED' : (status === 'none' ? 'PUNCH IN' : 'PUNCH OUT')}
                    </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
                <Text style={styles.summaryVal}>₹{todayExpense}</Text>
                <Text style={styles.summaryLabel}>Today's Expenses</Text>
            </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#121212' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  card: { width: '92%', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 20, marginBottom: 20 },
  attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  cardTitle: { color: '#00E676', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  syncText: { color: '#666', fontSize: 10 },
  mapContainer: { width: '100%', height: 200, borderRadius: 15, overflow: 'hidden', backgroundColor: '#222' },
  map: { width: '100%', height: '100%' },
  mapError: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: { backgroundColor: '#00E676', padding: 18, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  buttonText: { fontWeight: 'bold', color: '#000' },
  infoBox: { width: '100%', padding: 15, backgroundColor: '#252525', borderRadius: 12 },
  timeLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  smallTime: { color: '#888', fontSize: 11, fontWeight: 'bold' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#444', borderRadius: 4 },
  progressBarFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 4 },
  successBox: { alignItems: 'center', padding: 10 },
  selfiePreview: { width: 80, height: 80, borderRadius: 40, marginBottom: 10, borderWidth: 2, borderColor: '#00E676' },
  successText: { color: '#00E676', fontWeight: 'bold', fontSize: 18, marginBottom: 5 },
  timeSummaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  timeDetail: { color: '#888', fontSize: 13 },
  vDivider: { width: 1, height: 12, backgroundColor: '#444', marginHorizontal: 10 },
  resumeBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10, borderWidth: 1, borderColor: '#00E676' },
  resumeBtnText: { color: '#00E676', fontWeight: 'bold' },
  completedMessage: { marginTop: 20, padding: 10, backgroundColor: '#252525', borderRadius: 10, width: '100%', alignItems: 'center' },
  completedText: { color: '#888', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  summaryCard: { width: '92%', backgroundColor: '#1E1E1E', padding: 20, borderRadius: 15 },
  summaryItem: { alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  summaryLabel: { color: '#888', fontSize: 12 }
});
