import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import SkeletonLoader from '../components/SkeletonLoader';

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
        <SkeletonLoader type="list" />
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
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 20, paddingTop: 20 },
  header: { color: '#ffffff', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  subHeader: { color: '#10B981', textAlign: 'center', marginBottom: 25, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  form: { 
    backgroundColor: '#18181B', padding: 22, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: '#27272A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  disabledForm: { opacity: 0.6 },
  dutyWarning: { color: '#EF4444', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  label: { color: '#10B981', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#27272A', color: '#F4F4F5', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#3F3F46' },
  disabledInput: { backgroundColor: '#18181B', borderColor: '#27272A', color: '#71717A' },
  saveBtn: { 
    backgroundColor: '#10B981', padding: 16, borderRadius: 14, alignItems: 'center',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6
  },
  disabledBtn: { backgroundColor: '#27272A', shadowOpacity: 0 },
  saveBtnText: { color: '#064E3B', fontWeight: '900', letterSpacing: 0.5 },
  cancelLink: { color: '#EF4444', textAlign: 'center', marginTop: 15, fontSize: 13, fontWeight: '700' },
  listHeader: { marginBottom: 15 },
  listTitle: { color: '#A1A1AA', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: '#18181B', padding: 18, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  itemTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  itemDate: { color: '#71717A', fontSize: 12, marginTop: 4, fontWeight: '600' },
  rightSide: { alignItems: 'flex-end' },
  itemAmount: { color: '#10B981', fontWeight: '900', fontSize: 19, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  edit: { color: '#FBBF24', marginRight: 15, fontSize: 12, fontWeight: '800' },
  delete: { color: '#EF4444', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#71717A', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  totalFooter: { backgroundColor: 'rgba(16, 185, 129, 0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 22, borderRadius: 24, marginTop: 10, marginBottom: 50, borderWidth: 1, borderColor: '#10B981' },
  totalLabel: { color: '#10B981', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  monthLabel: { color: '#10B981', fontSize: 11, fontWeight: '800', marginTop: 4, opacity: 0.8 },
  totalValue: { color: '#10B981', fontSize: 26, fontWeight: '900' }
});