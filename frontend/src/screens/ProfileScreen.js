import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';
import SkeletonLoader from '../components/SkeletonLoader';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      // Hits the /api/auth/me endpoint you created
      const res = await api.get('/auth/me'); 
      setUser(res.data);
    } catch (e) {
      console.log("Profile Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.loader}>
      <SkeletonLoader type="profile" />
    </View>
  );

  const handlePhotoUpload = () => {
    Alert.alert(
      "Profile Photo",
      "Choose an option to update your photo",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: openCamera },
        { text: "Gallery", onPress: openGallery }
      ]
    );
  };

  const handleImageResult = async (result) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLoading(true);
      try {
        const base64Photo = result.assets[0].base64;
        await api.put('/auth/profile-photo', { photo: base64Photo });
        setUser({ ...user, profilePhoto: base64Photo });
      } catch (e) {
        console.log("Photo Upload Error:", e);
        Alert.alert("Error", "Could not upload profile photo.");
      } finally {
        setLoading(false);
      }
    }
  };

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "Camera access is needed to take a profile photo.");
        return;
      }
      let result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2, // Fast upload
        base64: true
      });
      handleImageResult(result);
    } catch (e) {
      console.log("Camera Error", e);
    }
  };

  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "We need camera roll permissions to change your avatar.");
        return;
      }
      
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2,
        base64: true
      });
      handleImageResult(result);
    } catch (e) {
      console.log("Gallery Error", e);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePhotoUpload} activeOpacity={0.8}>
          {user?.profilePhoto ? (
            <Image 
               source={{ uri: `data:image/jpeg;base64,${user.profilePhoto}` }} 
               style={styles.avatarImage} 
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={{ fontSize: 13 }}>✏️</Text>
          </View>
        </TouchableOpacity>
        
        <Text style={styles.userName}>{user?.name || 'User Name'}</Text>
        
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionLabel}>Account Details</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.value}>{user?.email || 'N/A'}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone Number</Text>
            <Text style={styles.value}>{user?.phone || 'Not Provided'}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Employee ID</Text>
            <Text style={styles.value}>#{user?._id?.slice(-6).toUpperCase()}</Text>
          </View>
        </View>
      </View>
      
      {/* Bottom Padding for ScrollView */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0A0A0A', 
    padding: 20,
    zIndex: 1 
  },
  loader: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' },
  profileHeader: { alignItems: 'center', marginTop: 30, marginBottom: 35 },
  avatarContainer: { 
    width: 110, height: 110, borderRadius: 55, marginBottom: 15,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 12
  },
  avatarPlaceholder: {
    width: '100%', height: '100%', borderRadius: 55, backgroundColor: '#27272A', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#10B981'
  },
  avatarImage: {
    width: '100%', height: '100%', borderRadius: 55, borderWidth: 3, borderColor: '#10B981'
  },
  avatarText: { fontSize: 44, fontWeight: '900', color: '#10B981' },
  editBadge: { 
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#18181B', width: 34, height: 34, borderRadius: 17, 
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#10B981',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 5
  },
  userName: { color: '#ffffff', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  badge: { 
    backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 16, paddingVertical: 6, 
    borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: '#10B981',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3
  },
  badgeText: { color: '#10B981', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
  infoSection: { marginTop: 10 },
  sectionLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '800', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 1.5 },
  infoCard: { 
    backgroundColor: '#18181B', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#27272A',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 8
  },
  infoRow: { paddingVertical: 14 },
  label: { color: '#71717A', fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { color: '#F4F4F5', fontSize: 17, fontWeight: '600', letterSpacing: 0.3 },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 4 }
});