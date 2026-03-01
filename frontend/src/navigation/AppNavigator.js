import React, { useState, useRef } from 'react';
import { 
  View, Text, Animated, TouchableOpacity, StyleSheet, 
  Dimensions, StatusBar, Platform
} from 'react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.78;

export default function SimpleSidebar({ children, onLogout, onNavigate, userRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const toggleDrawer = (open) => {
    const toValue = open ? 0 : -DRAWER_WIDTH;
    Animated.spring(slideAnim, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsOpen(open);
  };

  const handleNavigation = (screen) => {
    toggleDrawer(false);
    onNavigate(screen);
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#121212" 
        translucent={false} 
      />

      {/* 1. Sidebar Content */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.innerSidebar}>
          
          {/* Header Section */}
          <View style={styles.headerSection}>
            <TouchableOpacity 
              style={styles.closeTouch} 
              onPress={() => toggleDrawer(false)}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userRole === 'admin' ? 'AD' : 'FO'}</Text>
                <View style={styles.statusDot} />
              </View>
              
              <View style={styles.textContainer}>
                <Text style={styles.userName}>
                  {userRole === 'admin' ? 'System Admin' : 'Field Officer'}
                </Text>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandText}>F.O.S MENU</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Navigation Menu */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>NAVIGATE</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('Dashboard')}>
              <Text style={styles.menuEmoji}>🏠</Text>
              <Text style={styles.menuLabel}>Home Dashboard</Text>
            </TouchableOpacity>

            {/* ADDED: Profile link for all roles */}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('PROFILE')}>
              <Text style={styles.menuEmoji}>👤</Text>
              <Text style={styles.menuLabel}>My Profile</Text>
            </TouchableOpacity>

            {userRole === 'user' && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('AttendanceCalendar')}>
                  <Text style={styles.menuEmoji}>📅</Text>
                  <Text style={styles.menuLabel}>Attendance Logs</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('ExpenseScreen')}>
                  <Text style={styles.menuEmoji}>💳</Text>
                  <Text style={styles.menuLabel}>Expense Claims</Text>
                </TouchableOpacity>
              </>
            )}

            {userRole === 'admin' && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('AdminExpenses')}>
                  <Text style={styles.menuEmoji}>📈</Text>
                  <Text style={styles.menuLabel}>Global Reports</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Sign Out Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* 2. Main App Screen */}
      <View style={styles.main}>
        <View style={styles.navBar}>
          {!isOpen && (
            <TouchableOpacity onPress={() => toggleDrawer(true)} style={styles.menuTrigger}>
              <View style={styles.bar} />
              <View style={[styles.bar, { width: 15 }]} />
              <View style={styles.bar} />
            </TouchableOpacity>
          )}
          <Text style={styles.navTitle}>FIELD OFFICER SYSTEM</Text>
          <View style={{ width: 45 }} />
        </View>

        {children}

        {/* Clickable Overlay */}
        {isOpen && (
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => toggleDrawer(false)} 
            style={styles.dimmer} 
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 40 : 0 
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#1A1A1A',
    zIndex: 1000,
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  innerSidebar: { flex: 1 },
  headerSection: {
    paddingTop: 40,
    paddingHorizontal: 25,
    paddingBottom: 30,
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeTouch: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
  },
  closeIcon: { color: '#555', fontSize: 20, fontWeight: 'bold' },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { 
    width: 55, 
    height: 55, 
    borderRadius: 15, 
    backgroundColor: '#00E676', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarText: { fontWeight: 'bold', fontSize: 18, color: '#000' },
  statusDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00E676',
    borderWidth: 3,
    borderColor: '#222'
  },
  textContainer: { marginLeft: 15 },
  userName: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 5,
  },
  brandText: { color: '#00E676', fontSize: 10, fontWeight: 'bold' },
  menuContainer: { flex: 1, padding: 20 },
  sectionTitle: { color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 20, marginLeft: 10 },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    paddingHorizontal: 15, 
    borderRadius: 12, 
    marginBottom: 5 
  },
  menuEmoji: { fontSize: 18, marginRight: 15 },
  menuLabel: { color: '#BBB', fontSize: 15, fontWeight: '600' },
  footer: { padding: 25, borderTopWidth: 1, borderTopColor: '#333' },
  logoutBtn: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  logoutText: { color: '#FF5252', fontWeight: 'bold' },
  main: { flex: 1 },
  navBar: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  navTitle: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  menuTrigger: { padding: 10 },
  bar: { height: 2, width: 22, backgroundColor: '#00E676', marginVertical: 2.5, borderRadius: 2 },
  dimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 500 }
});