import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ScrollView, Image, ActivityIndicator, Dimensions 
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
  const [todayExpense, setTodayExpense] = useState(0); // Added state for expenses
  const [checkInTime, setCheckInTime] = useState(null);
  const [workHours, setWorkHours] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkTodayAttendance();
    getPreciseLocation();
    fetchTodayExpenses(); // Now this will work
  }, []);

  useEffect(() => {
    let interval = null;
    if (status === 'In Progress' && checkInTime) {
      interval = setInterval(updateTimerAndProgress, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [status, checkInTime]);

  /**
   * FIX: Added the missing fetchTodayExpenses function
   */
  const fetchTodayExpenses = async () => {
    try {
      const res = await api.get('/expenses/my');
      const today = new Date().toISOString().split('T')[0];
      
      // Calculate sum of today's expenses
      const total = res.data
        .filter(exp => exp.date.startsWith(today))
        .reduce((sum, exp) => sum + Number(exp.amount), 0);
        
      setTodayExpense(total);
    } catch (e) { 
      console.log("Expense fetch error:", e); 
    }
  };

  const updateTimerAndProgress = () => {
    const startTime = new Date(checkInTime).getTime();
    const currentTime = new Date().getTime();
    const totalRequiredMs = 8.5 * 60 * 60 * 1000;
    const elapsedMs = currentTime - startTime;
    
    const currentProgress = (elapsedMs / totalRequiredMs) * 100;
    setProgress(currentProgress > 100 ? 100 : currentProgress);

    if (totalRequiredMs - elapsedMs <= 0) {
      setTimeLeft("8:30 Hours Completed! ✅");
    } else {
      const diff = totalRequiredMs - elapsedMs;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s remaining`);
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
         
         if(record.checkInLocation?.lat) {
           setLocation({
             latitude: Number(record.checkInLocation.lat),
             longitude: Number(record.checkInLocation.lng),
             latitudeDelta: 0.005,
             longitudeDelta: 0.005,
           });
         }
       }
     } catch (e) { console.log(e); }
  };

  const getPreciseLocation = async () => {
    let { status: permStatus } = await Location.requestForegroundPermissionsAsync();
    if (permStatus !== 'granted') return;
    try {
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } catch (e) { console.log(e); }
  };

  const handleAttendance = async () => {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) return Alert.alert("Error", "Camera required");

    setLoading(true);
    try {
      let currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let result = await ImagePicker.launchCameraAsync({ 
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true 
      });

      if (!result.canceled) {
        const endpoint = status === 'none' ? '/attendance/check-in' : '/attendance/check-out';
        await api.post(endpoint, { 
          selfie: result.assets[0].base64,
          location: { lat: currentLoc.coords.latitude, lng: currentLoc.coords.longitude } 
        });
        checkTodayAttendance(); 
      }
    } catch (e) { Alert.alert("Error", "Failed"); } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ alignItems: 'center', paddingTop: 20, paddingBottom: 30 }}>
      <Text style={styles.title}>Officer Dashboard</Text>
      
      {/* Map Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>LIVE DUTY LOCATION</Text>
        <View style={styles.mapContainer}>
          {location ? (
            <MapView style={styles.map} region={location} showsUserLocation={true}>
              <Marker coordinate={location} title="You are here" pinColor="#00E676" />
            </MapView>
          ) : <ActivityIndicator color="#00E676" />}
        </View>

        <Text style={[styles.cardTitle, {marginTop: 20}]}>WORK ATTENDANCE</Text>
        
        {status !== 'none' && status !== 'In Progress' ? (
          <View style={styles.successBox}>
            <Image 
              source={{ uri: userImage?.startsWith('data') ? userImage : `data:image/jpeg;base64,${userImage}` }} 
              style={styles.selfiePreview} 
            />
            <Text style={styles.successText}>✅ Status: {status}</Text>
            <Text style={{color: '#888', fontSize: 12}}>Worked: {workHours} Hours</Text>
          </View>
        ) : (
          <View style={{width: '100%'}}>
            {status === 'In Progress' && (
               <View style={styles.infoBox}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>On Duty</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.timerText}>{timeLeft}</Text>
               </View>
            )}
            <TouchableOpacity 
              style={[styles.button, status === 'In Progress' && {backgroundColor: '#FF5252'}]} 
              onPress={handleAttendance} 
              disabled={loading}
            >
                <Text style={styles.buttonText}>
                  {status === 'none' ? 'PUNCH IN (Start Duty)' : 'PUNCH OUT (End Duty)'}
                </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Expense Summary Card */}
      <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>₹{todayExpense}</Text>
              <Text style={styles.summaryLabel}>Today's Expenses</Text>
          </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  card: { width: '92%', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 20, marginBottom: 20 },
  cardTitle: { color: '#00E676', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
  mapContainer: { width: '100%', height: 200, borderRadius: 15, overflow: 'hidden', backgroundColor: '#222' },
  map: { width: '100%', height: '100%' },
  button: { backgroundColor: '#00E676', padding: 18, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  buttonText: { fontWeight: 'bold', color: '#000' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  infoBox: { padding: 15, backgroundColor: '#252525', borderRadius: 12, alignItems: 'center' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#444', borderRadius: 4, marginVertical: 10 },
  progressBarFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 4 },
  timerText: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  successBox: { alignItems: 'center', padding: 10 },
  selfiePreview: { width: 80, height: 80, borderRadius: 40, marginBottom: 10, borderWidth: 2, borderColor: '#00E676' },
  successText: { color: '#00E676', fontWeight: 'bold', fontSize: 16 },
  summaryCard: { width: '92%', backgroundColor: '#1E1E1E', padding: 20, borderRadius: 15 },
  summaryItem: { alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  summaryLabel: { color: '#888', fontSize: 12 }
});