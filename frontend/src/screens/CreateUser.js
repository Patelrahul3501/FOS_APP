import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../api/client';

export default function CreateUser({ onBack }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);

  // Helper to validate 10-digit phone number
  const validatePhone = (phone) => {
    const reg = /^[0-9]{10}$/;
    return reg.test(phone);
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.phone || !form.password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    if (!validatePhone(form.phone)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', form);
      Alert.alert("Success", "New Officer Created!");
      onBack(); 
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create New Officer</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="Full Name" 
        placeholderTextColor="#888" 
        onChangeText={(val) => setForm({...form, name: val})} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Email Address" 
        autoCapitalize="none" 
        placeholderTextColor="#888" 
        keyboardType="email-address"
        onChangeText={(val) => setForm({...form, email: val})} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Phone Number (10 Digits)" 
        placeholderTextColor="#888" 
        keyboardType="phone-pad"
        maxLength={10} // Restrict UI input to 10 chars
        onChangeText={(val) => setForm({...form, phone: val})} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Password" 
        secureTextEntry 
        placeholderTextColor="#888" 
        onChangeText={(val) => setForm({...form, password: val})} 
      />

      <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>CREATE ACCOUNT</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={styles.cancelLink}>
        <Text style={styles.cancelText}>Cancel and Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 25, paddingTop: 20 },
  header: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: '#1E1E1E', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#00E676', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#000', fontWeight: 'bold' },
  cancelLink: { marginTop: 25, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 14 }
});