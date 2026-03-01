import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Animated, TouchableOpacity, StyleSheet, 
  Dimensions, Text, StatusBar, Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    const token = await AsyncStorage.getItem('userToken');
    const role = await AsyncStorage.getItem('userRole');
    if (token && role) {
      setUserRole(role);
      setIsLoggedIn(true);
    }
  };

  const toggleDrawer = () => {
    const toValue = isOpen ? -SIDEBAR_WIDTH : 0;
    Animated.spring(slideAnim, {
      toValue, 
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setIsLoggedIn(false);
    setUserRole(null);
    setIsOpen(false);
    slideAnim.setValue(-SIDEBAR_WIDTH);
    setCurrentScreen('DASHBOARD');
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
        case 'USER_ROUTE': return <UserRoute />;
        // Removed PROFILE case for admin
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

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={checkStatus} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        translucent 
        backgroundColor="transparent" 
      />
      
      {isOpen && (
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.overlay} 
          onPress={toggleDrawer} 
        />
      )}

      {/* SIDEBAR */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.sidebarInner}>
          <View style={styles.sidebarHeaderSection}>
            <TouchableOpacity style={styles.closeBtn} onPress={toggleDrawer}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userRole === 'admin' ? 'AD' : 'FO'}</Text>
              </View>
              <View style={styles.profileTextCont}>
                <Text style={styles.sidebarTitle}>F.O.S MENU</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{userRole?.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.menuContainer}>
            <Text style={styles.sectionLabel}>NAVIGATION</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('DASHBOARD')}>
              <Text style={styles.menuIcon}>🏠</Text>
              <Text style={styles.menuLabel}>Dashboard</Text>
            </TouchableOpacity>

            {/* FIXED: Profile Link now only visible for 'user' role */}
            {userRole === 'user' && (
              <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('PROFILE')}>
                <Text style={styles.menuIcon}>👤</Text>
                <Text style={styles.menuLabel}>My Profile</Text>
              </TouchableOpacity>
            )}

            {userRole === 'admin' && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('MANAGE_USERS')}>
                  <Text style={styles.menuIcon}>👥</Text>
                  <Text style={styles.menuLabel}>Manage Users</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('ADMIN_ATTENDANCE')}>
                  <Text style={styles.menuIcon}>📅</Text>
                  <Text style={styles.menuLabel}>Attendance Reports</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('ADMIN_EXPENSES')}>
                  <Text style={styles.menuIcon}>💰</Text>
                  <Text style={styles.menuLabel}>Expense Logs</Text>
                </TouchableOpacity>
              </>
            )}

            {userRole === 'user' && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('AttendanceCalendar')}>
                  <Text style={styles.menuIcon}>📅</Text>
                  <Text style={styles.menuLabel}>My Attendance</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('ExpenseScreen')}>
                  <Text style={styles.menuIcon}>💸</Text>
                  <Text style={styles.menuLabel}>My Expenses</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sign Out Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* MAIN SCREEN AREA */}
      <View style={styles.main}>
        <View style={styles.topBar}>
          {!isOpen && (
            <TouchableOpacity onPress={toggleDrawer} style={styles.hamburger}>
               <View style={styles.line} />
               <View style={[styles.line, {width: 15}]} />
               <View style={styles.line} />
            </TouchableOpacity>
          )}
          <Text style={styles.topBarTitle}>FIELD OFFICER SYSTEM</Text>
          <View style={{width: 45}} />
        </View>

        {renderMainContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  overlay: { 
    position: 'absolute', 
    top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    zIndex: 90 
  },
  main: { flex: 1 },
  topBar: {
    height: Platform.OS === 'android' ? StatusBar.currentHeight + 60 : 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 40,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  topBarTitle: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  hamburger: { padding: 10 },
  line: { height: 2, width: 22, backgroundColor: '#00E676', marginVertical: 2.5, borderRadius: 2 },
  sidebar: { 
    position: 'absolute', 
    left: 0, top: 0, bottom: 0, 
    width: SIDEBAR_WIDTH, 
    backgroundColor: '#161616', 
    zIndex: 1000,
    elevation: 1000,
    borderRightWidth: 1,
    borderRightColor: '#282828'
  },
  sidebarInner: { flex: 1 },
  sidebarHeaderSection: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 40 : 60,
    paddingHorizontal: 25,
    paddingBottom: 30,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  closeBtn: { 
    position: 'absolute', 
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 30, 
    right: 20, 
    padding: 10 
  },
  closeText: { color: '#555', fontSize: 22, fontWeight: 'bold' },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#00E676', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', fontSize: 18, color: '#000' },
  profileTextCont: { marginLeft: 15 },
  sidebarTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  roleBadge: { backgroundColor: 'rgba(0, 230, 118, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  roleText: { color: '#00E676', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  menuContainer: { flex: 1, paddingTop: 30, paddingHorizontal: 15 },
  sectionLabel: { color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 15, marginLeft: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, borderRadius: 12, marginBottom: 5 },
  menuIcon: { fontSize: 18, marginRight: 15 },
  menuLabel: { color: '#BBB', fontSize: 15, fontWeight: '600' },
  footer: { padding: 25, borderTopWidth: 1, borderTopColor: '#282828' },
  logoutBtn: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  logoutText: { color: '#FF5252', fontWeight: 'bold', fontSize: 14 }
});