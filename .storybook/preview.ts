import '@fontsource-variable/hanken-grotesk/wght.css'
import '../src/assets/main.css'
import type { Preview } from '@storybook/vue3-vite'

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        paper: { name: 'Paper', value: '#f4f3ec' },
        pine: { name: 'Pine', value: '#0b3a2d' },
      },
    },
    controls: { expanded: true },
  },
  initialGlobals: {
    backgrounds: { value: 'paper' },
  },
}

export default preview
