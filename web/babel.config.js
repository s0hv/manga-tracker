module.exports = (api) => {
  const presets = [];
  if (api.env('test')) {
    // Required only for jest
    presets.push('@babel/preset-env');
  }
  return { presets };
};
