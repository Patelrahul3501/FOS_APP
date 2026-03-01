import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { Colors } from '../theme/colors';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

const handleLogin = async () => {
  setLoading(true); // Always start loading
  try {
    const response = await api.post('/auth/login', { 
      email: email.trim().toLowerCase(), 
      password 
    });

    if (response.data && response.data.token) {
      await AsyncStorage.setItem('userToken', response.data.token);
      await AsyncStorage.setItem('userRole', response.data.role);
      
      // Call the function passed from App.js
      onLoginSuccess(); 
    }
  } catch (error) {
    console.log("Frontend Error:", error);
    Alert.alert("Login Failed", error.response?.data?.message || "Server Unreachable");
  } finally {
    setLoading(false);
  }
};

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>F.O.S</Text>
        <Text style={styles.subtitle}>Field Officer System</Text>

        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Officer Email" 
            value={email} 
            onChangeText={setEmail} 
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput 
            style={styles.input} 
            placeholder="Password" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            placeholderTextColor="#888" 
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>LOG IN</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>Secure Officer Access Only</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212' 
  },
  inner: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 30 
  },
  title: { 
    color: '#00E676', 
    fontSize: 42, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  subtitle: { 
    color: '#fff', 
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 40,
    letterSpacing: 2
  },
  inputContainer: {
    marginBottom: 20
  },
  input: { 
    backgroundColor: '#1E1E1E', 
    color: '#fff', 
    padding: 18, 
    borderRadius: 12, 
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  button: { 
    backgroundColor: '#00E676', 
    padding: 20, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 10,
    elevation: 5
  },
  buttonText: { 
    color: '#000',
    fontWeight: 'bold', 
    fontSize: 18,
    letterSpacing: 1
  },
  footerText: {
    color: '#555',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 12
  }
});