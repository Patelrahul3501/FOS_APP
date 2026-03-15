import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Animated, TouchableOpacity, StyleSheet, 
  Dimensions, StatusBar, Platform, Linking, Vibration, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { api } from '../api/client';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.78;

export default function SimpleSidebar({ children, onLogout, onNavigate, userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const [locationPermission, setLocationPermission] = useState(true);
  const [locationErrorType, setLocationErrorType] = useState('none'); // 'permission' or 'services'
  const [debugStatus, setDebugStatus] = useState('');
  const [graceSeconds, setGraceSeconds] = useState(300);
  const graceTimerRef = useRef(null);

  useEffect(() => {
    if (userRole === 'user') {
      checkLocationSilently();
      const interval = setInterval(checkLocationSilently, 4000);
      return () => {
        clearInterval(interval);
        if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      };
    }
  }, [userRole]);

  const checkLocationSilently = async () => {
    try {
      let { status: permStatus } = await Location.getForegroundPermissionsAsync();
      let { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      let isServicesEnabled = await Location.hasServicesEnabledAsync();
      
      const isExpoGo = Platform.OS === 'android' && (Constants.appOwnership === 'expo' || Constants.appOwnership === 'guest');
      const bgGrantedOrBypassed = bgStatus === 'granted' || isExpoGo;

      setDebugStatus(`FG:${permStatus}, BG:${bgStatus}${isExpoGo ? ' (EXPO GO)' : ''}`);
      const isGranted = permStatus === 'granted' && bgGrantedOrBypassed && isServicesEnabled;
      setLocationPermission(isGranted);

      if (!isGranted) {
        if (permStatus !== 'granted') {
          setLocationErrorType('foreground');
        } else if (!bgGrantedOrBypassed) {
          setLocationErrorType('background');
        } else {
          setLocationErrorType('services');
        }
        handleGracePeriod();
      } else {
        setLocationErrorType('none');
        if (graceTimerRef.current) stopGracePeriod();
      }
    } catch (e) { console.log(e); }
  };

  const handleGracePeriod = async () => {
    if (graceTimerRef.current) return;
    let deadline = await AsyncStorage.getItem('graceDeadline');
    if (!deadline) {
      deadline = (Date.now() + 300000).toString();
      await AsyncStorage.setItem('graceDeadline', deadline);
      Alert.alert("⚠️ SECURITY", "Location disabled! Session terminates in 5 mins.");
    }

    graceTimerRef.current = setInterval(async () => {
      const rem = Math.max(0, Math.floor((parseInt(deadline) - Date.now()) / 1000));
      setGraceSeconds(rem);
      if (rem <= 0) {
        stopGracePeriod();
        forceStopDuty();
      } else if (rem % 60 === 0) Vibration.vibrate(500);
    }, 1000);
  };

  const stopGracePeriod = async () => {
    if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    graceTimerRef.current = null;
    await AsyncStorage.removeItem('graceDeadline');
    setGraceSeconds(300);
  };

  const forceStopDuty = async () => {
    try {
      await api.post('/attendance/stop-duty', { reason: "Compliance Violation" });
      Alert.alert("TERMINATED", "Duty session closed due to security violation.");
      onNavigate('Dashboard'); 
    } catch (e) { console.log(e); }
  };

  const handleManualFix = async () => {
    try {
      if (locationErrorType === 'permission') {
        // Step 1: Request foreground permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus === 'granted') {
          // Step 2: Request background permission (Always Allow)
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (bgStatus !== 'granted') {
            Alert.alert(
              "Background Location Required",
              'Please select "Allow all the time" (Always Allow) for location so the app can track your duty in the background.',
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() }
              ]
            );
            return;
          }
          const isServicesEnabled = await Location.hasServicesEnabledAsync();
          if (isServicesEnabled) {
            setLocationErrorType('none');
            setLocationPermission(true);
            stopGracePeriod();
          } else {
            setLocationErrorType('services');
          }
        } else {
          Alert.alert(
            "Permission Denied",
            "Please go to App Settings and grant Location permission (Always Allow).",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() }
            ]
          );
        }
      } else if (locationErrorType === 'services') {
        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
            const recheck = await Location.hasServicesEnabledAsync();
            if (recheck) {
              setLocationPermission(true);
              setLocationErrorType('none');
              stopGracePeriod();
              return;
            }
          } catch(err) { console.log(err); }
        }
        Alert.alert("GPS Turned Off", "Please pull down your screen and turn on the Location/GPS toggle.");
      }
    } catch (e) {
      console.log("Error fixing location:", e);
    }
  };

  const formatGraceTime = (sec) => `${Math.floor(sec / 60)}m ${sec % 60}s`;

  const toggleDrawer = (open) => {
    const toValue = open ? 0 : -DRAWER_WIDTH;
    Animated.spring(slideAnim, { toValue, friction: 8, tension: 40, useNativeDriver: true }).start();
    setIsOpen(open);
  };

  const handleNavigation = (screen) => {
    toggleDrawer(false);
    onNavigate(screen);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Main Container */}
      <View style={styles.main}>
        {/* FIX: Banner is now ABSOLUTELY positioned at the very top of the stack */}
        {!locationPermission && userRole === 'user' && (
          <TouchableOpacity 
            style={[styles.globalBanner, locationErrorType === 'services' && { backgroundColor: '#FF8A65' }]} 
            onPress={handleManualFix}
            activeOpacity={0.9}
          >
            <Text style={styles.bannerText}>
              ⚠️ <Text style={{fontWeight: '900'}}>
                {locationErrorType === 'services' ? 'TURN ON DEVICE GPS' : 
                 locationErrorType === 'foreground' ? 'APP PERMISSION REQUIRED' : 
                 'ENABLE ALWAYS ALLOW'}
              </Text>: {formatGraceTime(graceSeconds)} ({debugStatus})
            </Text>
            <View style={styles.bannerFixBtn}>
              <Text style={styles.bannerFixText}>{locationErrorType === 'services' ? 'TURN ON' : 'ENABLE'}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={[styles.navBar, !locationPermission && userRole === 'user' && { marginTop: 0 }]}>
          {!isOpen && (
            <TouchableOpacity onPress={() => toggleDrawer(true)} style={styles.menuTrigger}>
              <View style={styles.bar} /><View style={[styles.bar, { width: 15 }]} /><View style={styles.bar} />
            </TouchableOpacity>
          )}
          <Text style={styles.navTitle}>FIELD OFFICER SYSTEM</Text>
          <View style={{ width: 45 }} />
        </View>

        {/* This View holds the rest of the app content */}
        <View style={{ flex: 1 }}>
          {children}
        </View>
        
        {isOpen && <TouchableOpacity activeOpacity={1} onPress={() => toggleDrawer(false)} style={styles.dimmer} />}
      </View>

      {/* Sidebar Content (Absolute Positioned over everything) */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.innerSidebar}>
           <View style={styles.headerSection}>
              <TouchableOpacity style={styles.closeTouch} onPress={() => toggleDrawer(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
              <View style={styles.profileInfo}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{userRole === 'admin' ? 'AD' : 'FO'}</Text></View>
                <View style={styles.textContainer}>
                  <Text style={styles.userName}>{userRole === 'admin' ? 'Admin' : 'Officer'}</Text>
                  <Text style={styles.brandText}>F.O.S MENU</Text>
                </View>
              </View>
           </View>
           
           <View style={styles.menuContainer}>
             <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('Dashboard')}>
               <Text style={styles.menuEmoji}>🏠</Text><Text style={styles.menuLabel}>Home</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('ExpenseScreen')}>
               <Text style={styles.menuEmoji}>💳</Text><Text style={styles.menuLabel}>Expenses</Text>
             </TouchableOpacity>
           </View>

           <View style={styles.footer}>
             <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
               <Text style={styles.logoutText}>Sign Out</Text>
             </TouchableOpacity>
           </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  main: { flex: 1, backgroundColor: '#121212' },
  globalBanner: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    // Adjust height for Status Bar
    paddingTop: Platform.OS === 'ios' ? 45 : StatusBar.currentHeight || 30,
    paddingBottom: 15,
    width: '100%',
    zIndex: 9999, // Extremely high Z-Index
    elevation: 20, // High elevation for Android
  },
  bannerText: { color: '#000', fontWeight: 'bold', fontSize: 12, flex: 1 },
  bannerFixBtn: { backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bannerFixText: { color: '#FFD700', fontSize: 10, fontWeight: '900' },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#1A1A1A', zIndex: 10000 },
  innerSidebar: { flex: 1 },
  headerSection: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#222' },
  closeTouch: { position: 'absolute', top: 40, right: 10, padding: 10 },
  closeIcon: { color: '#555', fontSize: 18 },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#00E676', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', color: '#000' },
  textContainer: { marginLeft: 12 },
  userName: { color: '#fff', fontWeight: 'bold' },
  brandText: { color: '#00E676', fontSize: 10, fontWeight: 'bold' },
  menuContainer: { flex: 1, padding: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  menuEmoji: { fontSize: 18, marginRight: 15 },
  menuLabel: { color: '#BBB', fontSize: 15 },
  footer: { padding: 20 },
  logoutBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  logoutText: { color: '#FF5252', fontWeight: 'bold' },
  navBar: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  navTitle: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  menuTrigger: { padding: 15 },
  bar: { height: 2, width: 20, backgroundColor: '#00E676', marginVertical: 2 },
  dimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 500 }
});