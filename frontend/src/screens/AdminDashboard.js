import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, Dimensions, Linking, TouchableOpacity, Alert, Modal
} from 'react-native';
import MapView, { Marker } from 'react-native-maps'; 
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { api } from '../api/client';
import SkeletonLoader from '../components/SkeletonLoader';

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
  const [isRefreshing, setIsRefreshing] = useState(false); 
  const [stats, setStats] = useState({ total: 0, present: 0, terminated: 0 });
  const [activeUsers, setActiveUsers] = useState([]); 
  const [absentUsers, setAbsentUsers] = useState([]); 
  const [region, setRegion] = useState({
    latitude: 23.0225, 
    longitude: 72.5714, 
    latitudeDelta: 0.05, 
    longitudeDelta: 0.05 
  });
  
  // NEW LOGS STATE
  const [activeTab, setActiveTab] = useState('live'); 
  const [systemLogs, setSystemLogs] = useState([]);
  const [logUsers, setLogUsers] = useState([]); // For the filter dropdown
  
  // LOG FILTERS
  const todayStr = new Date().toISOString().split('T')[0];
  const [logStartDate, setLogStartDate] = useState(todayStr);
  const [logEndDate, setLogEndDate] = useState(todayStr);
  const [selectedUser, setSelectedUser] = useState({ id: '', name: 'All Users' });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [isStartPickerVisible, setStartPickerVisibility] = useState(false);
  const [isEndPickerVisible, setEndPickerVisibility] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // --- LIVE POLLING MECHANISM ---
  useEffect(() => {
    fetchDashboardData(true); 
    const pollInterval = setInterval(() => {
      fetchDashboardData(false);
    }, 15000); 
    return () => clearInterval(pollInterval);
  }, []);

  const fetchDashboardData = async (isInitial = false) => {
    if (!isInitial) setIsRefreshing(true);
    try {
      const summaryRes = await api.get('/admin/summary');
      
      // FIX 1: Ensure we use a fresh array reference so React triggers a re-render
      const locs = [...summaryRes.data.activeLocations];
      const validLocs = locs.filter(u => u.lat != null && u.lng != null);
      
      const termCount = locs.filter(u => u.status === 'Terminated').length;
      
      setStats({
        ...summaryRes.data.stats,
        terminated: termCount 
      });
      
      setActiveUsers(locs);

      if (isInitial && validLocs.length > 0) {
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
      setLogUsers(userRes.data); // Store for the filter
      const presentIds = locs.map(u => u._id);
      setAbsentUsers(userRes.data.filter(u => !presentIds.includes(u._id)));
      
      // Fetch System Logs initially (defaults to today)
      if (isInitial || activeTab === 'logs') {
          fetchLogs();
      }
      
    } catch (e) { 
      console.log("Polling error:", e); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const query = `/admin/system-logs?userId=${selectedUser.id}&start=${logStartDate}&end=${logEndDate}`;
      const logsRes = await api.get(query);
      setSystemLogs(logsRes.data);
    } catch (e) {
      console.log("Logs fetch error:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

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

  // FIX 2: Enhanced date formatting logic to avoid "Syncing..." hang
  const formatTime = (timeStr) => {
    if (!timeStr) return "--:--";
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  const formatDate = (timeStr) => {
      if (!timeStr) return "";
      const date = new Date(timeStr);
      return date.toLocaleDateString();
  };

  const handleCall = (phone) => phone ? Linking.openURL(`tel:${phone}`) : Alert.alert("Error", "No number");

  const deleteLog = async (id) => {
    Alert.alert("Delete Log", "Are you sure you want to permanently delete this system log?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            await api.delete(`/admin/system-logs/${id}`);
            setSystemLogs(prev => prev.filter(log => log._id !== id));
          } catch (e) {
            Alert.alert("Error", "Failed to delete log.");
          }
        } 
      }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { padding: 20 }]}>
        <SkeletonLoader style={{ width: 180, height: 30, alignSelf: 'center', marginTop: 40, marginBottom: 30 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 }}>
          <SkeletonLoader style={{ width: width * 0.28, height: 80, borderRadius: 20 }} />
          <SkeletonLoader style={{ width: width * 0.28, height: 80, borderRadius: 20 }} />
          <SkeletonLoader style={{ width: width * 0.28, height: 80, borderRadius: 20 }} />
        </View>
        <SkeletonLoader style={{ width: '100%', height: 220, borderRadius: 24, marginBottom: 25 }} />
        <SkeletonLoader type="list" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.headerRow}>
            <Text style={styles.header}>Officer Dashboard</Text>
            {isRefreshing && <ActivityIndicator size="small" color="#00E676" />}
        </View>

        {/* TABS */}
        <View style={styles.tabContainer}>
            <TouchableOpacity 
               style={[styles.tabBtn, activeTab === 'live' && styles.tabBtnActive]}
               onPress={() => setActiveTab('live')}
            >
                <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>Live Monitor</Text>
            </TouchableOpacity>
            <TouchableOpacity 
               style={[styles.tabBtn, activeTab === 'logs' && styles.tabBtnActive]}
               onPress={() => setActiveTab('logs')}
            >
                <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>System Logs</Text>
            </TouchableOpacity>
        </View>

        {activeTab === 'live' ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.badge}><Text style={styles.badgeNum}>{stats.total}</Text><Text style={styles.badgeLabel}>Total</Text></View>
              <View style={[styles.badge, {borderColor: '#00E676'}]}><Text style={[styles.badgeNum, {color: '#00E676'}]}>{stats.present}</Text><Text style={styles.badgeLabel}>Present</Text></View>
              <View style={[styles.badge, {borderColor: '#FF5252'}]}><Text style={[styles.badgeNum, {color: '#FF5252'}]}>{stats.terminated}</Text><Text style={styles.badgeLabel}>Violations</Text></View>
            </View>

            <View style={styles.mapCard}>
              <MapView 
                ref={mapRef} 
                style={StyleSheet.absoluteFillObject} 
                initialRegion={region}
                showsCompass={true}
              >
                {activeUsers.filter(u => u.lat).map(user => (
                  <Marker 
                    key={`${user._id}-${user.updatedAt || user.checkInTime}`} 
                    coordinate={{ latitude: parseFloat(user.lat), longitude: parseFloat(user.lng) }} 
                    title={user.name}
                    description={`Last Seen: ${formatTime(user.updatedAt || user.checkInTime)}`}
                    pinColor={user.status === 'Terminated' ? "#FF5252" : "#00E676"} 
                  />
                ))}
              </MapView>
            </View>

            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>✅ Live Attendance List</Text>
              {activeUsers.length > 0 ? activeUsers.map(user => {
                const isTerminated = user.status === 'Terminated';
                const liveTime = user.updatedAt || user.checkInTime;
                
                return (
                  <TouchableOpacity 
                    key={user._id} 
                    style={[styles.presentCard, isTerminated && styles.terminatedCard]} 
                    onPress={() => user.lat && focusOnUser(user.lat, user.lng)}
                  >
                    <View style={styles.cardTop}>
                      <Image 
                        source={{ uri: user.selfie?.startsWith('data') ? user.selfie : `data:image/jpeg;base64,${user.selfie}` }} 
                        style={[styles.avatar, isTerminated && {borderColor: '#FF5252', borderWidth: 1}]} 
                      />
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <View style={[
                          styles.statusBadge, 
                          { backgroundColor: isTerminated ? '#EF4444' : user.status === 'In Progress' ? '#3B82F6' : '#10B981' }
                        ]}>
                          <Text style={styles.statusText}>{isTerminated ? 'TERMINATED' : user.status}</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.callBtnSmall} onPress={() => handleCall(user.phone)}>
                        <Text style={styles.callText}>📞 Call</Text>
                      </TouchableOpacity>
                    </View>

                    {isTerminated && (
                      <View style={styles.violationWarning}>
                        <Text style={styles.violationText}>⚠️ Security Termination: Location Lost</Text>
                      </View>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.timeRow}>
                      <View style={styles.timeBlock}>
                        <Text style={styles.timeLabel}>CHECK IN</Text>
                        <Text style={styles.timeVal}>{formatTime(user.checkInTime).split(' ')[0]}</Text>
                      </View>
                      <View style={styles.timeBlock}>
                        <Text style={styles.timeLabel}>LAST SYNC (LIVE)</Text>
                        <Text style={[styles.timeVal, {color: '#00E676'}]}>{formatTime(liveTime)}</Text>
                      </View>
                      <View style={styles.timeBlock}>
                        <Text style={styles.timeLabel}>{user.status === 'In Progress' ? 'REMAINING' : 'WORK HOURS'}</Text>
                        {user.status === 'In Progress' ? (
                          <RemainingTimer checkInTime={user.checkInTime} status={user.status} />
                        ) : (
                          <Text style={[styles.timeVal, {color: isTerminated ? '#FF5252' : '#00E676'}]}>{user.workHours || '0.00'}h</Text>
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
                );
              }) : <Text style={styles.emptyText}>No officers currently on duty.</Text>}
            </View>

            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, {color: '#EF4444'}]}>❌ Absent Officers</Text>
              {absentUsers.map(user => (
                <View key={user._id} style={styles.userCardMini}>
                  <View style={[styles.dot, {backgroundColor: '#EF4444'}]} />
                  <Text style={[styles.userName, { flex: 1, marginRight: 10 }]} numberOfLines={1}>{user.name}</Text>
                  <TouchableOpacity style={[styles.callBtnSmall, {backgroundColor: '#27272A'}]} onPress={() => handleCall(user.phone)}>
                    <Text style={[styles.callText, {color: '#EF4444'}]}>📞 Call</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.listSection}>
             <View style={styles.filterCard}>
               <Text style={styles.filterTitle}>Log Filters</Text>
               <TouchableOpacity style={styles.dropdown} onPress={() => setUserModalVisible(true)}>
                 <Text style={styles.dropdownText}>{selectedUser.name}</Text>
                 <Text style={styles.dropdownText}>▼</Text>
               </TouchableOpacity>

               <View style={styles.row}>
                 <View style={{ flex: 1, marginRight: 10 }}>
                   <Text style={styles.filterTitle}>From</Text>
                   <TouchableOpacity style={styles.dateBtn} onPress={() => setStartPickerVisibility(true)}>
                     <Text style={styles.dateBtnText}>{logStartDate}</Text>
                   </TouchableOpacity>
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={styles.filterTitle}>To</Text>
                   <TouchableOpacity style={styles.dateBtn} onPress={() => setEndPickerVisibility(true)}>
                     <Text style={styles.dateBtnText}>{logEndDate}</Text>
                   </TouchableOpacity>
                 </View>
               </View>

               <TouchableOpacity style={styles.filterBtn} onPress={fetchLogs}>
                 {loadingLogs ? <ActivityIndicator color="#042F2E" /> : <Text style={styles.filterBtnText}>APPLY FILTERS</Text>}
               </TouchableOpacity>
             </View>

             <Text style={[styles.sectionTitle, {color: '#00E676'}]}>📜 System Logs Feed</Text>
             {loadingLogs ? (
               <SkeletonLoader type="list" />
             ) : (
               systemLogs.length > 0 ? systemLogs.map(log => (
               <View key={log._id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                      <Text style={styles.logAction}>{log.action}</Text>
                      <TouchableOpacity onPress={() => deleteLog(log._id)} style={styles.deleteBadge}>
                          <Text style={{color: '#FF5252', fontSize: 10, fontWeight: 'bold'}}>🗑️ DELETE</Text>
                      </TouchableOpacity>
                  </View>
                  <Text style={styles.logUser}>User: <Text style={{color: '#fff'}}>{log.user?.name || 'Unknown'}</Text></Text>
                  <Text style={styles.logDetails}>{log.details}</Text>
                  <Text style={[styles.logTime, { marginTop: 8, alignSelf: 'flex-end' }]}>{formatDate(log.createdAt)} {formatTime(log.createdAt)}</Text>
               </View>
             )) : <Text style={styles.emptyText}>No logs found.</Text>
             )}
          </View>
        )}
      </ScrollView>

      {/* Officer Selection Modal */}
      <Modal visible={userModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Officer</Text>
            <TouchableOpacity 
               style={styles.userOption} 
               onPress={() => { setSelectedUser({ id: '', name: 'All Users' }); setUserModalVisible(false); }}>
              <Text style={styles.userOptionText}>All Users</Text>
            </TouchableOpacity>
            {logUsers.map((item) => (
                <TouchableOpacity key={item._id} style={styles.userOption} onPress={() => { setSelectedUser({ id: item._id, name: item.name }); setUserModalVisible(false); }}>
                  <Text style={styles.userOptionText}>{item.name}</Text>
                </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setUserModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal isVisible={isStartPickerVisible} mode="date" onConfirm={(d) => { setLogStartDate(d.toISOString().split('T')[0]); setStartPickerVisibility(false); }} onCancel={() => setStartPickerVisibility(false)} />
      <DateTimePickerModal isVisible={isEndPickerVisible} mode="date" onConfirm={(d) => { setLogEndDate(d.toISOString().split('T')[0]); setEndPickerVisibility(false); }} onCancel={() => setEndPickerVisibility(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  loader: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25, marginBottom: 25 },
  header: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginRight: 10, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 25 },
  badge: { 
    width: width * 0.28, padding: 18, backgroundColor: '#18181B', borderRadius: 20, alignItems: 'center', 
    borderWidth: 1, borderColor: '#27272A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6
  },
  badgeNum: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  badgeLabel: { color: '#A1A1AA', fontSize: 11, marginTop: 6, fontWeight: '700', textTransform: 'uppercase' },
  mapCard: { 
    width: '92%', height: 220, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', marginBottom: 25, backgroundColor: '#18181B',
    borderWidth: 1, borderColor: '#27272A', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8
  },
  listSection: { paddingHorizontal: 16, marginBottom: 25 },
  sectionTitle: { color: '#10B981', fontSize: 13, fontWeight: '800', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  // Filter Styles
  filterCard: { backgroundColor: '#18181B', padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: '#27272A' },
  filterTitle: { color: '#10B981', fontSize: 12, marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dropdown: { backgroundColor: '#27272A', padding: 15, borderRadius: 12, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { color: '#F4F4F5', fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: 18 },
  dateBtn: { backgroundColor: '#27272A', padding: 15, borderRadius: 12, alignItems: 'center' },
  dateBtnText: { color: '#F4F4F5', fontWeight: '600' },
  filterBtn: { 
    backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
  },
  filterBtnText: { color: '#064E3B', fontWeight: '900', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#18181B', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#27272A' },
  modalTitle: { color: '#10B981', fontSize: 22, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  userOption: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  userOptionText: { color: '#F4F4F5', fontSize: 16, fontWeight: '600' },
  closeBtn: { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 16 },

  presentCard: { backgroundColor: '#18181B', padding: 18, borderRadius: 20, marginBottom: 18, borderWidth: 1, borderColor: '#27272A' },
  terminatedCard: { borderColor: '#EF4444', borderLeftWidth: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 15, backgroundColor: '#27272A', borderWidth: 2, borderColor: '#3F3F46' },
  userInfo: { flex: 1 },
  userName: { color: '#ffffff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 6 },
  statusText: { color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  violationWarning: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  violationText: { color: '#EF4444', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  callBtnSmall: { backgroundColor: '#10B981', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  callText: { color: '#064E3B', fontWeight: '900', fontSize: 11 },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 16 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBlock: { flex: 1, alignItems: 'center' },
  timeLabel: { color: '#71717A', fontSize: 10, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  timeVal: { color: '#F4F4F5', fontSize: 14, fontWeight: '800' },
  timerText: { color: '#FBBF24', fontSize: 14, fontWeight: '800' },
  expenseContainer: { marginTop: 18, padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  expenseLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  expenseVal: { color: '#10B981', fontSize: 18, fontWeight: '900' },
  userCardMini: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 15 },
  emptyText: { color: '#71717A', fontStyle: 'italic', marginLeft: 5, paddingVertical: 10 },
  tabContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 25, backgroundColor: '#18181B', marginHorizontal: 16, borderRadius: 14, padding: 6, borderWidth: 1, borderColor: '#27272A' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#27272A', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  tabText: { color: '#71717A', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#10B981' },
  logCard: { backgroundColor: '#18181B', padding: 18, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#27272A' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  logAction: { color: '#10B981', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  deleteBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  logTime: { color: '#71717A', fontSize: 11, fontWeight: '600' },
  logUser: { color: '#A1A1AA', fontSize: 13, marginBottom: 6, fontWeight: '500' },
  logDetails: { color: '#E4E4E7', fontSize: 14, lineHeight: 20 }
});