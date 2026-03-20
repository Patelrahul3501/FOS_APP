import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const api = axios.create({
  baseURL: 'https://fos-app-1rwm.onrender.com/api', 
  // baseURL: 'https://fos-app-1rwm.onrender.com/api' || 'http://172.20.10.2:5000/api', 
  timeout: 10000,
});

let logoutCallback = null;

export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

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
      console.log("Token expired or invalid. Triggering logout...");
      await AsyncStorage.removeItem('userToken');
      
      if (logoutCallback) {
        logoutCallback();
      }
    }
    return Promise.reject(error);
  }
);