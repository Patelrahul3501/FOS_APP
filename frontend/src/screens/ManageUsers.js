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

  const validatePhone = (phone) => /^[0-9]{10}$/.test(phone);

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || '', password: '' });
    setEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editForm.name || !editForm.email || !editForm.phone) return Alert.alert("Error", "Name, Email, and Phone are required.");
    if (!validatePhone(editForm.phone)) return Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");

    try {
      await api.put(`/admin/users/${selectedUser._id}`, editForm);
      Alert.alert("Success", "User updated successfully");
      setEditModal(false);
      fetchUsers();
    } catch (error) { Alert.alert("Error", error.response?.data?.message || "Update failed"); }
  };

  const deleteUser = (id) => {
    Alert.alert("Delete Officer", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { 
          try { await api.delete(`/admin/users/${id}`); fetchUsers(); }
          catch(e) { Alert.alert('Error', 'Failed to delete'); }
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Team Directory</Text>
      
      <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => onNavigate('CREATE_USER')}>
        <Text style={styles.addBtnText}>+ Add New Officer</Text>
      </TouchableOpacity>
      
      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No officers found.</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfoWrapper}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarInitials}>{item.name.substring(0,2).toUpperCase()}</Text>
                  <View style={[styles.statusIndicator, { backgroundColor: item.isOnline ? '#10B981' : '#52525B' }]} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.subText}>{item.phone || 'No Phone'}</Text>
                  <Text style={styles.subTextDetail}>{item.email}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
                  <Text style={styles.editLabel}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteUser(item._id)} style={[styles.actionBtn, styles.deleteBtn]}>
                  <Text style={styles.deleteLabel}>REMOVE</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={editModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm({...editForm, name: t})} placeholder="John Doe" placeholderTextColor="#71717A" />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <TextInput style={styles.input} value={editForm.email} onChangeText={(t) => setEditForm({...editForm, email: t})} placeholder="john@example.com" placeholderTextColor="#71717A" keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                <TextInput style={styles.input} value={editForm.phone} onChangeText={(t) => setEditForm({...editForm, phone: t})} placeholder="9876543210" placeholderTextColor="#71717A" keyboardType="phone-pad" maxLength={10} />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NEW PASSWORD (OPTIONAL)</Text>
                <TextInput style={styles.input} secureTextEntry onChangeText={(t) => setEditForm({...editForm, password: t})} placeholder="Leave blank to keep current" placeholderTextColor="#71717A" />
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleUpdate}>
                <Text style={styles.modalSaveText}>SAVE CHANGES</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B', paddingHorizontal: 20, paddingTop: 20 },
  headerTitle: { color: '#FAFAFA', fontSize: 28, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5 },
  addBtn: { 
    backgroundColor: '#10B981', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 25,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6
  },
  addBtnText: { color: '#064E3B', fontWeight: '900', letterSpacing: 0.5, fontSize: 15 },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#71717A', fontSize: 16, fontWeight: '500' },
  
  userCard: { 
    backgroundColor: '#18181B', padding: 18, borderRadius: 20, marginBottom: 15,
    borderWidth: 1, borderColor: '#27272A', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5
  },
  userInfoWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#27272A', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarInitials: { color: '#10B981', fontWeight: '900', fontSize: 18 },
  statusIndicator: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#18181B' },
  userInfo: { marginLeft: 16, flex: 1 },
  nameText: { color: '#FAFAFA', fontSize: 18, fontWeight: '800', marginBottom: 3 },
  subText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  subTextDetail: { color: '#71717A', fontSize: 11, marginTop: 2 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#27272A', paddingTop: 14 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', marginLeft: 10 },
  editLabel: { color: '#10B981', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  deleteLabel: { color: '#EF4444', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { width: '88%', backgroundColor: '#18181B', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#27272A' },
  modalTitle: { color: '#FAFAFA', fontSize: 22, fontWeight: '900', marginBottom: 25, letterSpacing: -0.5 },
  inputGroup: { marginBottom: 18 },
  inputLabel: { color: '#71717A', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#27272A', color: '#FAFAFA', padding: 14, borderRadius: 12, fontWeight: '500', fontSize: 15 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalCancel: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#27272A', marginRight: 10, alignItems: 'center' },
  modalCancelText: { color: '#FAFAFA', fontWeight: '800', letterSpacing: 1, fontSize: 13 },
  modalSave: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center' },
  modalSaveText: { color: '#064E3B', fontWeight: '900', letterSpacing: 1, fontSize: 13 }
});