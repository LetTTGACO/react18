import { getBaseRollupPlugins, getPackageJSON, resolvePkgPath } from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, peerDependencies } = getPackageJSON('react-noop-renderer');
// react-noop-renderer包路径
const pkgPath = resolvePkgPath(name);
// react-noop-renderer产物路径
const pkgDistPath = resolvePkgPath(name, true);

const basePlugins = getBaseRollupPlugins({
  typescript: {
    exclude: ['./packages/react-dom/**'],
    tsconfigOverride: {
      compilerOptions: {
        // baseUrl: path.resolve(pkgPath, '../'),
        paths: {
          hostConfig: [`./${name}/src/hostConfig.ts`]
        }
      }
    }
  }
});
export default [
  // react-noop-renderer
  {
    input: `${pkgPath}/index.ts`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactNoopRenderer',
        format: 'umd'
      }
    ],
    external: [Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...basePlugins,
      // webpack resolve alias
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version, peerDependencies }) => ({
          name,
          description,
          version,
          peerDependencies,
          main: 'index.js'
        })
      })
    ]
  }
];
