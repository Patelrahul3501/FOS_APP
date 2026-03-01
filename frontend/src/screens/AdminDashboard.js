import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, Dimensions, Linking, TouchableOpacity, Alert 
} from 'react-native';
import MapView, { Marker } from 'react-native-maps'; 
import { api } from '../api/client';

const { width } = Dimensions.get('window');

const RemainingTimer = ({ checkInTime, status }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (status !== 'In Progress') return;

    const interval = setInterval(() => {
      const startTime = new Date(checkInTime).getTime();
      const currentTime = new Date().getTime();
      const targetMs = 8.5 * 60 * 60 * 1000;
      const diff = (startTime + targetMs) - currentTime;
      if (diff <= 0) {
        setTimeLeft("Shift Completed ✅");
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeft(`${h}h ${m}m left`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [checkInTime, status]);
  return <Text style={styles.timerText}>{timeLeft}</Text>;
};

export default function AdminDashboard() {
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, present: 0 });
  const [activeUsers, setActiveUsers] = useState([]); 
  const [absentUsers, setAbsentUsers] = useState([]); 
  const [region, setRegion] = useState({
    latitude: 23.0225, 
    longitude: 72.5714, 
    latitudeDelta: 0.05, 
    longitudeDelta: 0.05 
  });

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const summaryRes = await api.get('/admin/summary');
      const locs = summaryRes.data.activeLocations;
      const validLocs = locs.filter(u => u.lat != null && u.lng != null);
      setStats(summaryRes.data.stats);
      setActiveUsers(validLocs);

      if (validLocs.length > 0) {
        const firstUser = validLocs[0];
        const newRegion = {
          latitude: parseFloat(firstUser.lat),
          longitude: parseFloat(firstUser.lng),
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        };
        setRegion(newRegion);
        setTimeout(() => { mapRef.current?.animateToRegion(newRegion, 1000); }, 500);
      }

      const userRes = await api.get('/admin/users');
      const presentIds = locs.map(u => u._id);
      setAbsentUsers(userRes.data.filter(u => !presentIds.includes(u._id)));
    } catch (e) { 
      console.log("Dashboard fetch error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  /**
   * RESTORED: focusOnUser function
   */
  const focusOnUser = (lat, lng) => {
    if (mapRef.current && lat && lng) {
      mapRef.current.animateToRegion({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }, 1000);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "--:--";
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCall = (phone) => phone ? Linking.openURL(`tel:${phone}`) : Alert.alert("Error", "No number");

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#00E676" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.header}>Admin Control Panel</Text>

        <View style={styles.statsRow}>
          <View style={styles.badge}><Text style={styles.badgeNum}>{stats.total}</Text><Text style={styles.badgeLabel}>Total</Text></View>
          <View style={[styles.badge, {borderColor: '#00E676'}]}><Text style={[styles.badgeNum, {color: '#00E676'}]}>{stats.present}</Text><Text style={styles.badgeLabel}>Present</Text></View>
          <View style={[styles.badge, {borderColor: '#FF5252'}]}><Text style={[styles.badgeNum, {color: '#FF5252'}]}>{stats.total - stats.present}</Text><Text style={styles.badgeLabel}>Absent</Text></View>
        </View>

        <View style={styles.mapCard}>
          <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} region={region}>
            {activeUsers.map(user => (
              <Marker key={user._id} coordinate={{ latitude: parseFloat(user.lat), longitude: parseFloat(user.lng) }} title={user.name} pinColor="#00E676" />
            ))}
          </MapView>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>✅ Active Officers</Text>
          {activeUsers.length > 0 ? activeUsers.map(user => (
            <TouchableOpacity key={user._id} style={styles.presentCard} onPress={() => focusOnUser(user.lat, user.lng)}>
              <View style={styles.cardTop}>
                <Image source={{ uri: user.selfie?.startsWith('data') ? user.selfie : `data:image/jpeg;base64,${user.selfie}` }} style={styles.avatar} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: user.status === 'In Progress' ? '#2196F3' : '#00E676' }]}>
                    <Text style={styles.statusText}>{user.status}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.callBtnSmall} onPress={() => handleCall(user.phone)}>
                  <Text style={styles.callText}>📞 Call</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECK IN</Text>
                  <Text style={styles.timeVal}>{formatTime(user.checkInTime)}</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECK OUT</Text>
                  <Text style={styles.timeVal}>{formatTime(user.checkOutTime)}</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>{user.status === 'In Progress' ? 'REMAINING' : 'WORK HOURS'}</Text>
                  {user.status === 'In Progress' ? (
                    <RemainingTimer checkInTime={user.checkInTime} status={user.status} />
                  ) : (
                    <Text style={[styles.timeVal, {color: '#00E676'}]}>{user.workHours || '0.00'}h</Text>
                  )}
                </View>
              </View>

              <View style={styles.expenseContainer}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={{fontSize: 14, marginRight: 5}}>💰</Text>
                    <Text style={styles.expenseLabel}>TODAY'S EXPENSE</Text>
                </View>
                <Text style={styles.expenseVal}>₹{user.todayExpense || 0}</Text>
              </View>
            </TouchableOpacity>
          )) : <Text style={styles.emptyText}>No officers currently on duty.</Text>}
        </View>

        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, {color: '#FF5252'}]}>❌ Absent Officers</Text>
          {absentUsers.map(user => (
            <View key={user._id} style={styles.userCardMini}>
              <View style={[styles.dot, {backgroundColor: '#FF5252'}]} />
              <Text style={styles.userName}>{user.name}</Text>
              <TouchableOpacity style={[styles.callBtnSmall, {backgroundColor: '#333'}]} onPress={() => handleCall(user.phone)}>
                <Text style={[styles.callText, {color: '#FF5252'}]}>📞 Call</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loader: { flex: 1, backgroundColor: '#121212', justifyContent: 'center' },
  header: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 20 },
  badge: { width: width * 0.28, padding: 15, backgroundColor: '#1E1E1E', borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  badgeNum: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  badgeLabel: { color: '#888', fontSize: 10, marginTop: 4 },
  mapCard: { width: '92%', height: 200, alignSelf: 'center', borderRadius: 20, overflow: 'hidden', marginBottom: 25, backgroundColor: '#222' },
  listSection: { paddingHorizontal: 15, marginBottom: 20 },
  sectionTitle: { color: '#00E676', fontSize: 13, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  presentCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#333' },
  userInfo: { flex: 1 },
  userName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginTop: 4 },
  statusText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  callBtnSmall: { backgroundColor: '#00E676', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  callText: { color: '#000', fontWeight: 'bold', fontSize: 11 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBlock: { flex: 1, alignItems: 'center' },
  timeLabel: { color: '#666', fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  timeVal: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  timerText: { color: '#FFD700', fontSize: 13, fontWeight: 'bold' },
  expenseContainer: { marginTop: 15, padding: 10, backgroundColor: 'rgba(0, 230, 118, 0.05)', borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(0, 230, 118, 0.2)' },
  expenseLabel: { color: '#888', fontSize: 10, fontWeight: 'bold' },
  expenseVal: { color: '#00E676', fontSize: 16, fontWeight: 'bold' },
  userCardMini: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 12, borderRadius: 15, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 15 },
  emptyText: { color: '#444', fontStyle: 'italic', marginLeft: 5 }
});