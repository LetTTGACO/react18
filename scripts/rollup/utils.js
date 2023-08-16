import path from 'path';
import fs from 'fs';

import ts from 'rollup-plugin-typescript2';
import cjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkgPath = path.resolve(__dirname, '../../packages');
const distPath = path.resolve(__dirname, '../../dist/node_modules');

/**
 * 解析pkg的路径
 * @param pkgName
 * @param isDist
 * @returns {string}
 */
export function resolvePkgPath(pkgName, isDist = false) {
  if (isDist) {
    return `${distPath}/${pkgName}`;
  }
  return `${pkgPath}/${pkgName}`;
}

/**
 * 获取pkgJson
 * @param pkgName
 * @returns {any}
 */
export function getPackageJSON(pkgName) {
  const path = `${resolvePkgPath(pkgName)}/package.json`;
  const str = fs.readFileSync(path, { encoding: 'utf-8' });
  return JSON.parse(str);
}

/**
 * 定义基础的rollup插件
 * @param alias
 * @param typescript
 * @returns {Plugin[]}
 */
export function getBaseRollupPlugins({
  alias = {
    __DEV__: true,
    preventAssignment: true
  },
  typescript = {}
} = {}) {
  return [replace(alias), cjs(), ts(typescript)];
}
