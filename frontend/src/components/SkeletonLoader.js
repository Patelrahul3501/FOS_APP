import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const SkeletonLoader = ({ style, type = 'card' }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [opacity]);

  if (type === 'list') {
    return (
      <View style={{ width: '100%' }}>
        {[1, 2, 3, 4, 5].map((item) => (
          <Animated.View key={item} style={[styles.skeletonCard, { opacity }, style]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.thumbnail} />
              <View style={{ flex: 1 }}>
                <View style={styles.textLineLg} />
                <View style={[styles.textLineSm, { width: '50%' }]} />
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  }

  if (type === 'profile') {
    return (
      <Animated.View style={[styles.profileWrapper, { opacity }, style]}>
        <View style={styles.profileAvatar} />
        <View style={[styles.textLineLg, { width: 140, marginBottom: 15 }]} />
        <View style={styles.profileBox} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.base, { opacity }, style]} />
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#27272A',
    borderRadius: 8,
  },
  skeletonCard: {
    backgroundColor: '#18181B',
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#27272A',
    marginRight: 15,
  },
  textLineLg: {
    height: 18,
    backgroundColor: '#27272A',
    borderRadius: 4,
    marginBottom: 8,
    width: '80%',
  },
  textLineSm: {
    height: 12,
    backgroundColor: '#27272A',
    borderRadius: 4,
  },
  profileWrapper: {
    alignItems: 'center',
    marginTop: 30,
    width: '100%',
  },
  profileAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#27272A',
    marginBottom: 20,
  },
  profileBox: {
    width: width - 40,
    height: 200,
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  }
});

export default SkeletonLoader;
