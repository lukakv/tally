import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Only used when wrapping the built PWA into an Android package.
 * The web app itself never imports Capacitor.
 */
const config: CapacitorConfig = {
  appId: 'app.tally.finance',
  appName: 'Tally',
  webDir: 'dist',
  android: {
    backgroundColor: '#0A0B0D',
  },
}

export default config
