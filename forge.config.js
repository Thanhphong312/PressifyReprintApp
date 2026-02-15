const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'Pressify Reprint',
    icon: path.resolve(__dirname, 'src/renderer/icon'),
    extraResource: ['.env', 'src/renderer/icon.png'],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'pressify_reprint',
        setupIcon: path.resolve(__dirname, 'src/renderer/icon.ico'),
        iconUrl: 'https://raw.githubusercontent.com/Thanhphong312/PressifyReprintApp/main/src/renderer/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'Thanhphong312',
          name: 'PressifyReprintApp',
        },
        prerelease: false,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.jsx',
              name: 'main_window',
              preload: {
                js: './src/main/preload.js',
              },
            },
          ],
        },
      },
    },
  ],
};
