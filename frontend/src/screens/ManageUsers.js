import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { api } from '../api/client';

export default function ManageUsers({ onNavigate }) {
  const [users, setUsers] = useState([]);
  const [editModal, setEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '' });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (e) { console.log(e); }
  };

  // Helper to validate 10-digit phone number
  const validatePhone = (phone) => {
    const reg = /^[0-9]{10}$/;
    return reg.test(phone);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({ 
      name: user.name, 
      email: user.email, 
      phone: user.phone || '', 
      password: '' 
    });
    setEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editForm.name || !editForm.email || !editForm.phone) {
        Alert.alert("Error", "Name, Email, and Phone are required.");
        return;
    }

    if (!validatePhone(editForm.phone)) {
        Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
        return;
    }

    try {
      await api.put(`/admin/users/${selectedUser._id}`, editForm);
      Alert.alert("Success", "User updated successfully");
      setEditModal(false);
      fetchUsers();
    } catch (error) { 
        Alert.alert("Error", error.response?.data?.message || "Update failed"); 
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Officers Management</Text>
      
      <TouchableOpacity style={styles.addBtn} onPress={() => onNavigate('CREATE_USER')}>
        <Text style={styles.addBtnText}>+ Create New Officer</Text>
      </TouchableOpacity>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={[styles.statusDot, { backgroundColor: item.isOnline ? '#00E676' : '#555' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phoneSub}>{item.phone || 'No Phone Registered'}</Text>
            </View>
            <TouchableOpacity onPress={() => openEditModal(item)} style={{ marginRight: 15 }}>
              <Text style={styles.edit}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
               Alert.alert("Delete", "Are you sure?", [
                { text: "Cancel" },
                { text: "Delete", onPress: async () => { await api.delete(`/admin/users/${item._id}`); fetchUsers(); }}
              ]);
            }}>
              <Text style={styles.delete}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={editModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Edit Officer Details</Text>
            
            <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm({...editForm, name: t})} placeholder="Full Name" placeholderTextColor="#888" />
            <TextInput style={styles.input} value={editForm.email} onChangeText={(t) => setEditForm({...editForm, email: t})} placeholder="Email" placeholderTextColor="#888" keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} value={editForm.phone} onChangeText={(t) => setEditForm({...editForm, phone: t})} placeholder="Phone Number" placeholderTextColor="#888" keyboardType="phone-pad" maxLength={10} />
            <TextInput style={styles.input} secureTextEntry onChangeText={(t) => setEditForm({...editForm, password: t})} placeholder="New Password (Optional)" placeholderTextColor="#888" />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={{color: '#fff'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
                <Text style={{fontWeight: 'bold'}}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20, paddingTop: 20 },
  header: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  addBtn: { backgroundColor: '#00E676', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  addBtnText: { color: '#000', fontWeight: 'bold' },
  userCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 15 },
  name: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  phoneSub: { color: '#888', fontSize: 12, marginTop: 2 },
  edit: { color: '#00E676', fontWeight: 'bold' },
  delete: { color: '#FF5252' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#1E1E1E', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  modalHeader: { color: '#00E676', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#333', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelBtn: { padding: 12, marginRight: 10 },
  saveBtn: { backgroundColor: '#00E676', padding: 12, borderRadius: 8 }
});