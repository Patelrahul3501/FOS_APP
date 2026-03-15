import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Animated, TouchableOpacity, StyleSheet, 
  Dimensions, Text, StatusBar, Platform, Linking, Vibration, Alert 
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { api, setLogoutCallback } from './src/api/client';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import UserDashboard from './src/screens/UserDashboard';
import AdminDashboard from './src/screens/AdminDashboard';
import ExpenseScreen from './src/screens/ExpenseScreen';
import AttendanceCalendar from './src/screens/AttendanceCalendar';
import ManageUsers from './src/screens/ManageUsers';
import CreateUser from './src/screens/CreateUser';
import AdminAttendance from './src/screens/AdminAttendance';
import AdminExpenses from './src/screens/AdminExpenses';
import UserRoute from './src/screens/UserRoute';
import ProfileScreen from './src/screens/ProfileScreen';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.78;

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); 
  const [currentScreen, setCurrentScreen] = useState('DASHBOARD'); 
  const [isOpen, setIsOpen] = useState(false);
  
  // --- GLOBAL SECURITY STATE ---
  const [locationPermission, setLocationPermission] = useState(true);
  const [isDutyActive, setIsDutyActive] = useState(false); 
  const [graceSeconds, setGraceSeconds] = useState(300);
  const [isTerminated, setIsTerminated] = useState(false); 
  const graceTimerRef = useRef(null);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => { 
    checkStatus(); 
    setLogoutCallback(handleLogout);
  }, []);

  useEffect(() => {
    if (isLoggedIn && userRole === 'user') {
      requestLocationPermission();
      syncDutyAndLocation();
      const interval = setInterval(syncDutyAndLocation, 5000);
      return () => {
        clearInterval(interval);
        if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      };
    }
  }, [isLoggedIn, userRole]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted:', status);
      }
    } catch (e) {
      console.log('requestLocationPermission error:', e.message);
    }
  };

  const checkStatus = async () => {
    const token = await AsyncStorage.getItem('userToken');
    const role = await AsyncStorage.getItem('userRole');
    if (token && role) {
      setUserRole(role);
      setIsLoggedIn(true);
    }
  };

  const syncDutyAndLocation = async () => {
    try {
      const res = await api.get('/attendance/status');
      const active = res.data?.exists && res.data?.record?.status === 'In Progress';
      setIsDutyActive(active);

      const { status: permStatus } = await Location.getForegroundPermissionsAsync();
      const isServicesEnabled = await Location.hasServicesEnabledAsync();

      const isGranted = permStatus === 'granted' && isServicesEnabled;
      setLocationPermission(isGranted);
      
      // --- CRITICAL RECOVERY LOGIC ---
      if (isGranted) {
        // If GPS is fixed, stop timers and UNLOCK the termination flag
        if (graceTimerRef.current) stopGracePeriod();
        setIsTerminated(false); // This allows the Resume button to show
      } else if (active) {
        // If GPS is missing but duty is active, handle grace period
        if (!isTerminated) handleGracePeriod();
      }
    } catch (e) { 
        console.log("Security Monitor Error:", e.message); 
    }
  };

  const handleGracePeriod = async () => {
    if (graceTimerRef.current || isTerminated) return;
    
    let deadline = await AsyncStorage.getItem('graceDeadline');
    if (!deadline) {
      deadline = (Date.now() + 300000).toString();
      await AsyncStorage.setItem('graceDeadline', deadline);
    }
    
    graceTimerRef.current = setInterval(async () => {
      const rem = Math.max(0, Math.floor((parseInt(deadline) - Date.now()) / 1000));
      setGraceSeconds(rem);
      
      if (rem <= 0) {
        stopGracePeriod();
        forceStopDuty();
      } else if (rem <= 60) {
        Vibration.vibrate([200, 100, 200]); 
      } else if (rem % 60 === 0) {
        Vibration.vibrate(500);
      }
    }, 1000);
  };

  const stopGracePeriod = async () => {
    if (graceTimerRef.current) {
        clearInterval(graceTimerRef.current);
        graceTimerRef.current = null;
    }
    await AsyncStorage.removeItem('graceDeadline');
    setGraceSeconds(300);
  };

  const forceStopDuty = async () => {
    try {
      setIsTerminated(true); 
      await api.post('/attendance/stop-duty', { reason: "Compliance Violation" });
      Alert.alert("TERMINATED", "Duty ended due to location access failure.");
      setCurrentScreen('DASHBOARD');
    } catch (e) { console.log(e.message); }
  };

  const handleFixNow = async () => {
    try {
      let { status } = await Location.getForegroundPermissionsAsync();

      // If not granted, actively request permission (shows Android dialog)
      if (status !== 'granted') {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      }

      if (status !== 'granted') {
        // Still denied — send to app settings
        Alert.alert(
          "Permission Denied",
          "Location access was denied. Please enable it in App Settings.",
          [{ text: "Open Settings", onPress: () => Linking.openSettings() }, { text: "Cancel" }]
        );
        return;
      }

      const isServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isServicesEnabled) {
        if (Platform.OS === 'android') {
          try { await Location.enableNetworkProviderAsync(); }
          catch (e) { Alert.alert("GPS Off", "Please turn on Location/GPS from your notification shade."); }
        } else {
          Alert.alert("GPS Off", "Please enable Location in device settings.");
        }
      } else {
        // Permission granted + GPS on: update state directly so banner clears immediately
        setLocationPermission(true);
        setIsTerminated(false);
        await stopGracePeriod();
      }
    } catch (error) { console.log('handleFixNow error:', error); }
  };

  const formatGraceTime = (sec) => `${Math.floor(sec / 60)}m ${sec % 60}s`;

  const toggleDrawer = () => {
    const toValue = isOpen ? -SIDEBAR_WIDTH : 0;
    Animated.spring(slideAnim, { toValue, friction: 8, tension: 40, useNativeDriver: true }).start();
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Only hit the backend if we actually have a token to tell it we are stopping duty
      if (token) {
        await api.post('/attendance/stop-duty'); 
      }
    } catch (e) { 
      console.log("Logout cleanup failed (ignored)"); 
    } finally {
      await stopGracePeriod();
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userRole');
      setIsLoggedIn(false);
      setUserRole(null);
      setIsOpen(false);
      setIsTerminated(false);
      slideAnim.setValue(-SIDEBAR_WIDTH);
      setCurrentScreen('DASHBOARD');
    }
  };

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
    if (isOpen) toggleDrawer();
  };

  const renderMainContent = () => {
    if (userRole === 'admin') {
      switch (currentScreen) {
        case 'MANAGE_USERS': return <ManageUsers onNavigate={navigateTo} />;
        case 'CREATE_USER': return <CreateUser onBack={() => setCurrentScreen('MANAGE_USERS')} />;
        case 'ADMIN_ATTENDANCE': return <AdminAttendance />;
        case 'ADMIN_EXPENSES': return <AdminExpenses />;
        case 'USER_ROUTE': return <UserRoute onBack={() => setCurrentScreen('DASHBOARD')} />;
        default: return <AdminDashboard onNavigate={navigateTo} />;
      }
    }
    switch (currentScreen) {
      case 'ExpenseScreen': return <ExpenseScreen />;
      case 'AttendanceCalendar': return <AttendanceCalendar />;
      case 'PROFILE': return <ProfileScreen />; 
      default: return <UserDashboard onNavigate={navigateTo} />;
    }
  };

  if (!isLoggedIn) return <LoginScreen onLoginSuccess={checkStatus} />;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.container}>
          <View style={styles.main}>
            {!locationPermission && userRole === 'user' && (
              <TouchableOpacity 
                style={[
                    styles.globalBanner, 
                    (isTerminated || (isDutyActive && graceSeconds < 60)) && { backgroundColor: '#d32f2f' }
                ]} 
                onPress={isTerminated ? null : handleFixNow}
                activeOpacity={isTerminated ? 1 : 0.9}
              >
                <View style={styles.bannerContent}>
                  {isTerminated ? (
                    <Text style={[styles.bannerText, { color: '#fff', textAlign: 'center' }]}>
                      ⚠️ <Text style={{fontWeight: '900'}}>SESSION TERMINATED</Text>{'\n'}
                      Fix GPS to enable Resume option.
                    </Text>
                  ) : isDutyActive ? (
                    <>
                      <Text style={styles.bannerText}>
                        ⚠️ <Text style={{fontWeight: '900'}}>SECURITY ALERT:</Text> Location Off{'\n'}
                        Duty ends in <Text style={{color: '#d32f2f', fontWeight: 'bold'}}>{formatGraceTime(graceSeconds)}</Text>
                      </Text>
                      <View style={styles.fixBtn}><Text style={styles.fixText}>FIX NOW</Text></View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.bannerText}>
                        ⚠️ <Text style={{fontWeight: '900'}}>LOCATION REQUIRED:</Text>{'\n'}
                        Please enable GPS to start your duty.
                      </Text>
                      <View style={styles.fixBtn}><Text style={styles.fixText}>ENABLE</Text></View>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.topBar}>
              {!isOpen && (
                <TouchableOpacity onPress={toggleDrawer} style={styles.hamburger}>
                   <View style={styles.line} /><View style={[styles.line, {width: 15}]} /><View style={styles.line} />
                </TouchableOpacity>
              )}
              <Text style={styles.topBarTitle}>FIELD OFFICER SYSTEM</Text>
              <View style={{width: 45}} />
            </View>
            <View style={{ flex: 1 }}>{renderMainContent()}</View>
          </View>
          {isOpen && <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={toggleDrawer} />}
          <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.sidebarInner}>
              <View style={styles.sidebarHeaderSection}>
                <TouchableOpacity style={styles.closeBtn} onPress={toggleDrawer}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
                <View style={styles.profileRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{userRole === 'admin' ? 'AD' : 'FO'}</Text></View>
                  <View style={styles.profileTextCont}>
                    <Text style={styles.sidebarTitle}>F.O.S MENU</Text>
                    <View style={styles.roleBadge}><Text style={styles.roleText}>{userRole?.toUpperCase()}</Text></View>
                  </View>
                </View>
              </View>
              <View style={styles.menuContainer}>
                 <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('DASHBOARD')}><Text style={styles.menuIcon}>🏠</Text><Text style={styles.menuLabel}>Dashboard</Text></TouchableOpacity>
                 {userRole === 'user' && <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('PROFILE')}><Text style={styles.menuIcon}>👤</Text><Text style={styles.menuLabel}>My Profile</Text></TouchableOpacity>}
                 {userRole === 'admin' ? (
                   <>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('MANAGE_USERS')}><Text style={styles.menuIcon}>👥</Text><Text style={styles.menuLabel}>Users</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('ADMIN_ATTENDANCE')}><Text style={styles.menuIcon}>📅</Text><Text style={styles.menuLabel}>Attendance</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('ADMIN_EXPENSES')}><Text style={styles.menuIcon}>📈</Text><Text style={styles.menuLabel}>Expense Logs</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('USER_ROUTE')}><Text style={styles.menuIcon}>📍</Text><Text style={styles.menuLabel}>Track Routes</Text></TouchableOpacity>
                   </>
                 ) : (
                   <>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('AttendanceCalendar')}><Text style={styles.menuIcon}>📅</Text><Text style={styles.menuLabel}>Logbook</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('ExpenseScreen')}><Text style={styles.menuIcon}>💸</Text><Text style={styles.menuLabel}>Expenses</Text></TouchableOpacity>
                   </>
                 )}
              </View>
              <View style={styles.footer}><TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity></View>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1 },
  main: { flex: 1 },
  globalBanner: { backgroundColor: '#FFD700', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  bannerText: { color: '#000', fontWeight: 'bold', fontSize: 11, flex: 1, lineHeight: 16 },
  fixBtn: { backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 10 },
  fixText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 90 },
  topBar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#333' },
  topBarTitle: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  hamburger: { padding: 10 },
  line: { height: 2, width: 22, backgroundColor: '#00E676', marginVertical: 2.5, borderRadius: 2 },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH, backgroundColor: '#161616', zIndex: 1000, elevation: 10 },
  sidebarInner: { flex: 1 },
  sidebarHeaderSection: { paddingTop: 40, paddingHorizontal: 25, paddingBottom: 30, backgroundColor: '#1E1E1E' },
  closeBtn: { position: 'absolute', top: 20, right: 20, padding: 10 },
  closeText: { color: '#555', fontSize: 22 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 10, backgroundColor: '#00E676', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', fontSize: 16, color: '#000' },
  profileTextCont: { marginLeft: 15 },
  sidebarTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  roleBadge: { backgroundColor: 'rgba(0, 230, 118, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  roleText: { color: '#00E676', fontSize: 9, fontWeight: 'bold' },
  menuContainer: { flex: 1, paddingTop: 20, paddingHorizontal: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, borderRadius: 10 },
  menuIcon: { fontSize: 18, marginRight: 15 },
  menuLabel: { color: '#BBB', fontSize: 14, fontWeight: '600' },
  footer: { padding: 25 },
  logoutBtn: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  logoutText: { color: '#FF5252', fontWeight: 'bold' }
});