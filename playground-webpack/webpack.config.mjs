import { fileURLToPath } from 'node:url'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { VueLoaderPlugin } from 'vue-loader'
import webpack from 'webpack'

/** Resolves a path relative to this file. */
function resolvePath(path) {
  return fileURLToPath(new URL(path, import.meta.url))
}

/**
 * Production build only: the chunk loading failures this playground checks don't happen with a dev server.
 * @type {import('webpack').Configuration}
 */
export default {
  mode: 'production',
  context: resolvePath('.'),
  entry: './src/main.ts',
  output: {
    path: resolvePath('./dist'),
    // Absolute, so the chunks are found from any page of the history mode
    publicPath: '/',
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue'],
    alias: {
      // Uses the source of the library, as an app would use the installed package
      '@side-xp/vue-error-handling': resolvePath('../src/index.ts'),
    },
  },
  module: {
    rules: [
      { test: /\.vue$/, loader: 'vue-loader' },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          appendTsSuffixTo: [/\.vue$/],
          // The types are checked by `vue-tsc` (`npm run verify`)
          transpileOnly: true,
          configFile: resolvePath('./tsconfig.json'),
          compilerOptions: { noEmit: false, allowImportingTsExtensions: false },
        },
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({ template: './index.html' }),
    // Feature flags of the Vue bundler build, set by Vite's Vue plugin in the other playground
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    }),
  ],
}
