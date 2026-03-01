import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView 
} from 'react-native';
import { api } from '../api/client';

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
      <ActivityIndicator size="large" color="#00E676" />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        
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
    backgroundColor: '#121212', 
    padding: 20,
    // Lower zIndex ensures it stays behind the sidebar/overlay
    zIndex: 1 
  },
  loader: { 
    flex: 1, 
    backgroundColor: '#121212', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  profileHeader: { 
    alignItems: 'center', 
    marginTop: 20,
    marginBottom: 30 
  },
  avatarLarge: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#00E676', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15,
    // FIXED: Removed elevation: 10 which causes "bleeding" through layers on Android
    borderWidth: 3,
    borderColor: 'rgba(0, 230, 118, 0.2)'
  },
  avatarText: { 
    fontSize: 40, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  userName: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  badge: { 
    backgroundColor: 'rgba(0, 230, 118, 0.1)', 
    paddingHorizontal: 15, 
    paddingVertical: 5, 
    borderRadius: 20, 
    marginTop: 10, 
    borderWidth: 1, 
    borderColor: '#00E676'
  },
  badgeText: { 
    color: '#00E676', 
    fontWeight: 'bold', 
    fontSize: 12,
    letterSpacing: 1
  },
  infoSection: { 
    marginTop: 10 
  },
  sectionLabel: { 
    color: '#666', 
    fontSize: 12, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    marginLeft: 5, 
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  infoCard: { 
    backgroundColor: '#1E1E1E', 
    borderRadius: 15, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  infoRow: { 
    paddingVertical: 12 
  },
  label: { 
    color: '#888', 
    fontSize: 12, 
    marginBottom: 4 
  },
  value: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '500' 
  },
  divider: { 
    height: 1, 
    backgroundColor: '#333' 
  }
});