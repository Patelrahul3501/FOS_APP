import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  ActivityIndicator, Modal, TouchableOpacity,
  InteractionManager
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { api } from '../api/client';
import SkeletonLoader from '../components/SkeletonLoader';

export default function AttendanceCalendar() {
  const [markedDates, setMarkedDates] = useState({});
  const [historyData, setHistoryData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);

  useEffect(() => { 
    InteractionManager.runAfterInteractions(() => {
      fetchHistory(); 
    });
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/attendance/history');
      
      // FIX: Ensure historyData is always an object keyed by date string
      let formattedData = {};
      if (Array.isArray(res.data)) {
        res.data.forEach(item => {
          formattedData[item.date] = item;
        });
      } else {
        formattedData = res.data;
      }

      setHistoryData(formattedData);
      generateMarkedDates(formattedData);
    } catch (e) { 
      console.log("History fetch failed", e); 
    } finally {
      // Small timeout to guarantee DOM has painted navigation
      setTimeout(() => {
        setLoading(false);
        setTimeout(() => setIsReady(true), 50);
      }, 50);
    }
  };

const generateMarkedDates = (history) => {
  let marks = {};
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayDate = new Date(todayStr);

  // UPDATED: i <= 90 to see 3 months into the future
  for (let i = -60; i <= 90; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + i);
    const dayStr = d.toISOString().split('T')[0];
    
    const record = history[dayStr]; 
    const status = record?.status || (typeof record === 'string' ? record : null);
    
    // 1. PRIORITY: If a record exists (Present/Half Day/In Progress)
    if (status === 'Present') {
      marks[dayStr] = { selected: true, selectedColor: '#00E676', textColor: '#000' };
    } 
    else if (status === 'Half Day') {
      marks[dayStr] = { selected: true, selectedColor: '#FFD600', textColor: '#000' };
    } 
    else if (status === 'In Progress') {
      marks[dayStr] = { selected: true, selectedColor: '#2196F3', textColor: '#fff' };
    }
    // 2. HOLIDAY: If it's a Sunday (Past or Future)
    else if (d.getDay() === 0) {
      marks[dayStr] = { selected: true, selectedColor: '#424242', textColor: '#fff' };
    } 
    // 3. TODAY: Highlight today if no record exists
    else if (dayStr === todayStr) {
      marks[dayStr] = { selected: true, selectedColor: '#00B8D4', textColor: '#fff' };
    }
    // 4. PAST ABSENT: If day is in the past and has no record
    else if (d < todayDate) {
      marks[dayStr] = { selected: true, selectedColor: '#FF5252', textColor: '#fff' };
    }
    // 5. FUTURE WORKING DAYS: Leave them plain/default
  }
  setMarkedDates(marks);
};

  const onDayPress = (day) => {
    const info = historyData[day.dateString];
    
    // Even if no record exists in DB, show the "Absent" status for past days
    setSelectedDayInfo({
      date: day.dateString,
      status: info?.status || "Absent",
      checkInTime: info?.checkInTime || null,
      checkOutTime: info?.checkOutTime || null,
      workHours: info?.workHours || "0.00"
    });
    setModalVisible(true);
  };

  const formatTime = (time) => {
    if (!time) return "--:--";
    try {
        return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "--:--";
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendance History</Text>
      
      {loading || !isReady ? (
        <View style={{ paddingTop: 10 }}>
          <SkeletonLoader style={{ width: '100%', height: 350, borderRadius: 24, marginBottom: 25, alignSelf: 'center' }} />
          <SkeletonLoader type="list" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.calendarWrapper}>
            <Calendar
              onDayPress={onDayPress}
              theme={{ 
                calendarBackground: '#18181B', 
                dayTextColor: '#F4F4F5', 
                monthTextColor: '#10B981', 
                todayTextColor: '#10B981', 
                arrowColor: '#10B981', 
                textDisabledColor: '#3F3F46',
                'stylesheet.day.basic': {
                  base: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }
                }
              }}
              markedDates={markedDates}
            />
          </View>

          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#00E676' }]} /><Text style={styles.legendText}>Present</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#FFD600' }]} /><Text style={styles.legendText}>Half Day</Text></View>
            </View>
            <View style={[styles.legendRow, { marginTop: 15 }]}>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#FF5252' }]} /><Text style={styles.legendText}>Absent</Text></View>
              <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#424242' }]} /><Text style={styles.legendText}>Holiday</Text></View>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalDate}>{selectedDayInfo?.date}</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={[styles.detailValue, { 
                  color: selectedDayInfo?.status === 'Present' ? '#00E676' : 
                         selectedDayInfo?.status === 'Half Day' ? '#FFD600' : '#FF5252' 
                }]}>
                {selectedDayInfo?.status}
              </Text>
            </View>

            <View style={styles.timeBox}>
               <View style={styles.timeCol}>
                 <Text style={styles.timeLabel}>Check In</Text>
                 <Text style={styles.timeText}>{formatTime(selectedDayInfo?.checkInTime)}</Text>
               </View>
               <View style={styles.timeCol}>
                 <Text style={styles.timeLabel}>Check Out</Text>
                 <Text style={styles.timeText}>{formatTime(selectedDayInfo?.checkOutTime)}</Text>
               </View>
            </View>

            <View style={styles.workHoursContainer}>
               <Text style={styles.workHoursLabel}>Total Work Hours</Text>
               <Text style={styles.workHoursValue}>{selectedDayInfo?.workHours}h</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 20, paddingTop: 20 },
  header: { color: '#ffffff', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 25, letterSpacing: 0.5 },
  scrollContent: { paddingBottom: 30 },
  calendarWrapper: { 
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#27272A', backgroundColor: '#18181B',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8
  },
  legend: { marginTop: 25, backgroundColor: '#18181B', padding: 22, borderRadius: 20, borderWidth: 1, borderColor: '#27272A' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', width: '45%' },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  legendText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#18181B', borderRadius: 24, padding: 25, borderWidth: 1, borderColor: '#27272A' },
  modalDate: { color: '#10B981', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 25, letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  detailLabel: { color: '#71717A', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  timeBox: { flexDirection: 'row', backgroundColor: '#27272A', borderRadius: 16, padding: 18, marginBottom: 20 },
  timeCol: { flex: 1, alignItems: 'center' },
  timeLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  timeText: { color: '#ffffff', fontSize: 17, fontWeight: '800', marginTop: 8 },
  workHoursContainer: { alignItems: 'center', padding: 18, borderTopWidth: 1, borderTopColor: '#3F3F46' },
  workHoursLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  workHoursValue: { color: '#FBBF24', fontSize: 28, fontWeight: '900', marginTop: 8 },
  closeBtn: { marginTop: 20, backgroundColor: '#10B981', padding: 16, borderRadius: 14, alignItems: 'center' },
  closeBtnText: { color: '#064E3B', fontWeight: '900', letterSpacing: 1 }
});