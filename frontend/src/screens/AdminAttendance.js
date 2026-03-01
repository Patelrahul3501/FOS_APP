import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Image, Alert, Modal 
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { api } from '../api/client';

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

  useEffect(() => { fetchInitialData(); }, []);

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

  // Update Status Function
  const updateStatus = async (newStatus) => {
    try {
      setLoading(true);
      // Ensure this endpoint exists on your backend
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendance Records</Text>

      <View style={styles.filterCard}>
        <Text style={styles.label}>Officer Filter</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setUserModalVisible(true)}>
          <Text style={styles.dropdownText}>{selectedUser.name}</Text>
          <Text style={styles.dropdownText}>▼</Text>
        </TouchableOpacity>

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
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.filterBtnText}>APPLY FILTERS</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={logs}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View style={styles.logCard}>
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
                   <Text style={{ color: '#FF5252', fontSize: 10 }}>DELETE</Text>
                </TouchableOpacity>
            </View>

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
                  style={[styles.statusBadge, { backgroundColor: item.status === 'Half Day' ? '#FBC02D' : item.status === 'Absent' ? '#FF5252' : '#00E676' }]}
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

      {/* --- ALL MODALS AT THE END FOR ANDROID STABILITY --- */}

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
      <Modal visible={statusModalVisible} transparent={true} animationType="fade" onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Status</Text>
            
            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Present')}>
              <Text style={[styles.statusOptionText, {color: '#00E676'}]}>Present</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Half Day')}>
              <Text style={[styles.statusOptionText, {color: '#FBC02D'}]}>Half Day</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statusOption} onPress={() => updateStatus('Absent')}>
              <Text style={[styles.statusOptionText, {color: '#FF5252'}]}>Absent</Text>
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
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 15, paddingTop: 20 },
  header: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  filterCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  label: { color: '#00E676', fontSize: 12, marginBottom: 5, fontWeight: 'bold' },
  dropdown: { backgroundColor: '#333', padding: 12, borderRadius: 8, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between' },
  dropdownText: { color: '#fff' },
  row: { flexDirection: 'row', marginBottom: 15 },
  dateBtn: { backgroundColor: '#333', padding: 12, borderRadius: 8, alignItems: 'center' },
  dateBtnText: { color: '#fff' },
  filterBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 10, alignItems: 'center' },
  filterBtnText: { color: '#000', fontWeight: 'bold' },
  logCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#333' },
  logName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logDate: { color: '#888', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeBlock: { flex: 1, alignItems: 'center', paddingVertical: 5 },
  timeLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  timeVal: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  footerRow: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  miniDelete: { padding: 5, borderWidth: 1, borderColor: '#FF5252', borderRadius: 4 },
  
  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#1E1E1E', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#00E676', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  userOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  userOptionText: { color: '#fff', fontSize: 16 },
  statusOption: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#333', alignItems: 'center' },
  statusOptionText: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { marginTop: 15, alignItems: 'center' },
  closeBtnText: { color: '#FF5252', fontWeight: 'bold' }
});