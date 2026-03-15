import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Image, Alert, Modal 
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { api } from '../api/client';
import SkeletonLoader from '../components/SkeletonLoader';

export default function AdminAttendance() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState({ id: '', name: 'All Users' });
  const [userModalVisible, setUserModalVisible] = useState(false);

  // Status Editing State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [activeLogId, setActiveLogId] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [isStartPickerVisible, setStartPickerVisibility] = useState(false);
  const [isEndPickerVisible, setEndPickerVisibility] = useState(false);

  useEffect(() => { 
    fetchInitialData(); 
  }, []);

  useEffect(() => {
    // Auto-fetch when date or user changes
    if (!loading && users.length > 0) {
      applyFilters();
    }
  }, [startDate, endDate, selectedUser]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await api.get('/admin/users');
      setUsers(userRes.data);
      const logRes = await api.get(`/admin/attendance-logs?start=${todayStr}&end=${todayStr}`);
      setLogs(logRes.data);
    } catch (e) { console.log("Fetch Error:", e); } finally { setLoading(false); }
  };

  const applyFilters = async () => {
    setLoading(true);
    try {
      const query = `/admin/attendance-logs?userId=${selectedUser.id}&start=${startDate}&end=${endDate}`;
      const res = await api.get(query);
      setLogs(res.data);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Record", "Are you sure you want to remove this log permanently?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/admin/attendance/${id}`);
            Alert.alert("Success", "Record removed.");
            applyFilters();
          } catch (e) { Alert.alert("Error", "Failed to delete record."); }
      }}
    ]);
  };

  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      await api.put(`/admin/attendance-status/${activeLogId}`, { status: newStatus });
      setStatusModalVisible(false);
      Alert.alert("Success", `Status updated to ${newStatus}`);
      applyFilters(); 
    } catch (e) {
      Alert.alert("Error", "Could not update status");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "--:--";
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to determine status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Terminated': return '#FF5252'; // Red for violations
      case 'Half Day': return '#FBC02D';   // Yellow
      case 'Absent': return '#FF8A65';     // Orange
      case 'In Progress': return '#2196F3'; // Blue
      default: return '#00E676';           // Green for Present
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendance Records</Text>

      <View style={styles.filterCard}>
        <Text style={styles.label}>Officer Filter</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setUserModalVisible(true)}>
          <Text style={styles.dropdownText}>{selectedUser.name}</Text>
          <Text style={styles.dropdownText}>▼</Text>
        </TouchableOpacity>

        {/* Date Range Filters */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>From</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setStartPickerVisibility(true)}>
              <Text style={styles.dateBtnText}>{startDate}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setEndPickerVisibility(true)}>
              <Text style={styles.dateBtnText}>{endDate}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.filterBtn} onPress={applyFilters}>
          {loading ? <ActivityIndicator color="#042F2E" /> : <Text style={styles.filterBtnText}>APPLY FILTERS</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonLoader type="list" />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item._id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={<Text style={{color: '#71717A', textAlign: 'center', marginTop: 20, fontStyle: 'italic'}}>No records found for this range.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.logCard, item.status === 'Terminated' && styles.terminatedCard]}>
              <View style={styles.cardHeader}>
                  <Image 
                    source={{ 
                      uri: item.selfie 
                          ? (item.selfie.startsWith('data:image') ? item.selfie : `data:image/jpeg;base64,${item.selfie}`)
                          : 'https://via.placeholder.com/150' 
                    }} 
                    style={styles.thumbnail} 
                  />
                  <View style={{ flex: 1 }}>
                      <Text style={styles.logName}>{item.userId?.name || 'Unknown'}</Text>
                      <Text style={styles.logDate}>📅 {item.date}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.miniDelete}>
                      <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '800' }}>DELETE</Text>
                  </TouchableOpacity>
              </View>

            {item.status === 'Terminated' && (
               <View style={styles.violationBadge}>
                  <Text style={styles.violationText}>⚠️ ONGOING TERMINATION: Location Disabled</Text>
               </View>
            )}

            {/* NEW: Termination History Tracker */}
            {item.terminations && item.terminations.length > 0 && (
               <View style={styles.historyBox}>
                  <Text style={styles.historyTitle}>
                    {item.terminations.length} Session Disconnect{item.terminations.length > 1 ? 's' : ''} Today
                  </Text>
                  {item.terminations.map((term, index) => (
                    <Text key={index} style={styles.historyItem}>
                      • {formatTime(term.time)} - {term.reason}
                    </Text>
                  ))}
               </View>
            )}

            <View style={styles.divider} />

            <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>CHECK IN</Text>
                    <Text style={styles.timeVal}>{formatTime(item.checkInTime)}</Text>
                </View>
                <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>CHECK OUT</Text>
                    <Text style={styles.timeVal}>{formatTime(item.checkOutTime)}</Text>
                </View>
                <View style={[styles.timeBlock, { backgroundColor: 'rgba(255, 215, 0, 0.1)', borderRadius: 8 }]}>
                    <Text style={[styles.timeLabel, { color: '#FFD700' }]}>TOTAL HOURS</Text>
                    <Text style={[styles.timeVal, { color: '#FFD700' }]}>{item.workHours || '0.00'}h</Text>
                </View>
            </View>

            <View style={styles.footerRow}>
                <TouchableOpacity 
                  style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
                  onPress={() => { 
                    setActiveLogId(item._id); 
                    setStatusModalVisible(true); 
                  }}
                >
                    <Text style={styles.statusText}>{item.status || 'Present'} ✎</Text>
                </TouchableOpacity>
                <Text style={{color: '#555', fontSize: 10}}>Tap status to edit</Text>
            </View>
          </View>
        )}
      />
      )}

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
            <FlatList 
              data={users} 
              keyExtractor={item => item._id} 
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userOption} onPress={() => { setSelectedUser({ id: item._id, name: item.name }); setUserModalVisible(false); }}>
                  <Text style={styles.userOptionText}>{item.name}</Text>
                </TouchableOpacity>
            )} />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setUserModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Edit Modal */}
      <Modal visible={statusModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Status</Text>
            
            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Present')}>
              <Text style={[styles.statusOptionText, {color: '#00E676'}]}>Present</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Half Day')}>
              <Text style={[styles.statusOptionText, {color: '#FBC02D'}]}>Half Day</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Terminated')}>
              <Text style={[styles.statusOptionText, {color: '#FF5252'}]}>Terminated (Violation)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Absent')}>
              <Text style={[styles.statusOptionText, {color: '#FF8A65'}]}>Absent</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setStatusModalVisible(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <DateTimePickerModal isVisible={isStartPickerVisible} mode="date" onConfirm={(d) => { setStartDate(d.toISOString().split('T')[0]); setStartPickerVisibility(false); }} onCancel={() => setStartPickerVisibility(false)} />
      <DateTimePickerModal isVisible={isEndPickerVisible} mode="date" onConfirm={(d) => { setEndDate(d.toISOString().split('T')[0]); setEndPickerVisibility(false); }} onCancel={() => setEndPickerVisibility(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 15, paddingTop: 20 },
  header: { color: '#ffffff', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 20, letterSpacing: 0.5 },
  filterCard: { 
    backgroundColor: '#18181B', padding: 20, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#27272A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 
  },
  label: { color: '#10B981', fontSize: 12, marginBottom: 6, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  dropdown: { backgroundColor: '#27272A', padding: 15, borderRadius: 14, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#3F3F46' },
  dropdownText: { color: '#F4F4F5', fontWeight: '800' },
  row: { flexDirection: 'row', marginBottom: 15 },
  dateBtn: { backgroundColor: '#27272A', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  dateBtnText: { color: '#F4F4F5', fontWeight: '700' },
  filterBtn: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  filterBtnText: { color: '#064E3B', fontWeight: '900', letterSpacing: 1 },
  logCard: { backgroundColor: '#18181B', padding: 18, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#27272A' },
  terminatedCard: { borderColor: '#EF4444', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: { width: 56, height: 56, borderRadius: 28, marginRight: 15, backgroundColor: '#27272A', borderWidth: 2, borderColor: '#10B981' },
  logName: { color: '#ffffff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
  logDate: { color: '#A1A1AA', fontSize: 12, marginTop: 4, fontWeight: '700' },
  violationBadge: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginTop: 15, borderWidth: 1, borderColor: '#EF4444' },
  violationText: { color: '#EF4444', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  historyBox: { backgroundColor: 'rgba(255, 138, 101, 0.1)', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255, 138, 101, 0.3)' },
  historyTitle: { color: '#FF8A65', fontSize: 12, fontWeight: '900', marginBottom: 5, letterSpacing: 0.5 },
  historyItem: { color: '#D4D4D8', fontSize: 11, fontStyle: 'italic', marginBottom: 3 },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 15 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeBlock: { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: '#27272A', borderRadius: 12, marginHorizontal: 4 },
  timeLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  timeVal: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  footerRow: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  statusText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  miniDelete: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#18181B', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#27272A' },
  modalTitle: { color: '#10B981', fontSize: 22, fontWeight: '900', marginBottom: 25, textAlign: 'center', letterSpacing: 0.5 },
  userOption: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  userOptionText: { color: '#F4F4F5', fontSize: 17, fontWeight: '700' },
  statusOption: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#27272A', alignItems: 'center' },
  statusOptionText: { fontSize: 18, fontWeight: '900' },
  closeBtn: { marginTop: 25, alignItems: 'center', backgroundColor: '#EF4444', padding: 15, borderRadius: 12 },
  closeBtnText: { color: '#ffffff', fontWeight: '900', letterSpacing: 1 }
});