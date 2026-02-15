module.exports = {
  entry: './src/main/main.js',
  module: {
    rules: [
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
};
