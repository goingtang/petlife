// Adds secrets that must not be committed. app.json holds everything else.
// Android Google Maps key: set GOOGLE_MAPS_ANDROID_API_KEY as an EAS environment variable
// (expo.dev → project → Environment variables) or in your shell for local builds.
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } },
    },
  };
};
