import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../api/client';

export default function ExpenseScreen() {
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  // NEW State: Track if duty is active
  const [isDutyActive, setIsDutyActive] = useState(false);

  useEffect(() => { 
    fetchExpenses();
    checkDutyStatus(); // Check duty on mount
  }, []);

  // NEW: Function to check current duty status
  const checkDutyStatus = async () => {
    try {
      const res = await api.get('/attendance/status');
      const active = res.data?.exists && res.data?.record?.status === 'In Progress';
      setIsDutyActive(active);
    } catch (e) {
      console.log("Check duty failed", e);
      setIsDutyActive(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/expenses/my'); 
      setExpenses(res.data);
    } catch (e) { 
      console.log("Fetch expenses failed", e); 
    } finally {
      setFetching(false);
    }
  };

  const currentMonthExpenses = expenses.filter(item => {
    const expenseDate = new Date(item.date);
    const now = new Date();
    return (
      expenseDate.getMonth() === now.getMonth() && 
      expenseDate.getFullYear() === now.getFullYear()
    );
  });

  const totalAmount = currentMonthExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const handleSave = async () => {
    // SECURITY CHECK: Re-verify duty before posting
    await checkDutyStatus();
    if (!isDutyActive) {
      return Alert.alert("Access Denied", "You can only post expenses while on active duty.");
    }

    if (!title || !amount) return Alert.alert("Required", "Please fill all fields");
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/expenses/${editingId}`, { title, amount });
        Alert.alert("Success", "Expense updated");
      } else {
        await api.post('/expenses/add', { title, amount });
        Alert.alert("Success", "Expense added");
      }
      setTitle(''); setAmount(''); setEditingId(null);
      fetchExpenses();
    } catch (e) { 
      Alert.alert("Error", "Could not save expense"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel" },
      { text: "Delete", style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/expenses/${id}`);
          fetchExpenses();
        } catch (e) { Alert.alert("Error", "Failed to delete"); }
      }}
    ]);
  };

  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Monthly Expenses</Text>
      <Text style={styles.subHeader}>{currentMonthName} {new Date().getFullYear()}</Text>

      <View style={[styles.form, !isDutyActive && styles.disabledForm]}>
        <View style={styles.formHeader}>
            <Text style={styles.label}>{editingId ? "Edit Expense" : "Add New Expense"}</Text>
            {!isDutyActive && (
                <Text style={styles.dutyWarning}>⚠️ PUNCH IN REQUIRED</Text>
            )}
        </View>

        <TextInput 
          style={[styles.input, !isDutyActive && styles.disabledInput]} 
          placeholder="Title (e.g., Petrol, Food)" 
          value={title} 
          onChangeText={setTitle} 
          placeholderTextColor="#666" 
          editable={isDutyActive} // Block input if duty is off
        />
        <TextInput 
          style={[styles.input, !isDutyActive && styles.disabledInput]} 
          placeholder="Amount (₹)" 
          value={amount} 
          onChangeText={setAmount} 
          keyboardType="numeric" 
          placeholderTextColor="#666" 
          editable={isDutyActive} // Block input if duty is off
        />
        
        <TouchableOpacity 
            style={[styles.saveBtn, (!isDutyActive || loading) && styles.disabledBtn]} 
            onPress={handleSave} 
            disabled={!isDutyActive || loading}
        >
          <Text style={styles.saveBtnText}>
            {loading ? "PROCESSING..." : (!isDutyActive ? "DUTY NOT ACTIVE" : (editingId ? "UPDATE" : "SAVE EXPENSE"))}
          </Text>
        </TouchableOpacity>

        {editingId && (
          <TouchableOpacity onPress={() => {setEditingId(null); setTitle(''); setAmount('');}}>
            <Text style={styles.cancelLink}>Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Logs for {currentMonthName}</Text>
      </View>

      {fetching ? (
        <ActivityIndicator color="#00E676" />
      ) : (
        <FlatList
          data={currentMonthExpenses}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.rightSide}>
                <Text style={styles.itemAmount}>₹{item.amount}</Text>
                <View style={styles.row}>
                  <TouchableOpacity 
                    onPress={() => { 
                        if(!isDutyActive) return Alert.alert("Restricted", "Cannot edit expenses offline");
                        setEditingId(item._id); setTitle(item.title); setAmount(item.amount.toString()); 
                    }}
                  >
                    <Text style={[styles.edit, !isDutyActive && {color: '#444'}]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item._id)}>
                    <Text style={styles.delete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={
            currentMonthExpenses.length > 0 ? (
              <View style={styles.totalFooter}>
                <View>
                   <Text style={styles.totalLabel}>Monthly Total</Text>
                   <Text style={styles.monthLabel}>{currentMonthName}</Text>
                </View>
                <Text style={styles.totalValue}>₹{totalAmount.toLocaleString('en-IN')}</Text>
              </View>
            ) : <Text style={styles.emptyText}>No expenses found for this month.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20, paddingTop: 20 },
  header: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subHeader: { color: '#00E676', textAlign: 'center', marginBottom: 20, fontSize: 14, fontWeight: '600' },
  form: { backgroundColor: '#1E1E1E', padding: 18, borderRadius: 15, marginBottom: 25, borderWidth: 1, borderColor: '#333' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  disabledForm: { opacity: 0.6 },
  dutyWarning: { color: '#FF5252', fontSize: 10, fontWeight: 'bold' },
  label: { color: '#00E676', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  input: { backgroundColor: '#121212', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  disabledInput: { backgroundColor: '#1A1A1A', borderColor: '#222', color: '#444' },
  saveBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 10, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#333' },
  saveBtnText: { color: '#000', fontWeight: 'bold' },
  cancelLink: { color: '#FF5252', textAlign: 'center', marginTop: 10, fontSize: 12 },
  listHeader: { marginBottom: 15 },
  listTitle: { color: '#888', fontSize: 13, fontWeight: 'bold' },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: '#333' },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  itemDate: { color: '#555', fontSize: 11, marginTop: 4 },
  rightSide: { alignItems: 'flex-end' },
  itemAmount: { color: '#00E676', fontWeight: 'bold', fontSize: 18, marginBottom: 5 },
  row: { flexDirection: 'row', alignItems: 'center' },
  edit: { color: '#FFA000', marginRight: 15, fontSize: 11 },
  delete: { color: '#FF5252', fontSize: 11 },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 20 },
  totalFooter: { backgroundColor: '#00E676', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 15, marginTop: 10, marginBottom: 50 },
  totalLabel: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  monthLabel: { color: '#000', fontSize: 10, opacity: 0.6, fontWeight: 'bold' },
  totalValue: { color: '#000', fontSize: 22, fontWeight: '900' }
});