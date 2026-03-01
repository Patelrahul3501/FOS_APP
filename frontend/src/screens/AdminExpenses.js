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
    } catch (e) { console.log("Initial Fetch Error:", e); } finally { setLoading(false); }
  };

  const fetchFilteredExpenses = async () => {
    setLoading(true);
    try {
      const query = `/admin/expense-logs?userId=${selectedUser.id}&start=${startDate}&end=${endDate}`;
      const res = await api.get(query);
      setExpenses(res.data);
    } catch (e) { console.log("Expense Fetch Error:", e); } finally { setLoading(false); }
  };

  // DELETE Logic
  const handleDelete = (id) => {
    Alert.alert("Delete Expense", "Permanently remove this expense record?", [
      { text: "Cancel" },
      { text: "Delete", style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/admin/expenses/${id}`);
          Alert.alert("Success", "Record deleted.");
          fetchFilteredExpenses();
        } catch (e) { Alert.alert("Error", "Delete failed."); }
      }}
    ]);
  };

  // EDIT Logic
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
    } catch (e) { Alert.alert("Error", "Update failed."); } finally { setLoading(false); }
  };

  // Calculation for Total
  const totalAmount = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Global Expenses</Text>
      
      <View style={styles.filterCard}>
        <Text style={styles.label}>Select Officer</Text>
        <TouchableOpacity style={styles.dropdown} onPress={() => setUserModalVisible(true)}>
          <Text style={styles.dropdownText}>{selectedUser.name}</Text>
          <Text style={styles.dropdownText}>▼</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>From Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setStartPickerVisibility(true)}>
              <Text style={styles.dateBtnText}>{startDate}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setEndPickerVisibility(true)}>
              <Text style={styles.dateBtnText}>{endDate}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.searchBtn} onPress={fetchFilteredExpenses} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.searchBtnText}>GENERATE REPORT</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 20 }} // Added for better scrolling
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
               <Text style={styles.userName}>{item.userId?.name || 'Unknown Officer'}</Text>
               <Text style={styles.amount}>₹{item.amount}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
            
            <View style={styles.actionRow}>
                <TouchableOpacity 
                  onPress={() => {
                    setEditingItem({ id: item._id, title: item.title, amount: String(item.amount) });
                    setEditModalVisible(true);
                  }}
                  style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* TOTAL SUMMARY FOOTER */}
      <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Filtered Total ({expenses.length} records):</Text>
          <Text style={styles.totalVal}>₹{totalAmount.toLocaleString()}</Text>
      </View>

      {/* MODAL: CHOOSE OFFICER */}
      <Modal visible={userModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Officer</Text>
            <TouchableOpacity style={styles.userOption} onPress={() => { setSelectedUser({id: '', name: 'All Officers'}); setUserModalVisible(false); }}>
              <Text style={styles.userOptionText}>All Officers</Text>
            </TouchableOpacity>
            <FlatList data={users} keyExtractor={item => item._id} renderItem={({ item }) => (
                <TouchableOpacity style={styles.userOption} onPress={() => { setSelectedUser({id: item._id, name: item.name}); setUserModalVisible(false); }}>
                  <Text style={styles.userOptionText}>{item.name}</Text>
                </TouchableOpacity>
            )} />
            <TouchableOpacity onPress={() => setUserModalVisible(false)} style={styles.closeBtn}><Text style={{color: '#FF5252', fontWeight: 'bold'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDIT EXPENSE */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Expense</Text>
            <TextInput 
                style={styles.input} 
                placeholder="Title" 
                placeholderTextColor="#666"
                value={editingItem.title} 
                onChangeText={(t) => setEditingItem({...editingItem, title: t})} 
            />
            <TextInput 
                style={styles.input} 
                placeholder="Amount" 
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={editingItem.amount} 
                onChangeText={(t) => setEditingItem({...editingItem, amount: t})} 
            />
            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate}>
                <Text style={styles.updateBtnText}>SAVE CHANGES</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}><Text style={{color: '#FF5252'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal isVisible={isStartPickerVisible} mode="date" onConfirm={(d) => {setStartDate(d.toISOString().split('T')[0]); setStartPickerVisibility(false);}} onCancel={() => setStartPickerVisibility(false)} />
      <DateTimePickerModal isVisible={isEndPickerVisible} mode="date" onConfirm={(d) => {setEndDate(d.toISOString().split('T')[0]); setEndPickerVisibility(false);}} onCancel={() => setEndPickerVisibility(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212', 
    paddingHorizontal: 20, 
    paddingTop: 10 // FIXED: Changed from 50 to 10 to remove upper space
  },
  header: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 5 // Reduced margin
  },
  filterCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginVertical: 10, borderWidth: 1, borderColor: '#333' },
  label: { color: '#00E676', fontSize: 12, marginBottom: 5, fontWeight: 'bold' },
  dropdown: { backgroundColor: '#333', padding: 12, borderRadius: 8, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between' },
  dropdownText: { color: '#fff' },
  row: { flexDirection: 'row', marginBottom: 15 },
  dateBtn: { backgroundColor: '#333', padding: 12, borderRadius: 8, alignItems: 'center' },
  dateBtnText: { color: '#fff' },
  searchBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 10, alignItems: 'center' },
  searchBtnText: { fontWeight: 'bold', color: '#000' },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#00E676' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  userName: { color: '#00E676', fontWeight: 'bold', fontSize: 14 },
  amount: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  title: { color: '#ddd', fontSize: 16 },
  dateText: { color: '#666', fontSize: 11, marginTop: 5 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  editBtn: { paddingHorizontal: 15, paddingVertical: 5, backgroundColor: 'rgba(0, 230, 118, 0.1)', borderRadius: 5, marginRight: 10 },
  editBtnText: { color: '#00E676', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { paddingHorizontal: 15, paddingVertical: 5, backgroundColor: 'rgba(255, 82, 82, 0.1)', borderRadius: 5 },
  deleteBtnText: { color: '#FF5252', fontSize: 12, fontWeight: 'bold' },
  totalContainer: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 15, borderTopWidth: 2, borderTopColor: '#00E676', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#888', fontSize: 13 },
  totalVal: { color: '#00E676', fontSize: 22, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', maxHeight: '70%', backgroundColor: '#1E1E1E', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#00E676', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  userOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  userOptionText: { color: '#fff', fontSize: 16 },
  closeBtn: { marginTop: 15, alignItems: 'center' },
  input: { backgroundColor: '#333', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15 },
  updateBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  updateBtnText: { color: '#000', fontWeight: 'bold' }
});