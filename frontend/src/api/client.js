import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const api = axios.create({
  baseURL: 'http://172.20.10.2:5000/api', 
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  // Ensure we await the latest token from storage
  const token = await AsyncStorage.getItem('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// NEW: Response interceptor to handle 401s automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.log("Token expired or invalid. Logging out...");
      await AsyncStorage.removeItem('userToken');
      // Optional: Trigger a global logout event or redirect here
    }
    return Promise.reject(error);
  }
);