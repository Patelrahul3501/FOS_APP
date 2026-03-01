module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // REMOVE the plugins array if it only contained reanimated
  };
};