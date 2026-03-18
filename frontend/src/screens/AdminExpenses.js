import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  Modal, ActivityIndicator, Alert, TextInput 
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { api } from '../api/client';

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState({ id: '', name: 'All Officers' });
  const [userModalVisible, setUserModalVisible] = useState(false);
  
  // Edit State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState({ id: '', title: '', amount: '' });

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
      await fetchFilteredExpenses();
    } catch (e) { 
      console.log("Initial Fetch Error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchFilteredExpenses = async () => {
    setLoading(true);
    try {
      const query = `/admin/expense-logs?userId=${selectedUser.id}&start=${startDate}&end=${endDate}`;
      const res = await api.get(query);
      setExpenses(res.data);
    } catch (e) { 
      console.log("Expense Fetch Error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "--:--";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Expense", "Permanently remove this expense record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/admin/expenses/${id}`);
          fetchFilteredExpenses();
        } catch (e) { Alert.alert("Error", "Delete failed."); }
      }}
    ]);
  };

  const handleUpdate = async () => {
    if (!editingItem.title || !editingItem.amount) return Alert.alert("Error", "Fill all fields");
    try {
      setLoading(true);
      await api.put(`/admin/expenses/${editingItem.id}`, {
        title: editingItem.title,
        amount: editingItem.amount
      });
      setEditModalVisible(false);
      fetchFilteredExpenses();
    } catch (e) { 
      Alert.alert("Error", "Update failed."); 
    } finally { 
      setLoading(false); 
    }
  };

  const totalAmount = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Expense Logs</Text>
      
      <View style={styles.filterCard}>
        <Text style={styles.label}>SELECT OFFICER</Text>
        <TouchableOpacity style={styles.dropdown} activeOpacity={0.8} onPress={() => setUserModalVisible(true)}>
          <Text style={styles.dropdownText}>{selectedUser.name}</Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>START DATE</Text>
            <TouchableOpacity style={styles.dateBtn} activeOpacity={0.8} onPress={() => setStartPickerVisibility(true)}>
              <Text style={styles.dateBtnText}>{new Date(startDate).toLocaleDateString()}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>END DATE</Text>
            <TouchableOpacity style={styles.dateBtn} activeOpacity={0.8} onPress={() => setEndPickerVisibility(true)}>
              <Text style={styles.dateBtnText}>{new Date(endDate).toLocaleDateString()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.searchBtn} activeOpacity={0.8} onPress={fetchFilteredExpenses} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.searchBtnText}>GENERATE REPORT</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 25 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
               <Text style={styles.userName}>{item.userId?.name || 'Unknown Officer'}</Text>
               <Text style={styles.amount}>₹{item.amount}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            
            <View style={styles.dateTimeContainer}>
                <View style={styles.badge}>
                  <Text style={styles.dateText}>📅 {new Date(item.date).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.badge, styles.badgeTime]}>
                  <Text style={styles.timeText}>🕒 {formatTime(item.date)}</Text>
                </View>
            </View>
            
            <View style={styles.actionRow}>
                <TouchableOpacity 
                  onPress={() => {
                    setEditingItem({ id: item._id, title: item.title, amount: String(item.amount) });
                    setEditModalVisible(true);
                  }}
                  style={styles.actionBtn}>
                    <Text style={styles.editLabel}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id)} style={[styles.actionBtn, styles.deleteBtn]}>
                    <Text style={styles.deleteLabel}>DELETE</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={{ color: '#71717A', fontStyle: 'italic' }}>No expenses found for this period.</Text>
          </View>
        }
      />

      <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Filtered Total ({expenses.length})</Text>
          <Text style={styles.totalVal}>₹{totalAmount.toLocaleString()}</Text>
      </View>

      {/* MODAL: CHOOSE OFFICER */}
      <Modal visible={userModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Officer</Text>
            <TouchableOpacity style={styles.userOption} onPress={() => { setSelectedUser({id: '', name: 'All Officers'}); setUserModalVisible(false); }}>
              <Text style={styles.userOptionText}>All Officers</Text>
            </TouchableOpacity>
            <FlatList data={users} keyExtractor={item => item._id} renderItem={({ item }) => (
                <TouchableOpacity style={styles.userOption} onPress={() => { setSelectedUser({id: item._id, name: item.name}); setUserModalVisible(false); }}>
                  <Text style={styles.userOptionText}>{item.name}</Text>
                </TouchableOpacity>
            )} />
            <TouchableOpacity onPress={() => setUserModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDIT EXPENSE */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Edit Expense</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EXPENSE TITLE</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="E.g. Fuel" 
                    placeholderTextColor="#71717A"
                    value={editingItem.title} 
                    onChangeText={(t) => setEditingItem({...editingItem, title: t})} 
                />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="0" 
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    value={editingItem.amount} 
                    onChangeText={(t) => setEditingItem({...editingItem, amount: t})} 
                />
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleUpdate}>
                <Text style={styles.modalSaveText}>UPDATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal isVisible={isStartPickerVisible} mode="date" onConfirm={(d) => {setStartDate(d.toISOString().split('T')[0]); setStartPickerVisibility(false);}} onCancel={() => setStartPickerVisibility(false)} />
      <DateTimePickerModal isVisible={isEndPickerVisible} mode="date" onConfirm={(d) => {setEndDate(d.toISOString().split('T')[0]); setEndPickerVisibility(false);}} onCancel={() => setEndPickerVisibility(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B', paddingHorizontal: 20, paddingTop: 10 },
  headerTitle: { color: '#FAFAFA', fontSize: 28, fontWeight: '900', marginBottom: 15, letterSpacing: -0.5 },
  
  filterCard: { backgroundColor: '#18181B', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#27272A', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  label: { color: '#71717A', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  dropdown: { backgroundColor: '#27272A', padding: 15, borderRadius: 12, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { color: '#FAFAFA', fontWeight: '600', fontSize: 15 },
  dropdownIcon: { color: '#10B981', fontSize: 12 },
  row: { flexDirection: 'row', marginBottom: 18 },
  dateBtn: { backgroundColor: '#27272A', padding: 14, borderRadius: 12, alignItems: 'center' },
  dateBtnText: { color: '#FAFAFA', fontWeight: '600' },
  searchBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  searchBtnText: { fontWeight: '900', color: '#064E3B', letterSpacing: 1 },
  
  card: { backgroundColor: '#18181B', padding: 20, borderRadius: 18, marginBottom: 15, borderWidth: 1, borderColor: '#27272A', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  userName: { color: '#10B981', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  amount: { color: '#FBBF24', fontWeight: '900', fontSize: 24 },
  title: { color: '#FAFAFA', fontSize: 17, fontWeight: '600', marginBottom: 12 },
  
  dateTimeContainer: { flexDirection: 'row', alignItems: 'center' },
  badge: { backgroundColor: '#27272A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 10 },
  badgeTime: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  dateText: { color: '#A1A1AA', fontSize: 11, fontWeight: '600' },
  timeText: { color: '#10B981', fontSize: 11, fontWeight: '800' },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, borderTopWidth: 1, borderTopColor: '#27272A', paddingTop: 15 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', marginLeft: 10 },
  editLabel: { color: '#10B981', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  deleteLabel: { color: '#EF4444', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  
  totalContainer: { backgroundColor: '#18181B', padding: 22, borderRadius: 20, borderTopWidth: 3, borderTopColor: '#10B981', marginTop: 5, marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  totalLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  totalVal: { color: '#10B981', fontSize: 28, fontWeight: '900' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', maxHeight: '75%', backgroundColor: '#18181B', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#27272A' },
  modalBody: { width: '88%', backgroundColor: '#18181B', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#27272A' },
  modalTitle: { color: '#FAFAFA', fontSize: 22, fontWeight: '900', marginBottom: 25, letterSpacing: -0.5 },
  userOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  userOptionText: { color: '#FAFAFA', fontSize: 16, fontWeight: '500' },
  closeBtn: { marginTop: 20, padding: 15, backgroundColor: '#27272A', borderRadius: 12, alignItems: 'center' },
  closeBtnText: { color: '#EF4444', fontWeight: '800', letterSpacing: 1 },
  
  inputGroup: { marginBottom: 18 },
  inputLabel: { color: '#71717A', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#27272A', color: '#FAFAFA', padding: 16, borderRadius: 12, fontWeight: '600', fontSize: 16 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalCancel: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#27272A', marginRight: 10, alignItems: 'center' },
  modalCancelText: { color: '#FAFAFA', fontWeight: '800', letterSpacing: 1, fontSize: 13 },
  modalSave: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center' },
  modalSaveText: { color: '#064E3B', fontWeight: '900', letterSpacing: 1, fontSize: 13 }
});