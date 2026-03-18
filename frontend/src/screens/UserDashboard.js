import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ScrollView, Image, ActivityIndicator, AppState, Linking, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
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

  // 1. APP STATE LISTENER — refresh when app comes to foreground
  useEffect(() => {
    refreshDashboard();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        refreshDashboard();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const refreshDashboard = () => {
    checkTodayAttendance();
    fetchTodayExpenses();
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
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    const isServicesEnabled = await Location.hasServicesEnabledAsync();
    
    const isExpoGo = Constants.appOwnership === 'expo' || Constants.appOwnership === 'guest';
    
    console.log("Permission Status:", { fgStatus, bgStatus, isServicesEnabled, isExpoGo });

    const bgGrantedOrBypassed = bgStatus === 'granted' || isExpoGo || Platform.OS === 'ios';

    if (!isServicesEnabled) {
      if (Platform.OS === 'android') {
        try { await Location.enableNetworkProviderAsync(); } 
        catch (e) { return Alert.alert("GPS Off", "Please turn on Location/GPS from your notification shade."); }
      } else {
        return Alert.alert("GPS Off", "Please enable Location in your device settings.");
      }
    } else if (fgStatus !== 'granted' && !bgGrantedOrBypassed) {
      return Alert.alert(
        "Location Permissions Required", 
        "Both standard location and 'Always Allow' background location permissions are required to punch in.",
        [{ text: "OK" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
      );
    } else if (fgStatus !== 'granted') {
      return Alert.alert(
        "Permission Required", 
        "Standard (foreground) location permission is required to punch in.",
        [{ text: "OK" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
      );
    } else if (!bgGrantedOrBypassed) {
      const msg = isExpoGo 
        ? "⚠️ EXPO GO LIMITATION: Background location is not supported. Use a Development Build." 
        : "Please ensure 'Allow all the time' (Always Allow) is selected in Settings.";
      return Alert.alert(
        "Background Location Required", 
        msg,
        [{ text: "OK" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
      );
    }
    // Users can now punch in even if their last session was terminated, wait, check logic:
    // Actually, "Punch In" should not be available if they're Terminated (because they should use "Resume Duty" instead until their full day is done).
    if (status === 'Terminated') {
      return Alert.alert("Session Terminated", "Your session was terminated. Please use the 'RESUME DUTY' button below your details to clock back in.");
    }
    
    // NEW: Check for 9 PM Restriction before Punching In
    if (status === 'none') {
      const currentHour = new Date().getHours();
      if (currentHour >= 21) {
        return Alert.alert(
          "Access Denied 🕒",
          "You cannot start your duty after 9:00 PM."
        );
      }
      
      try {
        const holidayRes = await api.get('/attendance/is-holiday');
        if (holidayRes.data.isHoliday) {
          return Alert.alert(
            "Holiday Warning 🌴",
            `Today is marked as a holiday: ${holidayRes.data.name}.\nAre you sure you want to punch in?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Punch In Anyway", style: "destructive", onPress: () => proceedWithAttendance() }
            ]
          );
        }
      } catch (e) { console.log("Holiday check failed", e); }
    }

    proceedWithAttendance();
  };

  const proceedWithAttendance = async () => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) return Alert.alert("Error", "Camera required");
    
    setLoading(true);
    try {
      // FIX 1: Try to get last known immediately. If null (first time), fall back to getting current with balanced accuracy.
      // This eliminates the 5-10 second GPS satellite lock delay on newer devices.
      let currentLoc = await Location.getLastKnownPositionAsync({});
      if (!currentLoc) {
          currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      
      // FIX 2: Compress selfie further (0.2 instead of 0.4) to halve the base64 string size for faster network transfer
      let result = await ImagePicker.launchCameraAsync({ 
        cameraType: ImagePicker.CameraType.front, 
        allowsEditing: true, 
        quality: 0.2, 
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
              
              {/* Show RESUME if session is paused or terminated, but not entirely 'Present' */}
              {parseFloat(workHours) < 8.5 && status !== 'Present' ? (
                <TouchableOpacity 
                  style={styles.resumeBtn}
                  onPress={async () => {
                    const currentHour = new Date().getHours();
                    if (currentHour >= 21) {
                      return Alert.alert(
                        "Access Denied 🕒",
                        "Duty hours are over. You cannot resume your shift after 9:00 PM."
                      );
                    }
                    
                    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
                    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
                    const isServicesEnabled = await Location.hasServicesEnabledAsync();
                    
                    const isExpoGo = Constants.appOwnership === 'expo' || Constants.appOwnership === 'guest';
                    
                    const bgGrantedOrBypassed = bgStatus === 'granted' || isExpoGo || Platform.OS === 'ios';

                    if (!isServicesEnabled) {
                      if (Platform.OS === 'android') {
                        try { await Location.enableNetworkProviderAsync(); } 
                        catch (e) { return Alert.alert("GPS Off", "Please turn on Location/GPS from your notification shade."); }
                      } else {
                        return Alert.alert("GPS Off", "Please enable Location in your device settings.");
                      }
                    } else if (fgStatus !== 'granted' && !bgGrantedOrBypassed) {
                      return Alert.alert(
                        "Location Permissions Required", 
                        "Both standard location and 'Always Allow' background location permissions are required to resume duty.",
                        [{ text: "OK" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
                      );
                    } else if (fgStatus !== 'granted') {
                      return Alert.alert(
                        "Permission Required", 
                        "Standard (foreground) location permission is required to resume duty.",
                        [{ text: "OK" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
                      );
                    } else if (!bgGrantedOrBypassed) {
                      const msg = isExpoGo 
                        ? "⚠️ EXPO GO LIMITATION: Background location is not supported. Use a Development Build." 
                        : "Please ensure 'Allow all the time' (Always Allow) is selected in Settings.";
                      return Alert.alert(
                        "Background Location Required", 
                        msg,
                        [{ text: "OK" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
                      );
                    }
                    
                    try {
                      await api.post('/attendance/resume');
                      refreshDashboard();
                    } catch(err) { Alert.alert("Error", "Resume failed. Ensure GPS is active."); }
                  }}
                >
                    <Text style={styles.resumeBtnText}>RESUME DUTY</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.completedMessage}>
                    <Text style={styles.completedText}>
                        {status === 'Terminated' ? '⛔ Duty terminated by system. No further actions allowed today.' : 'Shift fully completed for today! 🏆'}
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
  mainContainer: { flex: 1, backgroundColor: '#0A0A0A' },
  title: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 20, marginTop: 10, letterSpacing: 0.5 },
  card: { 
    width: '92%', backgroundColor: '#18181B', padding: 20, borderRadius: 24, marginBottom: 25,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: '#27272A'
  },
  attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 15 },
  cardTitle: { color: '#10B981', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  syncText: { color: '#71717A', fontSize: 10, fontWeight: '600' },
  mapContainer: { width: '100%', height: 220, borderRadius: 18, overflow: 'hidden', backgroundColor: '#27272A' },
  map: { width: '100%', height: '100%' },
  mapError: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: { 
    backgroundColor: '#10B981', padding: 18, borderRadius: 16, marginTop: 20, alignItems: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8
  },
  buttonText: { fontWeight: '900', color: '#064E3B', fontSize: 16, letterSpacing: 0.5 },
  infoBox: { width: '100%', padding: 18, backgroundColor: '#27272A', borderRadius: 16, marginBottom: 5 },
  timeLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  smallTime: { color: '#A1A1AA', fontSize: 12, fontWeight: 'bold' },
  progressBarBg: { width: '100%', height: 6, backgroundColor: '#3F3F46', borderRadius: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 10 },
  successBox: { alignItems: 'center', padding: 15 },
  selfiePreview: { width: 90, height: 90, borderRadius: 45, marginBottom: 12, borderWidth: 3, borderColor: '#10B981' },
  successText: { color: '#10B981', fontWeight: '800', fontSize: 18, marginBottom: 8 },
  timeSummaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#27272A', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  timeDetail: { color: '#E4E4E7', fontSize: 14, fontWeight: '600' },
  vDivider: { width: 1, height: 16, backgroundColor: '#52525B', marginHorizontal: 15 },
  resumeBtn: { marginTop: 25, paddingVertical: 14, paddingHorizontal: 35, borderRadius: 12, borderWidth: 2, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  resumeBtnText: { color: '#10B981', fontWeight: '800', letterSpacing: 0.5 },
  completedMessage: { marginTop: 25, padding: 15, backgroundColor: '#27272A', borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  completedText: { color: '#A1A1AA', fontSize: 13, fontStyle: 'italic', textAlign: 'center', fontWeight: '600' },
  summaryCard: { 
    width: '92%', backgroundColor: '#18181B', padding: 25, borderRadius: 24, 
    borderWidth: 1, borderColor: '#27272A', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8
  },
  summaryItem: { alignItems: 'center' },
  summaryVal: { color: '#10B981', fontSize: 32, fontWeight: '900', textShadowColor: 'rgba(16, 185, 129, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  summaryLabel: { color: '#A1A1AA', fontSize: 13, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }
});
